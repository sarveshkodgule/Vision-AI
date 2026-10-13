"""Google login checks with synthetic claims; no Google, MongoDB or mail calls."""
import asyncio
import os
import sys
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, Mock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from bson import ObjectId
from fastapi import HTTPException
from fastapi.testclient import TestClient
from main import app
from services import google_auth_service as service
from services.auth_service import update_user_profile
from utils.security import SECRET_KEY, ALGORITHM
import jwt


class GoogleAuthTests(unittest.TestCase):
    def setUp(self):
        self.env = patch.dict(os.environ, {"GOOGLE_CLIENT_ID": "test-client.apps.googleusercontent.com"})
        self.env.start()
        self.addCleanup(self.env.stop)
        self.key = patch.object(service, 'SECRET_KEY', 'test-signing-key-not-for-production-123456789')
        self.key.start()
        self.addCleanup(self.key.stop)

    def claims(self, nonce):
        return {"sub": "google-person", "email": "patient@gmail.com", "email_verified": True,
                "name": "Sample Patient", "iss": "https://accounts.google.com", "nonce": nonce}

    def test_missing_config_fails_closed(self):
        with patch.dict(os.environ, {"GOOGLE_CLIENT_ID": ""}):
            self.assertEqual(TestClient(app).get('/auth/google/config').status_code, 503)

    def test_token_checks_nonce_and_verified_email(self):
        config = service.google_config()
        claims = self.claims(config['nonce'])
        with patch('google.oauth2.id_token.verify_oauth2_token', return_value=claims) as verify:
            self.assertEqual(service.verify_google_credential('signed-token', config['challenge'])['sub'], 'google-person')
            self.assertEqual(verify.call_args.args[2], 'test-client.apps.googleusercontent.com')
            for change in ({'nonce': 'wrong'}, {'email_verified': False}, {'iss': 'https://evil.example'}, {'sub': ''}):
                verify.return_value = {**claims, **change}
                with self.assertRaises(HTTPException) as result:
                    service.verify_google_credential('signed-token', config['challenge'])
                self.assertEqual(result.exception.status_code, 401)

    def test_reject_invalid_signature_audience_or_expiry(self):
        config = service.google_config()
        with patch('google.oauth2.id_token.verify_oauth2_token', side_effect=ValueError('Invalid token')):
            with self.assertRaises(HTTPException) as result:
                service.verify_google_credential('bad-token', config['challenge'])
            self.assertEqual(result.exception.status_code, 401)
        expired = jwt.encode({'purpose': 'google-login', 'nonce': config['nonce'], 'exp': 1}, service.SECRET_KEY, algorithm=ALGORITHM)
        with self.assertRaises(HTTPException):
            service.verify_google_credential('token', expired)

    def test_third_party_email_cannot_claim_existing_account(self):
        config = service.google_config()
        with patch('google.oauth2.id_token.verify_oauth2_token', return_value={**self.claims(config['nonce']), 'email': 'someone@example.org'}):
            with self.assertRaises(HTTPException) as result:
                service.verify_google_credential('token', config['challenge'])
            self.assertEqual(result.exception.status_code, 403)

    def database(self):
        db = Mock()
        db.create_index = AsyncMock()
        db.find_one = AsyncMock(return_value=None)
        db.find.return_value.to_list = AsyncMock(return_value=[])
        db.insert_one = AsyncMock(return_value=Mock(inserted_id=ObjectId()))
        db.update_one = AsyncMock(return_value=Mock(modified_count=1))
        return db

    def test_new_account_can_only_be_patient(self):
        db = self.database()
        identity = {'sub': 'google-person', 'email': 'patient@gmail.com', 'name': 'Patient'}
        with patch.object(service, 'users_collection', db), patch.object(service, 'verify_google_credential', return_value=identity):
            result = asyncio.run(service.authenticate_google('token', 'challenge'))
        self.assertEqual(result['user']['role'], 'patient')
        self.assertNotIn('password', db.insert_one.call_args.args[0])
        response = TestClient(app).post('/auth/google', json={'credential': 'x'*30, 'challenge': 'y'*30, 'role': 'doctor'})
        self.assertEqual(response.status_code, 422)

    def test_existing_doctor_is_linked_without_losing_id(self):
        db = self.database()
        user_id = ObjectId()
        db.find.return_value.to_list.return_value = [{'_id': user_id, 'email': 'doctor@gmail.com', 'role': 'doctor'}]
        identity = {'sub': 'doctor-google', 'email': 'doctor@gmail.com', 'name': 'Doctor'}
        with patch.object(service, 'users_collection', db), patch.object(service, 'verify_google_credential', return_value=identity):
            result = asyncio.run(service.authenticate_google('token', 'challenge'))
        self.assertEqual(result['user']['id'], str(user_id))
        self.assertEqual(result['user']['role'], 'doctor')
        db.insert_one.assert_not_awaited()

    def test_linked_subject_wins_over_email_changes(self):
        db = self.database()
        db.find_one.return_value = {'_id': ObjectId(), 'google_sub': 'stable', 'email': 'original@gmail.com', 'role': 'patient'}
        with patch.object(service, 'users_collection', db), patch.object(service, 'verify_google_credential', return_value={'sub': 'stable', 'email': 'new@gmail.com', 'name': 'Patient'}):
            result = asyncio.run(service.authenticate_google('token', 'challenge'))
        self.assertEqual(result['user']['email'], 'original@gmail.com')
        db.update_one.assert_not_awaited()

    def test_conflicting_google_subject_is_rejected(self):
        db = self.database()
        db.find.return_value.to_list.return_value = [{'_id': ObjectId(), 'google_sub': 'other', 'email': 'patient@gmail.com'}]
        with patch.object(service, 'users_collection', db), patch.object(service, 'verify_google_credential', return_value={'sub': 'new', 'email': 'patient@gmail.com'}):
            with self.assertRaises(HTTPException) as result:
                asyncio.run(service.authenticate_google('token', 'challenge'))
        self.assertEqual(result.exception.status_code, 409)

    def test_identity_email_cannot_be_changed_through_profile(self):
        with patch('services.auth_service.users_collection.find_one', new_callable=AsyncMock, return_value={'email': 'original@gmail.com'}):
            with self.assertRaises(HTTPException):
                asyncio.run(update_user_profile(str(ObjectId()), {'email': 'other@gmail.com'}))

    def test_password_routes_require_valid_input(self):
        client = TestClient(app)
        for route in ['login', 'signup', 'request-otp', 'verify-otp', 'reset-password']:
            self.assertEqual(client.post('/auth/' + route, json={}).status_code, 422)


if __name__ == '__main__':
    unittest.main()
