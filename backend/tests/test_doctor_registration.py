"""Doctor registration and sign-in checks with fake database and no email."""
import os
import unittest
from unittest.mock import AsyncMock, patch
from types import SimpleNamespace
from bson import ObjectId
from fastapi import HTTPException
from services import auth_service as service
from schemas.user import UserCreate


class DoctorRegistrationTests(unittest.IsolatedAsyncioTestCase):
    def payload(self, **changes):
        return UserCreate(**(dict(name='Test Doctor', email='doctor@example.com', password='test-password-only',
                                 role='doctor', doctor_passcode='test-registration-code-only', otp_code='123456') | changes))

    async def test_missing_or_demo_configuration_fails_closed_without_consuming_otp(self):
        for configured in ('',):
            with self.subTest(configured=bool(configured)), patch.dict(os.environ, {'HOSPITAL_DOCTOR_CODE': configured}), \
                    patch.object(service, 'verify_otp_code', new_callable=AsyncMock) as otp, \
                    patch.object(service.users_collection, 'insert_one', new_callable=AsyncMock) as insert:
                with self.assertRaises(HTTPException) as error:
                    await service.create_user(self.payload())
                self.assertEqual(error.exception.status_code, 503)
                otp.assert_not_awaited()
                insert.assert_not_awaited()

    async def test_wrong_code_does_not_consume_otp_or_create_account(self):
        with patch.dict(os.environ, {'HOSPITAL_DOCTOR_CODE': 'test-registration-code-only'}), \
                patch.object(service, 'verify_otp_code', new_callable=AsyncMock) as otp, \
                patch.object(service.users_collection, 'insert_one', new_callable=AsyncMock) as insert:
            for wrong in (None, '', 'wrong', 'अनधिकृत'):
                with self.assertRaises(HTTPException) as error:
                    await service.create_user(self.payload(doctor_passcode=wrong))
                self.assertEqual(error.exception.status_code, 403)
            otp.assert_not_awaited()
            insert.assert_not_awaited()

    async def test_valid_doctor_registration_requires_otp_and_stores_no_codes(self):
        with patch.dict(os.environ, {'HOSPITAL_DOCTOR_CODE': 'test-registration-code-only'}), \
                patch.object(service.users_collection, 'find_one', new_callable=AsyncMock, return_value=None), \
                patch.object(service, 'verify_otp_code', new_callable=AsyncMock) as otp, \
                patch.object(service.users_collection, 'insert_one', new_callable=AsyncMock, return_value=SimpleNamespace(inserted_id=ObjectId())) as insert:
            result = await service.create_user(self.payload())
            otp.assert_awaited_once_with('doctor@example.com', '123456')
            self.assertEqual(result['role'], 'doctor')
            stored = insert.call_args.args[0]
            self.assertNotIn('doctor_passcode', stored)
            self.assertNotIn('otp_code', stored)
            self.assertTrue(service.verify_password('test-password-only', stored['password']))

    async def test_bad_otp_prevents_registration_even_with_valid_hospital_code(self):
        with patch.dict(os.environ, {'HOSPITAL_DOCTOR_CODE': 'test-registration-code-only'}), \
                patch.object(service.users_collection, 'find_one', new_callable=AsyncMock, return_value=None), \
                patch.object(service, 'verify_otp_code', new_callable=AsyncMock, side_effect=HTTPException(400, 'Invalid verification code')), \
                patch.object(service.users_collection, 'insert_one', new_callable=AsyncMock) as insert:
            with self.assertRaises(HTTPException):
                await service.create_user(self.payload())
            insert.assert_not_awaited()

    async def test_patient_registration_does_not_require_staff_code(self):
        with patch.dict(os.environ, {'HOSPITAL_DOCTOR_CODE': ''}), \
                patch.object(service.users_collection, 'find_one', new_callable=AsyncMock, return_value=None), \
                patch.object(service, 'verify_otp_code', new_callable=AsyncMock), \
                patch.object(service.users_collection, 'insert_one', new_callable=AsyncMock, return_value=SimpleNamespace(inserted_id=ObjectId())):
            self.assertEqual((await service.create_user(self.payload(role='patient', doctor_passcode=None)))['role'], 'patient')

    async def test_doctor_login_uses_personal_password_without_registration_code(self):
        account = dict(_id=ObjectId(), email='doctor@example.com', role='doctor', password=service.get_password_hash('personal-password'))
        service.FAILED_LOGIN_ATTEMPTS.clear()
        with patch.dict(os.environ, {'HOSPITAL_DOCTOR_CODE': ''}), \
                patch.object(service.users_collection, 'find_one', new_callable=AsyncMock, return_value=account):
            data = await service.authenticate_user(account['email'], 'personal-password')
            self.assertEqual(data['user']['role'], 'doctor')
            self.assertTrue(data['access_token'])
            with self.assertRaises(HTTPException):
                await service.authenticate_user(account['email'], 'test-registration-code-only')


if __name__ == '__main__':
    unittest.main()
