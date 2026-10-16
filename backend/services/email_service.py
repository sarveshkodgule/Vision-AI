"""Hospital-branded transactional mail. Success means SMTP acceptance, not inbox delivery."""
import logging
import os
import re
import smtplib
import ssl
from email.message import EmailMessage
from email.utils import formataddr, formatdate, make_msgid
from html import escape
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env", override=False)
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com").strip()
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_EMAIL = os.getenv("SMTP_EMAIL", "").strip()
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "").strip()
HOSPITAL_NAME = "Shri Sarveshwar Netralaya"
HOSPITAL_PHONE = "+91 98819 36866"
HOSPITAL_ADDRESS = "Plot No. 5, Mitra Nagar, near Gurudwara, Jalna Road, Chhatrapati Sambhajinagar"
logger = logging.getLogger(__name__)


def _layout(kicker, title, body):
    # Table-based layout and inline styles are intentional for mail-client support.
    return f"""<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;background:#f2f5f9;font-family:Arial,sans-serif;color:#24354b">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="640" cellpadding="0" cellspacing="0" style="width:100%;max-width:640px;background:#fff;border:1px solid #d5e0ed">
<tr><td style="padding:30px;background:#17365d;color:#fff;border-top:5px solid #823c46">
<p style="font-size:11px;letter-spacing:2px;margin:0 0 12px;color:#d6e2f1">{escape(kicker)}</p>
<h1 style="font-size:25px;line-height:1.4;margin:0">{HOSPITAL_NAME}</h1>
<p style="font-size:13px;margin:10px 0 0;color:#d6e2f1">Vision AI · Patient care portal</p></td></tr>
<tr><td style="padding:30px;font-size:15px;line-height:1.8">
<h2 style="font-size:23px;line-height:1.4;margin:0 0 22px;color:#17365d">{escape(title)}</h2>
{body}
</td></tr>
<tr><td style="padding:24px 30px;background:#faf9f7;border-top:1px solid #d5e0ed;font-size:13px;line-height:1.8">
<strong>{HOSPITAL_NAME}</strong><br>{HOSPITAL_ADDRESS}<br>
Appointments: <a href="tel:+919881936866" style="color:#17365d">{HOSPITAL_PHONE}</a><br>
Please call to confirm doctor availability, timings and fees before travelling.
<p style="font-size:11px;color:#53657b;margin:16px 0 0">Confidential communication intended for the addressed recipient.
If received in error, please delete it. Do not use email for emergencies.</p>
</td></tr></table></td></tr></table></body></html>"""


def _message(recipient, subject, text, html):
    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = formataddr((f"{HOSPITAL_NAME} | Vision AI", SMTP_EMAIL))
    message["To"] = recipient
    message["Date"] = formatdate(localtime=False)
    message["Message-ID"] = make_msgid()
    message.set_content(text + f"\n\n{HOSPITAL_NAME}\n{HOSPITAL_ADDRESS}\nAppointments: {HOSPITAL_PHONE}\n"
                        "Call to confirm timings and fees. Do not use email for emergencies.\n"
                        "Confidential: if you received this in error, please delete it.")
    message.add_alternative(html, subtype="html")
    return message


def _send_message(message):
    if not SMTP_EMAIL or not SMTP_PASSWORD:
        raise RuntimeError("SMTP is not configured")
    context = ssl.create_default_context()
    smtp_type = smtplib.SMTP_SSL if SMTP_PORT == 465 else smtplib.SMTP
    options = {"timeout": 20}
    if SMTP_PORT == 465:
        options["context"] = context
    with smtp_type(SMTP_HOST, SMTP_PORT, **options) as server:
        server.ehlo()
        if SMTP_PORT != 465:
            server.starttls(context=context)
            server.ehlo()
        password = SMTP_PASSWORD.replace(" ", "") if SMTP_HOST == "smtp.gmail.com" else SMTP_PASSWORD
        server.login(SMTP_EMAIL, password)
        refused = server.send_message(message)
        if refused:
            raise RuntimeError("Mail server rejected the recipient")


def build_patient_screening_email(patient_email, patient_name, pdf_bytes, screening_id, guidance):
    if not pdf_bytes.startswith(b"%PDF"):
        raise ValueError("A valid PDF attachment is required")
    text = (
        f"Dear {patient_name},\n\nYour personal screening report is attached as a PDF.\n\n"
        f"{guidance['title']}\n{guidance['meaning']}\n\nNEXT STEP\n{guidance['next_step']}\n\n"
        "1. Read the attached PDF for the result, its meaning and daily precautions.\n"
        "2. Keep a copy with your earlier eye reports.\n"
        "3. Bring it to your eye examination and discuss it with your doctor.\n\n"
        "This automated screening is not a confirmed diagnosis or a signed clinical assessment.\n\n"
        f"URGENT SYMPTOMS\n{guidance['urgent_care']}"
    )
    body = (
        f"<p>Dear {escape(patient_name)},</p>"
        "<p>Your personal eye-health screening report is attached. Please save a copy and bring it to your next eye appointment.</p>"
        '<div style="padding:20px;background:#edf2f8;border-left:4px solid #17365d;margin:24px 0">'
        f'<h3 style="font-size:17px;margin:0 0 12px">{escape(guidance["title"])}</h3>'
        f'<p style="margin:0">{escape(guidance["meaning"])}</p></div>'
        '<h3 style="font-size:17px;color:#823c46">Your next step</h3>'
        f'<p>{escape(guidance["next_step"])}</p>'
        '<h3 style="font-size:17px;color:#17365d">Make the most of your report</h3>'
        '<ol style="padding-left:22px"><li>Read the attached PDF for your result, its meaning and daily precautions.</li>'
        '<li>Keep a copy with your earlier prescriptions and eye reports.</li>'
        '<li>Bring it to your eye examination and discuss your questions with the doctor.</li></ol>'
        '<p style="font-size:13px;color:#53657b">This is an automated screening, not a confirmed diagnosis or a signed clinical assessment.</p>'
        '<div style="padding:16px;background:#fff7f3;border:1px solid #efd1c8;font-size:13px">'
        f'<strong>When to seek urgent help</strong><br>{escape(guidance["urgent_care"])}</div>'
        '<p>With care,<br><strong>Patient Care · Vision AI</strong></p>'
    )
    message = _message(patient_email, "Your eye-health screening report | Shri Sarveshwar Netralaya",
                       text, _layout("YOUR REPORT IS READY", "Your screening. Your next steps.", body))
    safe_id = re.sub(r"[^A-Za-z0-9_-]", "_", str(screening_id))[:80]
    message.add_attachment(pdf_bytes, maintype="application", subtype="pdf", filename=f"VisionAI_Screening_{safe_id}.pdf")
    return message


