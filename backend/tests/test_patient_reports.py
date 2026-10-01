"""Patient PDF, ownership and email checks with no live database or mail traffic."""
import asyncio
import io
from pathlib import Path
import sys
import unittest
from unittest.mock import AsyncMock, Mock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from bson import ObjectId
from fastapi import HTTPException
from fastapi.testclient import TestClient
from pypdf import PdfReader
from main import app
from services import patient_report_service as reports, email_service, patient_service
from schemas.patient import PatientRiskInput
from utils.dependencies import get_current_user


def fixture(risk='High', probability=0.82):
    owner = {'_id': ObjectId(), 'name': 'Sample Patient', 'email': 'registered@example.com'}
    record = dict(_id=ObjectId(), user_id=str(owner['_id']), name='Sample Patient', age=12,
                  gender='Female', risk_level=risk, myopia_probability=probability,
                  created_at='2026-10-01T10:30:00', screen_time=4, reading_time=2,
                  outdoor_activity=1, sleep_hours=8, parental_myopia=1,
                  report_email={'status': 'queued', 'updated_at': 1})
    return record, owner


class ReportTests(unittest.TestCase):
    def test_all_risk_bands_generate_pdf(self):
        for risk, probability in [('Low', .15), ('Medium', .55), ('High', .82)]:
            record, owner = fixture(risk, probability)
            pdf = reports.make_patient_pdf(record, owner)
            self.assertTrue(pdf.startswith(b'%PDF'))
            self.assertGreater(len(pdf), 6000)
            reader = PdfReader(io.BytesIO(pdf))
            self.assertEqual(len(reader.pages), 3)
            content = '\n'.join(page.extract_text() for page in reader.pages)
            self.assertIn(f'{probability * 100:.1f}%', content)
            self.assertIn(owner['email'], content)
            self.assertIn('When to seek urgent help', content)
            self.assertIn('Patient education sources', content)
            self.assertIn('not', reports.care_guidance(risk)['probability_note'])

    def test_doctor_contact_is_real_and_patient_text_is_escaped(self):
        record, owner = fixture()
        record['name'] = 'Sample <Patient> & Family'
        pdf = reports.make_patient_pdf(record, owner, {'name': 'Example Clinician', 'email': 'doctor@example.com'})
        content = '\n'.join(page.extract_text() for page in PdfReader(io.BytesIO(pdf)).pages)
        self.assertIn('Sample <Patient> & Family', content)
        self.assertIn('doctor@example.com', content)
        self.assertIn('no clinician sign-off', ' '.join(content.split()))

    def test_invalid_results_fail_instead_of_inventing_prediction(self):
        for probability in [None, float('nan'), -1, 2]:
            record, owner = fixture(probability=probability)
            with self.assertRaises(HTTPException) as caught:
                reports.make_patient_pdf(record, owner)
            self.assertEqual(caught.exception.status_code, 409)

    def test_email_mime_uses_pdf_and_registered_recipient(self):
        record, owner = fixture()
        pdf = reports.make_patient_pdf(record, owner)
        with patch.object(email_service, 'SMTP_EMAIL', 'visionai@example.com'), patch.object(email_service, 'SMTP_PASSWORD', 'test-only'), patch.object(email_service.smtplib, 'SMTP') as smtp:
            server = smtp.return_value.__enter__.return_value
            server.send_message.return_value = {}
            email_service.send_patient_screening_email(owner['email'], owner['name'], pdf, str(record['_id']), reports.care_guidance('High'))
            message = server.send_message.call_args.args[0]
            self.assertEqual(message['To'], owner['email'])
            self.assertIn('visionai@example.com', message['From'])
            attachment = list(message.iter_attachments())[0]
            self.assertEqual(attachment.get_content_type(), 'application/pdf')
            self.assertEqual(attachment.get_payload(decode=True), pdf)
            self.assertIn('not a confirmed diagnosis', message.get_body(preferencelist=('html',)).get_content())
            server.starttls.assert_called_once()

    def test_missing_smtp_configuration_fails_explicitly(self):
        with patch.object(email_service, 'SMTP_EMAIL', ''), patch.object(email_service.smtplib, 'SMTP') as smtp:
            with self.assertRaises(RuntimeError):
                email_service.send_patient_screening_email('registered@example.com', 'Sample', b'%PDF', 'sample', reports.care_guidance('Low'))
            smtp.assert_not_called()

    def test_smtp_recipient_rejection_is_not_success(self):
        with patch.object(email_service, 'SMTP_EMAIL', 'visionai@example.com'), patch.object(email_service, 'SMTP_PASSWORD', 'test-only'), patch.object(email_service.smtplib, 'SMTP') as smtp:
            smtp.return_value.__enter__.return_value.send_message.return_value = {'registered@example.com': (550, b'rejected')}
            with self.assertRaises(RuntimeError):
                email_service.send_patient_screening_email('registered@example.com', 'Sample', b'%PDF-test', 'sample', reports.care_guidance('Low'))

    def test_background_records_success_and_failure(self):
        for fails in (False, True):
            record, owner = fixture()
            record['email'] = 'untrusted@example.com'
            with patch.object(reports.patients_collection, 'find_one_and_update', AsyncMock(return_value=record)), patch.object(reports.patients_collection, 'update_one', AsyncMock()) as update, patch.object(reports, 'report_context', AsyncMock(return_value=(owner, None))), patch.object(email_service, 'send_patient_screening_email', side_effect=RuntimeError('secret credentials must not leak') if fails else None) as send:
                asyncio.run(reports.deliver_screening_email(str(record['_id']), record['user_id']))
                self.assertEqual(send.call_args.args[0], owner['email'])
                state = update.call_args.args[1]['$set']['report_email']
                self.assertEqual(state['status'], 'failed' if fails else 'sent')
                self.assertNotIn('secret credentials', str(state))

    def test_duplicate_background_job_does_not_send(self):
        with patch.object(reports.patients_collection, 'find_one_and_update', AsyncMock(return_value=None)), patch.object(email_service, 'send_patient_screening_email') as send:
            asyncio.run(reports.deliver_screening_email(str(ObjectId()), str(ObjectId())))
            send.assert_not_called()

    def test_queue_claim_filters_owner_and_active_or_sent_jobs(self):
        record, owner = fixture()
        record['report_email']['status'] = 'sent'
        with patch.object(reports, 'owned_screening', AsyncMock(return_value=record)), patch.object(reports.patients_collection, 'find_one_and_update', AsyncMock(return_value=None)) as reserve:
            queued, state = asyncio.run(reports.queue_email(str(record['_id']), str(owner['_id'])))
            self.assertFalse(queued)
            self.assertEqual(state['status'], 'sent')
            query = reserve.call_args.args[0]
            self.assertEqual(query['user_id'], str(owner['_id']))
            self.assertIn('sent', query['$or'][0]['report_email.status']['$nin'])

    def test_assessment_returns_saved_screening_id_and_queued_state(self):
        payload = PatientRiskInput(name='Sample', age=12, gender='Female', screen_time=2, reading_time=1, work_hours=0, sleep_hours=8, outdoor_activity=2, parental_myopia=0)
        identity = ObjectId()
        with patch.object(patient_service, 'calculate_risk', return_value=('Low', 'advice', .12, None)), patch.object(patient_service.patients_collection, 'insert_one', AsyncMock(return_value=Mock(inserted_id=identity))) as insert:
            result = asyncio.run(patient_service.assess_patient_risk(str(ObjectId()), payload))
            self.assertEqual(result['screening_id'], str(identity))
            self.assertEqual(result['report_email']['status'], 'queued')
            self.assertEqual(insert.call_args.args[0]['myopia_probability'], .12)


