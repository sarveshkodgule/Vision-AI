# Groq chatbot setup

The backend now supports Groq alongside the existing OpenAI integration. Choose one explicitly; there is no silent provider fallback. Groq (`groq.com`) and xAI's Grok are different services and use different keys.

## Activate Groq

1. Sign in at [GroqCloud](https://console.groq.com/keys) and create an API key for this project.
2. Add these settings to **backend/.env**, not the frontend:

   ```env
   CHATBOT_PROVIDER=groq
   GROQ_API_KEY=your_actual_groq_key
   GROQ_MODEL=openai/gpt-oss-20b
   ```

3. Restart the backend from the project root:

   ```powershell
   cd backend
   .\venv\Scripts\python.exe -m uvicorn main:app --reload --port 8000
   ```

4. Open the website's **Ask Vision AI** assistant. Try “What does a screening result mean?” or “मायोपिया म्हणजे काय? सोप्या भाषेत सांगा.”

No new package is required: the project already uses `httpx`. The API key stays on the backend. Do not paste it into this chat, commit it, or create a `VITE_GROQ_API_KEY`.

The model ID contains `openai/` because it identifies an open-weight model hosted by Groq. Requests go to `https://api.groq.com/openai/v1/chat/completions` and use a **Groq** key; an OpenAI API key is not required for this mode.

## What was implemented

- Explicit `CHATBOT_PROVIDER=groq` / `openai` selection, independent keys and model settings.
- Both landing-page and authenticated patient chatbot routes use the selected provider.
- Authenticated chat history records the provider and model used.
- Clear errors for missing keys, denied access, unavailable models, rate limits, malformed replies and timeouts. No hard-coded answers are presented as successful model replies.
- Instructions to answer in the patient's language, using everyday Marathi when appropriate. This remains AI-generated text and needs evaluation before clinical use.
- The assistant explains screening; it does not run the screening model, diagnose a patient, or automatically receive their medical records.

Until you configure these settings, the existing provider remains active. Changing `.env` requires restarting the backend. MongoDB must also be reachable because the chat routes save history.

## Troubleshooting

- **Missing GROQ_API_KEY:** put the key in `backend/.env`, without extra text, and restart.
- **Authentication/access failed:** confirm it is a Groq key, has not been revoked, and the project permits that model.
- **Model unavailable:** use a model enabled in your Groq project. Groq's older `llama-3.1-8b-instant` and `llama-3.3-70b-versatile` were retired for free/developer use on 16 August 2026; old tutorials may fail.
- **Usage limit:** check your project's rate/usage limits. A local retry cannot fix exhausted credits or a disabled account.
- **Database error:** check the backend MongoDB connection separately from the model API.

References checked 13 October 2026: [API reference](https://console.groq.com/docs/api-reference), [supported models](https://console.groq.com/docs/models), [model deprecations](https://console.groq.com/docs/deprecations).

## Email work is paused

Per your instruction, Gmail credential setup and live report/OTP test emails are deferred. No test emails were sent. Hospital-branded email changes are prepared locally for later, and PDF generation/view/download remain available independently of email. The existing automatic delivery hook was not changed; no new SMTP credentials were activated during this work.
