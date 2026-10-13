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
    def setUp(self):
        provider = patch.object(chat, 'CHATBOT_PROVIDER', 'openai')
        provider.start()
        self.addCleanup(provider.stop)

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


class GroqTests(unittest.TestCase):
    def test_groq_uses_own_endpoint_key_and_model(self):
        reply = httpx.Response(200, json={'choices': [{'message': {'content': 'Groq test response'}}]}, request=httpx.Request('POST', chat.GROQ_URL))
        with patch.object(chat, 'CHATBOT_PROVIDER', 'groq'), patch.object(chat, 'GROQ_API_KEY', 'groq-test-only'), patch.object(chat.httpx, 'post', return_value=reply) as post:
            self.assertEqual(chat.get_chatbot_response('नमस्कार'), 'Groq test response')
            self.assertEqual(post.call_args.args[0], 'https://api.groq.com/openai/v1/chat/completions')
            self.assertEqual(post.call_args.kwargs['headers']['Authorization'], 'Bearer groq-test-only')
            self.assertEqual(post.call_args.kwargs['json']['model'], chat.GROQ_MODEL)
            self.assertIn('everyday Marathi', post.call_args.kwargs['json']['messages'][0]['content'])

    def test_missing_groq_key_does_not_fall_back_to_openai(self):
        with patch.object(chat, 'CHATBOT_PROVIDER', 'groq'), patch.object(chat, 'GROQ_API_KEY', ''), patch.object(chat, 'OPENAI_API_KEY', 'other-provider-key'), patch.object(chat.httpx, 'post') as post:
            with self.assertRaises(HTTPException) as error:
                chat.get_general_chatbot_response('Hello')
            self.assertIn('GROQ_API_KEY', error.exception.detail)
            post.assert_not_called()

    def test_groq_errors_are_actionable_and_do_not_expose_secrets(self):
        for code in (400, 401, 404, 429, 500):
            response = httpx.Response(code, json={'error': 'private-details'}, request=httpx.Request('POST', chat.GROQ_URL))
            with self.subTest(code=code), patch.object(chat, 'CHATBOT_PROVIDER', 'groq'), patch.object(chat, 'GROQ_API_KEY', 'secret-test-only'), patch.object(chat.httpx, 'post', return_value=response):
                with self.assertRaises(HTTPException) as error:
                    chat.get_chatbot_response('Hello')
                self.assertEqual(error.exception.status_code, 503)
                self.assertNotIn('private-details', error.exception.detail)
                self.assertNotIn('secret-test-only', error.exception.detail)

    def test_saved_chat_identifies_groq(self):
        import asyncio
        from schemas.chatbot import ChatQuery
        with patch.object(chat, 'CHATBOT_PROVIDER', 'groq'), patch.object(chat, 'get_chatbot_response', return_value='Reply'), patch.object(chat.chat_history_collection, 'insert_one', new_callable=AsyncMock) as save:
            asyncio.run(chat.process_chat_query('synthetic-user', ChatQuery(message='Hello')))
            self.assertEqual(save.call_args.args[0]['provider'], 'groq')
            self.assertEqual(save.call_args.args[0]['model'], chat.GROQ_MODEL)

    def test_invalid_provider_is_rejected(self):
        with patch.object(chat, 'CHATBOT_PROVIDER', 'grok'), patch.object(chat.httpx, 'post') as post:
            with self.assertRaises(HTTPException):
                chat.get_chatbot_response('Hello')
            post.assert_not_called()
