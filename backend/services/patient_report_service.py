"""Patient-owned screening PDFs and tracked, best-effort email delivery."""
import asyncio
from datetime import datetime, timezone
from html import escape
from io import BytesIO
import logging
import math
import time

from bson import ObjectId
from fastapi import HTTPException
from pymongo import ReturnDocument
from database.mongodb import patients_collection, users_collection

logger = logging.getLogger(__name__)
REPORT_VERSION = "patient-screening-v1"
SOURCES = [
    ("National Eye Institute: Myopia", "https://www.nei.nih.gov/eye-health-information/eye-conditions-and-diseases/nearsightedness-myopia"),
    ("AAPOS: Treatment of increasing myopia in children", "https://aapos.org/glossary/treatment-for-progressive-myopia"),
    ("AAPOS: Screen time and online learning", "https://aapos.org/glossary/screen-time-and-online-learning"),
    ("National Eye Institute: Retinal detachment", "https://www.nei.nih.gov/eye-health-information/eye-conditions-and-diseases/retinal-detachment"),
]


def care_guidance(risk):
    """Authored patient education selected by model risk; never a new prediction."""
    plans = {
        "Low": (
            "Low screening risk - maintain healthy habits",
            "Your model score is in the low band. This is reassuring within this screening, but it does not prove that your vision is normal or rule out myopia or another eye condition.",
            "Continue routine eye care. Arrange an eye examination if distance vision is blurry, you squint, have persistent headaches, or a child's school vision changes. Do not postpone an existing appointment because of this score.",
        ),
        "Medium": (
            "Moderate screening risk - arrange an eye examination",
            "Your model score is in the moderate band. Some of your submitted information is associated with myopia in the model. An examination is needed to determine whether myopia is present.",
            "Book a comprehensive eye examination with an optometrist or ophthalmologist. Bring this report and describe any blurred distance vision, squinting, headaches, or changes in school or work performance.",
        ),
        "High": (
            "High screening risk - contact an eye-care professional",
            "Your model score is in the high band. Contact an eye-care professional promptly for an examination. High screening risk is not the same as a diagnosis of high myopia, severe disease, or impending vision loss.",
            "Contact your assigned doctor or a local eye clinic to arrange an examination. Tell them that this questionnaire screening returned a high score and describe your symptoms; the clinic should decide appointment urgency. A high score alone is not an emergency.",
        ),
    }
    if risk == "Moderate":
        risk = "Medium"
    if risk not in plans:
        raise HTTPException(status_code=409, detail="This screening has no valid model risk result. Please complete a new assessment.")
    title, meaning, action = plans[risk]
    return {
        "title": title, "meaning": meaning, "next_step": action,
        "probability_note": "This is the model's estimated probability of myopia from your submitted lifestyle and demographic information. It is not a clinically confirmed personal chance, a future-onset forecast, or a measure of prescription strength. No eye examination or retinal diagnosis was performed by this screening.",
        "habits": [
            "For children, aim for about two hours of outdoor activity daily when safe and practical. Use appropriate sun protection and never look directly at the sun. Outdoor time may reduce the chance of developing myopia; it does not reverse an existing prescription.",
            "During reading and screen use, try the 20-20-20 habit: every 20 minutes look about 20 feet away for 20 seconds. These breaks help manage eye strain; they are not a proven cure for myopia.",
            "Use comfortable lighting and avoid holding books or phones very close to your eyes. Take breaks from prolonged near work and balance recreational screen time with other activities.",
            "Wear spectacles or contact lenses as prescribed. Do not reduce a prescription, borrow another person's glasses, or start eye drops or contact-lens treatments without professional advice.",
            "Keep regular sleep and activity routines, and ask your eye-care professional how often you or your child should be rechecked. Healthy habits support well-being but cannot guarantee that myopia will not develop or progress.",
        ],
        "doctor_discussion": [
            "Ask for an assessment of distance vision and refraction. For children, the clinician may use drops to relax focusing during the examination when appropriate.",
            "If myopia is confirmed, discuss the correct spectacle or contact-lens prescription. For children whose myopia is progressing, ask whether specialist myopia-control spectacles, contact lenses, or clinician-prescribed drops are suitable. Suitability and availability vary; this report does not prescribe a treatment.",
            "Ask whether eye-length measurements or a dilated retinal examination are appropriate, and agree on a follow-up interval based on the examination and previous prescriptions.",
        ],
        "urgent_care": "Seek urgent eye care immediately for sudden vision loss, a new curtain or shadow across vision, flashes of light, or a sudden increase in floaters. Do not wait for an email reply or a routine appointment, regardless of this report's risk band.",
        "appointment_checklist": [
            "Bring this PDF, your current glasses or lens prescription, and previous eye reports if available.",
            "Record when symptoms began, whether one or both eyes are affected, and whether distance vision or daily activities have changed.",
            "Tell the clinician about family history, medicines or eye drops, contact-lens use, and prior eye conditions. A parent or guardian should accompany a child.",
        ],
    }


