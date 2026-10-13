"""Real mail formatting and OTP lifecycle, with SMTP/database mocked."""
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from fastapi import HTTPException
from services import email_service as mail, auth_service as auth
from database.mongodb import otp_codes_collection


class EmailTests(unittest.TestCase):
    def test_otp_has_hospital_brand_plain_text_and_no_code_in_subject(self):
        message = mail.build_otp_email('patient@example.com', '654321')
        self.assertNotIn('654321', message['Subject'])
        self.assertIn('Shri Sarveshwar Netralaya', message['Subject'])
        self.assertIn('654321', message.get_body(preferencelist=('plain',)).get_content())
        self.assertIn('10 minutes', message.get_body(preferencelist=('html',)).get_content())
        self.assertEqual(message['To'], 'patient@example.com')

    def test_otp_sends_with_verified_tls_and_reports_rejection(self):
        with patch.object(mail, 'SMTP_EMAIL', 'visionaisystemss@gmail.com'), patch.object(mail, 'SMTP_PASSWORD', 'test-only'), patch.object(mail, 'SMTP_PORT', 587), patch.object(mail.smtplib, 'SMTP') as smtp:
            server = smtp.return_value.__enter__.return_value
            server.send_message.return_value = {}
            self.assertTrue(mail.send_otp_email('patient@example.com', '654321'))
            server.starttls.assert_called_once()
            self.assertIsNotNone(server.starttls.call_args.kwargs['context'])
            server.send_message.return_value = {'patient@example.com': (550, b'rejected')}
            self.assertFalse(mail.send_otp_email('patient@example.com', '654321'))

    def test_ssl_transport_on_port_465(self):
        with patch.object(mail, 'SMTP_EMAIL', 'sender@example.com'), patch.object(mail, 'SMTP_PASSWORD', 'test-only'), patch.object(mail, 'SMTP_PORT', 465), patch.object(mail.smtplib, 'SMTP_SSL') as smtp:
            server = smtp.return_value.__enter__.return_value
            server.send_message.return_value = {}
            self.assertTrue(mail.send_otp_email('patient@example.com', '654321'))
            server.starttls.assert_not_called()
            self.assertIn('context', smtp.call_args.kwargs)

    def test_missing_pdf_never_sends_an_attachmentless_success(self):
        with tempfile.TemporaryDirectory() as folder, patch.object(mail, '_send_message') as send:
            self.assertFalse(mail.send_pdf_report_email('patient@example.com', 'Sample', str(Path(folder) / 'missing.pdf')))
            send.assert_not_called()

    def test_assessment_email_escapes_names_and_does_not_claim_signoff(self):
        with tempfile.TemporaryDirectory() as folder, patch.object(mail, '_send_message') as send:
            report = Path(folder) / 'sample.pdf'
            report.write_bytes(b'%PDF-test')
            self.assertTrue(mail.send_pdf_report_email('patient@example.com', '<script>Sample</script>', str(report)))
            message = send.call_args.args[0]
            html = message.get_body(preferencelist=('html',)).get_content()
            self.assertNotIn('<script>', html)
            self.assertNotIn('official diagnostic', html)
            self.assertIn('not a signed clinical diagnosis', html)
            self.assertEqual(next(message.iter_attachments()).get_content_type(), 'application/pdf')


class OtpLifecycleTests(unittest.IsolatedAsyncioTestCase):
    async def test_generated_code_is_the_one_sent_by_real_mail_function(self):
        with patch.object(auth.users_collection, 'find_one', new_callable=AsyncMock, return_value=None), patch.object(otp_codes_collection, 'delete_many', new_callable=AsyncMock), patch.object(otp_codes_collection, 'insert_one', new_callable=AsyncMock) as insert, patch.object(mail, 'send_otp_email', return_value=True) as send:
            code = await auth.generate_and_save_otp('patient@example.com', is_signup=True)
            self.assertRegex(code, r'^\d{6}$')
            self.assertEqual(insert.call_args.args[0]['code'], code)
            send.assert_called_once_with('patient@example.com', code)

    async def test_mail_failure_invalidates_code_and_fails_request(self):
        with patch.object(auth.users_collection, 'find_one', new_callable=AsyncMock, return_value=None), patch.object(otp_codes_collection, 'delete_many', new_callable=AsyncMock) as delete, patch.object(otp_codes_collection, 'insert_one', new_callable=AsyncMock), patch.object(mail, 'send_otp_email', return_value=False):
            with self.assertRaises(HTTPException) as error:
                await auth.generate_and_save_otp('patient@example.com', is_signup=True)
            self.assertEqual(error.exception.status_code, 503)
            self.assertIn('code', delete.call_args.args[0])

    async def test_expired_and_already_consumed_codes_are_rejected(self):
        for expired in (True, False):
            record = {'_id': 'sample', 'created_at': datetime.now(timezone.utc) - timedelta(minutes=11 if expired else 1)}
            with patch.object(otp_codes_collection, 'find_one', new_callable=AsyncMock, return_value=record), patch.object(otp_codes_collection, 'delete_one', new_callable=AsyncMock, return_value=SimpleNamespace(deleted_count=0)):
                with self.assertRaises(HTTPException) as error:
                    await auth.verify_otp_code('patient@example.com', '654321')
                self.assertEqual(error.exception.status_code, 400)