class ReportRouteTests(unittest.TestCase):
    def setUp(self):
        self.record, self.owner = fixture()
        app.dependency_overrides[get_current_user] = lambda: self.owner
        self.client = TestClient(app)
        self.url = f"/patient/screening-report/{self.record['_id']}"

    def tearDown(self):
        app.dependency_overrides.clear()

    def test_download_private_pdf_does_not_email(self):
        with patch.object(reports.patients_collection, 'find_one', AsyncMock(return_value=self.record)) as find, patch('routes.patient.report_context', AsyncMock(return_value=(self.owner, None))), patch.object(email_service, 'send_patient_screening_email') as send:
            response = self.client.get(self.url)
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.headers['content-type'], 'application/pdf')
            self.assertEqual(response.headers['cache-control'], 'no-store')
            self.assertTrue(response.content.startswith(b'%PDF'))
            self.assertEqual(find.call_args.args[0]['user_id'], str(self.owner['_id']))
            send.assert_not_called()

    def test_cross_patient_access_rejected_for_every_route(self):
        with patch.object(reports.patients_collection, 'find_one', AsyncMock(return_value=None)), patch.object(email_service, 'send_patient_screening_email') as send:
            for method, suffix in [('get', ''), ('get', '/status'), ('post', '/email')]:
                self.assertEqual(getattr(self.client, method)(self.url + suffix).status_code, 404)
            send.assert_not_called()

    def test_invalid_id_rejected(self):
        self.assertEqual(self.client.get('/patient/screening-report/invalid').status_code, 422)

    def test_email_requires_authentication(self):
        app.dependency_overrides.clear()
        self.assertEqual(self.client.post(self.url + '/email').status_code, 401)

    def test_risk_route_schedules_email_and_returns_guidance(self):
        result = dict(screening_id=str(self.record['_id']), risk_level='High', myopia_probability=.82, report_email={'status': 'queued'})
        payload = dict(name='Sample', age=12, gender='Female', screen_time=2, reading_time=1, work_hours=0, sleep_hours=8, outdoor_activity=2, parental_myopia=0)
        with patch('routes.patient.assess_patient_risk', AsyncMock(return_value=result)), patch('routes.patient.deliver_screening_email', AsyncMock()) as deliver:
            response = self.client.post('/patient/risk', json=payload)
            self.assertEqual(response.status_code, 200)
            self.assertIn('care_guidance', response.json()['data'])
            deliver.assert_awaited_once_with(str(self.record['_id']), str(self.owner['_id']))

    def test_retry_schedules_only_a_successfully_claimed_job(self):
        for queued in (True, False):
            with patch('routes.patient.queue_email', AsyncMock(return_value=(queued, {'status': 'queued' if queued else 'sent'}))), patch('routes.patient.deliver_screening_email', AsyncMock()) as deliver:
                response = self.client.post(self.url + '/email')
                self.assertEqual(response.status_code, 200)
                self.assertEqual(deliver.await_count, int(queued))


if __name__ == '__main__':
    unittest.main()