async def owned_screening(screening_id, user_id):
    if not ObjectId.is_valid(screening_id):
        raise HTTPException(status_code=422, detail="Invalid screening ID")
    record = await patients_collection.find_one({"_id": ObjectId(screening_id), "user_id": str(user_id)})
    if not record:
        raise HTTPException(status_code=404, detail="Screening not found")
    return record


async def report_context(record):
    """Resolve registered contact details on the server, never from request input."""
    owner = await users_collection.find_one({"_id": ObjectId(record["user_id"])})
    if not owner:
        raise HTTPException(status_code=404, detail="Patient account not found")
    doctor = None
    assigned = record.get("assigned_doctor_id")
    if assigned and ObjectId.is_valid(assigned):
        doctor = await users_collection.find_one({"_id": ObjectId(assigned), "role": "doctor"})
    return owner, doctor


def make_patient_pdf(record, owner, doctor=None):
    """Three-page, branded patient report. Returns bytes; never exposes a file path."""
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import mm
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak

    probability = record.get("myopia_probability")
    if not isinstance(probability, (float, int)) or not math.isfinite(probability) or not 0 <= probability <= 1:
        raise HTTPException(status_code=409, detail="This screening has no valid probability. Please complete a new assessment.")
    guide = care_guidance(record.get("risk_level"))
    identity = str(record["_id"])
    output = BytesIO()
    document = SimpleDocTemplate(output, pagesize=A4, rightMargin=18*mm, leftMargin=18*mm, topMargin=24*mm, bottomMargin=20*mm,
                                 title="Vision AI Patient Screening Report", author="Vision AI")
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name="ReportBody", fontName="Helvetica", fontSize=10, leading=14, textColor=colors.HexColor("#334155"), spaceAfter=8))
    styles.add(ParagraphStyle(name="ReportHeading", fontName="Helvetica-Bold", fontSize=13, leading=17, textColor=colors.HexColor("#123760"), spaceBefore=12, spaceAfter=8))
    styles.add(ParagraphStyle(name="ReportSmall", parent=styles["ReportBody"], fontSize=8, leading=11))
    def p(value, style="ReportBody"):
        return Paragraph(escape(str(value)), styles[style])
    def section(title, texts):
        return [p(title, "ReportHeading")] + [p(text) for text in texts]
    def table(rows, widths):
        item = Table([[p(cell, "ReportSmall") for cell in row] for row in rows], colWidths=widths, hAlign="LEFT")
        item.setStyle(TableStyle([("VALIGN", (0,0),(-1,-1),"TOP"), ("BACKGROUND", (0,0),(-1,-1),colors.HexColor("#F1F5F9")),
                                 ("LINEBELOW", (0,0),(-1,-1),0.5,colors.HexColor("#CBD5E1")), ("LEFTPADDING",(0,0),(-1,-1),9),
                                 ("TOPPADDING",(0,0),(-1,-1),7), ("BOTTOMPADDING",(0,0),(-1,-1),4)]))
        return item
    def footer(canvas, doc):
        canvas.saveState()
        canvas.setFillColor(colors.HexColor("#123760"))
        canvas.setFont("Helvetica-Bold", 12)
        canvas.drawString(18*mm, A4[1]-15*mm, "VISION AI  |  EYE HEALTH")
        canvas.setStrokeColor(colors.HexColor("#CBD5E1"))
        canvas.line(18*mm, 16*mm, A4[0]-18*mm, 16*mm)
        canvas.setFont("Helvetica", 8)
        canvas.drawString(18*mm, 11*mm, "Confidential patient information | Screening guidance, not a diagnosis")
        canvas.drawRightString(A4[0]-18*mm, 11*mm, f"Page {doc.page}")
        canvas.restoreState()
    story = [p("Patient Screening & Personal Care Report", "Title"), Spacer(1, 4*mm)]
    story.append(table([
        ["Patient", record.get("name") or owner.get("name", "Patient"), "Age / gender", f"{record.get('age', 'Not provided')} / {record.get('gender', 'Not provided')}"],
        ["Report ID", f"VAI-{identity.upper()}", "Screening date", record.get("created_at", "Not recorded")],
        ["Registered email", owner.get("email", "Not recorded"), "Review status", "Automated screening; no clinician sign-off"],
    ], [26*mm, 64*mm, 27*mm, 57*mm]))
    story += section("Your result at a glance", [guide["title"], f"Model-estimated myopia probability: {probability * 100:.1f}%", guide["meaning"], guide["probability_note"]])
    story += section("Recommended next step", [guide["next_step"]])
    rows = [["Information supplied", "Value", "Information supplied", "Value"]]
    factors = [("Screen use", "screen_time"), ("Reading", "reading_time"), ("Outdoor activity", "outdoor_activity"), ("Sleep", "sleep_hours")]
    for index in (0, 2):
        left, right = factors[index:index+2]
        rows.append([left[0], f"{record.get(left[1], 'Not recorded')} hours/day", right[0], f"{record.get(right[1], 'Not recorded')} hours/day"])
    rows.append(["Parental myopia", f"{record.get('parental_myopia', 'Not recorded')} parent(s)", "Age used by model", record.get("age", "Not recorded")])
    story += [p("Your questionnaire snapshot", "ReportHeading"), table(rows, [43*mm,44*mm,43*mm,44*mm]), p("The model uses age, gender, reading, screen use, outdoor activity, sleep, and parental history. These inputs are not proof of what caused an individual's result.", "ReportSmall")]
    story += [PageBreak()]
    story += section("Understanding myopia", ["Myopia means near objects may appear clearer than distant ones because light focuses in front of the retina. An eye examination and refraction establish the diagnosis and the prescription; a lifestyle questionnaire cannot do this.", "This report does not measure eye length, prescription strength, retinal disease, or future progression. The displayed probability is a research-model output and has not been established as a calibrated clinical probability for this individual."])
    story += section("Your daily eye-care plan", guide["habits"])
    story += section("If myopia is confirmed: discuss these options", guide["doctor_discussion"])
    story += [PageBreak()]
    story += section("When to seek urgent help", [guide["urgent_care"]])
    if doctor:
        contact = [f"Assigned doctor: {doctor.get('name', 'Registered doctor')}"]
        if doctor.get("email"):
            contact.append(f"Registered doctor contact: {doctor['email']}")
        contact.append("Contact the practice to arrange an appointment and share your report through its preferred channel. A doctor assignment is not a confirmed booking. Email is not monitored for emergencies.")
    else:
        contact = ["No registered doctor contact is linked to this screening. Contact a local optometrist or ophthalmology clinic for an appointment. For a child, request a clinician experienced in children's eye care. This report does not create a booking."]
    story += section("Doctor contact and appointment guidance", contact)
    story += section("Prepare for your appointment", guide["appointment_checklist"])
    story += section("How to read the screening bands", ["Low: probability below 40%. Moderate: 40% to below 70%. High: 70% or above. These are application screening thresholds, not clinical severity grades. Even a low result cannot rule out an eye problem. Symptoms and examination findings take priority."])
    story += section("Report information", [f"Screening reference: {identity}. Content version: {REPORT_VERSION}. This automated report reflects the saved screening and provides patient education. An eye-care professional must confirm the diagnosis and recommend treatment following an examination."])
    story.append(p("Patient education sources", "ReportHeading"))
    for title, url in SOURCES:
        story.append(Paragraph(f'<a href="{escape(url, quote=True)}" color="#1D4ED8">{escape(title)}</a>', styles["ReportSmall"]))
    document.build(story, onFirstPage=footer, onLaterPages=footer)
    return output.getvalue()