def send_patient_screening_email(patient_email, patient_name, pdf_bytes, screening_id, guidance):
    """Recipient must be the account email resolved by the report service."""
    _send_message(build_patient_screening_email(patient_email, patient_name, pdf_bytes, screening_id, guidance))


def build_otp_email(user_email, otp_code, *, test=False):
    if not re.fullmatch(r"\d{6}", otp_code):
        raise ValueError("A six-digit verification code is required")
    notice = "TEST EMAIL: This code cannot sign in, register or reset an account.\n\n" if test else ""
    text = (notice + f"Your one-time verification code is: {otp_code}\n\n"
            "Use it only for the registration or password-reset request you started. "
            "It expires after 10 minutes and can be used once. Never share it. "
            "If you did not request this, ignore the email. Hospital staff will never ask you to disclose this code.")
    body = ('<p style="color:#823c46"><strong>Delivery test only. This code cannot access any account.</strong></p>' if test else "")
    body += (
        '<p>Hello,</p><p>Use this code to finish the registration or password-reset request you started:</p>'
        f'<div style="padding:20px;text-align:center;background:#edf2f8;border:1px solid #d5e0ed;font-size:32px;letter-spacing:6px;color:#17365d;font-weight:bold">{otp_code}</div>'
        '<p><strong>Valid for 10 minutes. For one use only.</strong></p>'
        '<p style="font-size:13px">Never share this code. Hospital staff will never ask you to disclose it. '
        'If you did not request it, you can ignore this email.</p>'
    )
    subject = ("[TEST] " if test else "") + "Your verification code | Shri Sarveshwar Netralaya"
    return _message(user_email, subject, text, _layout("ACCOUNT VERIFICATION", "Verify your email address", body))


def send_otp_email(user_email: str, otp_code: str) -> bool:
    try:
        _send_message(build_otp_email(user_email, otp_code))
        return True
    except Exception as error:
        logger.warning("Verification email failed (%s)", type(error).__name__)
        return False


def send_high_risk_alert(doctor_email, doctor_name, patient_name, patient_age, risk_probability) -> bool:
    try:
        pct = round(risk_probability * 100, 1)
        text = (f"Dear {doctor_name},\n\nAn assigned patient's questionnaire returned a high screening score.\n"
                f"Patient: {patient_name}\nAge: {patient_age}\nModel score: {pct}%\n\n"
                "Review the patient in your doctor portal and arrange clinical assessment as appropriate. "
                "High screening risk does not establish a diagnosis of high myopia.")
        body = (f"<p>Dear {escape(doctor_name)},</p><p>An assigned patient needs review following a high screening score.</p>"
                f"<p><strong>Patient:</strong> {escape(patient_name)}<br><strong>Age:</strong> {escape(str(patient_age))}"
                f"<br><strong>Model score:</strong> {pct}%</p>"
                "<p>Review the patient in your doctor portal and arrange clinical assessment as appropriate.</p>"
                "<p>High screening risk does not establish a diagnosis of high myopia.</p>")
        _send_message(_message(doctor_email, "Patient screening review requested | Shri Sarveshwar Netralaya",
                               text, _layout("CLINICAL WORKSPACE", "A patient screening needs review", body)))
        return True
    except Exception as error:
        logger.warning("Doctor alert email failed (%s)", type(error).__name__)
        return False


def send_pdf_report_email(patient_email: str, patient_name: str, pdf_path: str) -> bool:
    """Deliver an existing report; never claim clinician sign-off or send without its PDF."""
    try:
        pdf_file = Path(pdf_path)
        pdf = pdf_file.read_bytes()
        if not pdf.startswith(b"%PDF"):
            raise ValueError("A valid PDF attachment is required")
        text = (f"Dear {patient_name},\n\nYour eye assessment report is attached. "
                "Please discuss its findings and any treatment decisions with your ophthalmologist. "
                "An automated assessment is not a signed clinical diagnosis.")
        body = (f"<p>Dear {escape(patient_name)},</p><p>Your eye assessment report is attached as a PDF.</p>"
                "<p>Please keep it with your earlier reports and discuss its findings and any treatment decisions with your ophthalmologist.</p>"
                "<p>An automated assessment is not a signed clinical diagnosis.</p><p>With care,<br>Patient Care · Vision AI</p>")
        message = _message(patient_email, "Your eye assessment report | Shri Sarveshwar Netralaya", text,
                           _layout("YOUR REPORT IS READY", "Your eye assessment report", body))
        message.add_attachment(pdf, maintype="application", subtype="pdf", filename=pdf_file.name)
        _send_message(message)
        return True
    except Exception as error:
        logger.warning("Assessment report email failed (%s)", type(error).__name__)
        return False
