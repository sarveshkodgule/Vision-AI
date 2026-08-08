import os
import json
import urllib.request
from dotenv import load_dotenv
from database.mongodb import chat_history_collection
from schemas.chatbot import ChatQuery
from datetime import datetime

# Load .env explicitly using absolute path to prevent startup directory issues
base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
env_path = os.path.join(base_dir, ".env")
load_dotenv(dotenv_path=env_path, override=True)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent"


def _call_gemini(prompt: str) -> str:
    """Call Gemini REST API directly using only stdlib urllib - no external packages needed."""
    if not GEMINI_API_KEY:
        return None  # Signal that we should use fallback

    payload = {
        "contents": [{"parts": [{"text": prompt}]}]
    }
    data = json.dumps(payload).encode("utf-8")
    headers = {"Content-Type": "application/json"}
    if GEMINI_API_KEY.startswith("AIzaSy"):
        url = f"{GEMINI_URL}?key={GEMINI_API_KEY}"
    else:
        url = GEMINI_URL
        headers["Authorization"] = f"Bearer {GEMINI_API_KEY}"

    req = urllib.request.Request(
        url,
        data=data,
        headers=headers,
        method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            body = json.loads(resp.read().decode("utf-8"))
            return body["candidates"][0]["content"]["parts"][0]["text"]
    except Exception as e:
        print(f"[Gemini API Error] {e}")
        return None

def _call_keyless_ai(prompt: str) -> str:
    """Attempts to call a free, keyless public text model as a secondary fallback."""
    import urllib.parse
    try:
        encoded_prompt = urllib.parse.quote(prompt)
        # Using Pollinations AI keyless public text generator
        url = f"https://text.pollinations.ai/{encoded_prompt}?model=openai"
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "Mozilla/5.0"}
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            text = resp.read().decode("utf-8")
            if text and len(text.strip()) > 5:
                return text.strip()
    except Exception as e:
        print(f"[Keyless AI Error] {e}")
    return None


def get_chatbot_response(message: str) -> str:
    prompt = (
        "You are a helpful Myopia Screening Assistant for a vision AI medical application. "
        f"A logged-in patient asks: {message}. "
        "Give a concise, professional, and medically sound response about myopia, eye health, or related topics."
    )
    
    # 1. Tier 1: Gemini API (if key is configured and valid)
    result = _call_gemini(prompt)
    if result:
        return result

    # 2. Tier 2: Keyless Free Public AI (best-effort online fallback)
    keyless_result = _call_keyless_ai(prompt)
    if keyless_result:
        return keyless_result

    # 3. Tier 3: Rich Offline Fallback dictionary (100% reliable local database)
    msg = message.lower()
    
    responses = {
        ("myopia", "nearsighted"): (
            "Myopia (nearsightedness) is an ocular condition where nearby objects appear clearly, but distant objects "
            "are blurry. It is caused by the elongation of the eyeball (axial length) or excessive corneal curvature."
        ),
        ("screen", "computer", "phone", "tv"): (
            "Excessive screen time causes digital eye strain and promotes myopia progression. Practice the 20-20-20 rule: "
            "every 20 minutes, look at an object 20 feet away for at least 20 seconds to relax your eye ciliary muscles."
        ),
        ("outdoor", "sunlight", "play"): (
            "Outdoor activity in natural sunlight acts as a powerful protective factor. Sunlight stimulates the release "
            "of retinal dopamine, which scientifically limits axial elongation in children's eyes. Aim for 2 hours daily."
        ),
        ("axial", "al", "length"): (
            "Axial Length (AL) is the length of the eye from the front surface (cornea) to the retina. Elongation beyond "
            "24.5 mm significantly increases the risk of retinal complications."
        ),
        ("spheq", "refractive", "diopter", "lens"): (
            "Spherical Equivalent (SPHEQ) measures your eye's refractive power in diopters. Negative values (e.g., -3.50 D) "
            "indicate nearsightedness. Values below -6.00 D are classified as High Myopia."
        ),
        ("prevent", "stop", "reduce", "cure"): (
            "While myopia cannot be cured, its progression can be slowed. Key methods include increasing daily outdoor play, "
            "limiting continuous near-work, and medical options like low-dose atropine eye drops or orthokeratology (Ortho-K) lenses."
        ),
        ("hi", "hello", "hey"): (
            "Hello! I am your Vision AI Assistant. Ask me questions about myopia, your measurements (SPHEQ/Axial Length), "
            "lifestyle recommendations, or eye care tips!"
        ),
        ("symptom", "sign", "blurry", "vision"): (
            "Common symptoms of myopia include squinting, headaches, eye strain, and difficulty seeing distant objects clearly "
            "(such as reading a blackboard or road signs)."
        ),
        ("doctor", "report", "clinic"): (
            "You can review your detailed screening metrics inside the Reports section, where you can also download a "
            "clinical-grade PDF generated by your ophthalmologist."
        )
    }

    for keywords, response in responses.items():
        if any(kw in msg for kw in keywords):
            return response

    return (
        "I am here to help you understand myopia, axial length, refractive errors, and eye health recommendations. "
        "Please feel free to ask about these topics or consult your doctor for a complete cycloplegic evaluation."
    )


async def process_chat_query(user_id: str, query: ChatQuery):
    response_text = get_chatbot_response(query.message)
    chat_record = {
        "user_id": user_id,
        "message": query.message,
        "response": response_text,
        "timestamp": datetime.now().isoformat()
    }
    await chat_history_collection.insert_one(chat_record)
    return {"response": response_text}


def get_general_chatbot_response(message: str) -> str:
    prompt = (
        "You are a welcoming Myopia Screening Clinic AI assistant on the home page. "
        f"A prospective visitor asks: {message}. "
        "Provide a friendly, concise response about myopia, the clinic's services, or guide them to create an account."
    )
    result = _call_gemini(prompt)
    if result:
        return result

    # General / Public page fallback
    msg = message.lower()
    if "myopia" in msg or "screening" in msg:
        return "Vision AI provides rapid digital myopia screening combining retinal scan deep learning with clinical XGBoost models. Sign up to get tested!"
    elif "contact" in msg or "address" in msg or "phone" in msg:
        return "You can contact our clinical enterprise team at clinical@visionai.com or visit the Contact Us page."
    elif "signup" in msg or "register" in msg or "account" in msg:
        return "Click 'Start Evaluation' or select 'Sign Up' in the header to create your secure clinical account."
    
    return "Welcome to Vision AI! I can answer questions about myopia, explain our dual-AI scanning technology, or help you sign up for an evaluation."