def email_status(record):
    value = record.get("report_email", {})
    return {"status": value.get("status", "not_sent"), "updated_at": value.get("updated_at"), "sent_at": value.get("sent_at"), "error": value.get("error")}


async def queue_email(screening_id, user_id):
    """Reserve a send; duplicate clicks cannot enqueue duplicate mail."""
    record = await owned_screening(screening_id, user_id)
    now = time.time()
    updated = await patients_collection.find_one_and_update({
        "_id": record["_id"], "user_id": str(user_id),
        "$or": [{"report_email.status": {"$nin": ["queued", "sending", "sent"]}},
                {"report_email.status": {"$in": ["queued", "sending"]}, "report_email.updated_at": {"$lt": now-300}}],
    }, {"$set": {"report_email": {"status": "queued", "updated_at": now}}}, return_document=ReturnDocument.AFTER)
    return updated is not None, email_status(updated or record)


async def deliver_screening_email(screening_id, user_id):
    """Background task. SMTP acceptance is tracked, not claimed as inbox delivery."""
    record = await patients_collection.find_one_and_update({
        "_id": ObjectId(screening_id), "user_id": str(user_id), "report_email.status": "queued",
    }, {"$set": {"report_email.status": "sending", "report_email.updated_at": time.time()}}, return_document=ReturnDocument.AFTER)
    if not record:
        return
    try:
        from services.email_service import send_patient_screening_email
        owner, doctor = await report_context(record)
        pdf = await asyncio.to_thread(make_patient_pdf, record, owner, doctor)
        await asyncio.to_thread(send_patient_screening_email, owner["email"], record.get("name") or owner.get("name", "Patient"), pdf, screening_id, care_guidance(record["risk_level"]))
        state = {"status": "sent", "updated_at": time.time(), "sent_at": datetime.now(timezone.utc).isoformat()}
    except Exception as error:
        logger.warning("Screening report email failed (%s)", type(error).__name__)
        state = {"status": "failed", "updated_at": time.time(), "error": "Email could not be sent. You can download the PDF and retry, or contact support."}
    await patients_collection.update_one({"_id": record["_id"], "user_id": str(user_id)}, {"$set": {"report_email": state}})
