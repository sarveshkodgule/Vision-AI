import unittest
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
from fastapi import HTTPException
from services import auth_service as auth
from database.mongodb import otp_codes_collection as codes


class OtpSecurityTests(unittest.IsolatedAsyncioTestCase):
    def record(self):
        return {'_id': 'test', 'created_at': datetime.now(timezone.utc),
                'code_hash': auth._otp_digest('patient@example.com', '123456')}

    async def test_preview_does_not_consume_code(self):
        with patch.object(codes, 'find_one_and_update', new_callable=AsyncMock, return_value=self.record()), \
                patch.object(codes, 'delete_one', new_callable=AsyncMock) as delete:
            self.assertTrue(await auth.verify_otp_code('patient@example.com', '123456', consume=False))
            delete.assert_not_awaited()

    async def test_wrong_code_is_rejected_without_deleting(self):
        with patch.object(codes, 'find_one_and_update', new_callable=AsyncMock, return_value=self.record()), \
                patch.object(codes, 'delete_one', new_callable=AsyncMock) as delete:
            with self.assertRaises(HTTPException):
                await auth.verify_otp_code('patient@example.com', '000000')
            delete.assert_not_awaited()

    async def test_purpose_and_attempt_limit_are_in_atomic_query(self):
        with patch.object(codes, 'find_one_and_update', new_callable=AsyncMock, return_value=None) as update:
            with self.assertRaises(HTTPException):
                await auth.verify_otp_code('patient@example.com', '123456', purpose='reset')
            self.assertEqual(update.call_args.args[0]['purpose'], 'reset')
            self.assertEqual(update.call_args.args[0]['attempts'], {'$lt': 5})

    async def test_success_consumes_once(self):
        with patch.object(codes, 'find_one_and_update', new_callable=AsyncMock, return_value=self.record()), \
                patch.object(codes, 'delete_one', new_callable=AsyncMock, return_value=SimpleNamespace(deleted_count=1)) as delete:
            self.assertTrue(await auth.verify_otp_code('patient@example.com', '123456'))
            delete.assert_awaited_once_with({'_id': 'test'})

    async def test_resend_cooldown(self):
        with patch.object(auth.users_collection, 'find_one', new_callable=AsyncMock, return_value=None), \
                patch.object(codes, 'find_one', new_callable=AsyncMock, return_value=self.record()), \
                patch('services.email_service.send_otp_email') as send:
            with self.assertRaises(HTTPException) as error:
                await auth.generate_and_save_otp('patient@example.com', is_signup=True)
            self.assertEqual(error.exception.status_code, 429)
            send.assert_not_called()
