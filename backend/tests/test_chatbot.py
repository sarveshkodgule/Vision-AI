"""OpenAI integration checks without network requests or real credentials."""
from pathlib import Path
import sys
import unittest
from unittest.mock import AsyncMock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import httpx
from fastapi import HTTPException
from fastapi.testclient import TestClient
from main import app
from services import chatbot_service as chat


class OpenAITests(unittest.TestCase):
    def test_missing_key_is_explicit(self):
        with patch.object(chat, 'OPENAI_API_KEY', ''), patch.object(chat.httpx, 'post') as post:
            with self.assertRaises(HTTPException) as error:
                chat.get_general_chatbot_response('Hello')
            self.assertEqual(error.exception.status_code, 503)
            post.assert_not_called()

    def test_provider_success_reaches_public_route(self):
        reply = httpx.Response(200, json={'choices': [{'message': {'content': 'GPT reply'}}]}, request=httpx.Request('POST', chat.OPENAI_URL))
        with patch.object(chat, 'OPENAI_API_KEY', 'test-only'), patch.object(chat.httpx, 'post', return_value=reply) as post, patch('routes.chatbot.chat_history_collection.insert_one', new_callable=AsyncMock):
            response = TestClient(app).post('/chatbot/general', json={'message': 'Hello'})
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()['data']['response'], 'GPT reply')
            self.assertEqual(post.call_args.kwargs['headers']['Authorization'], 'Bearer test-only')
            self.assertEqual(post.call_args.kwargs['json']['model'], chat.OPENAI_MODEL)
            self.assertEqual(post.call_args.kwargs['json']['messages'][-1]['content'], 'Hello')

    def test_provider_errors_have_no_fallback_or_secret(self):
        for code in [401, 403, 429, 500]:
            reply = httpx.Response(code, json={'error': 'private-provider-message'}, request=httpx.Request('POST', chat.OPENAI_URL))
            with self.subTest(code=code), patch.object(chat, 'OPENAI_API_KEY', 'test-only'), patch.object(chat.httpx, 'post', return_value=reply):
                with self.assertRaises(HTTPException) as error:
                    chat.get_chatbot_response('Hello')
                self.assertEqual(error.exception.status_code, 503)
                self.assertNotIn('test-only', error.exception.detail)
                self.assertNotIn('private-provider-message', error.exception.detail)

    def test_timeout_and_malformed_response(self):
        with patch.object(chat, 'OPENAI_API_KEY', 'test-only'), patch.object(chat.httpx, 'post', side_effect=httpx.ReadTimeout('timeout')):
            with self.assertRaises(HTTPException) as error:
                chat.get_chatbot_response('Hello')
            self.assertEqual(error.exception.status_code, 504)
        reply = httpx.Response(200, json={'choices': []}, request=httpx.Request('POST', chat.OPENAI_URL))
        with patch.object(chat, 'OPENAI_API_KEY', 'test-only'), patch.object(chat.httpx, 'post', return_value=reply):
            with self.assertRaises(HTTPException) as error:
                chat.get_chatbot_response('Hello')
            self.assertEqual(error.exception.status_code, 503)

    def test_empty_message_is_rejected(self):
        self.assertEqual(TestClient(app).post('/chatbot/general', json={'message': '   '}).status_code, 422)
