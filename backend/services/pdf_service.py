"""
Real PDF Report Generator using ReportLab
Generates hospital-grade clinical PDF reports for myopia & retinal screenings.
"""
from pathlib import Path
from datetime import datetime
from typing import Dict, Any
import re

REPORTS_DIR = Path(__file__).parent.parent / "reports"
REPORTS_DIR.mkdir(parents=True, exist_ok=True)
LOGO_PATH = Path(__file__).resolve().parents[2] / "Frontend" / "public" / "sarveshwar-eye.png"


def _fmt_num(val, suffix="", decimals=2):
    if val is None or val == "N/A" or val == "":
        return "Not recorded"
    try:
        return f"{float(val):.{decimals}f}{suffix}"
    except (TypeError, ValueError):
        return f"{val}{suffix}"


def generate_pdf_report(patient_data: Dict[str, Any], report_data: Dict[str, Any]) -> str:
    """
    Generate a clean, hospital-grade PDF report for a patient's clinical evaluation.
    Returns the file path string.
    """
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib import colors
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import cm
        from reportlab.platypus import (
            SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable, Image
        )
        from reportlab.lib.enums import TA_CENTER, TA_LEFT

        patient_id = str(patient_data.get("id", "unknown"))
        raw_name = str(patient_data.get("name", "Patient") or "Patient")
        safe_name = re.sub(r"[^A-Za-z0-9]+", "_", raw_name).strip("_") or "Patient"
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"{safe_name}_Clinical_Report_{timestamp}.pdf"
        filepath = REPORTS_DIR / filename

        doc = SimpleDocTemplate(
            str(filepath),
            pagesize=A4,
            rightMargin=1.8 * cm,
            leftMargin=1.8 * cm,
            topMargin=1.8 * cm,
            bottomMargin=1.8 * cm,
            title="Shri Sarveshwar Netralaya - Vision AI Clinical Report",
            author="Vision AI",
        )

        styles = getSampleStyleSheet()
        hospital_style = ParagraphStyle(
            "HospitalTitle", parent=styles["Normal"],
            fontName="Helvetica-Bold", fontSize=16, leading=20,
            textColor=colors.HexColor("#123760"), alignment=TA_LEFT,
        )
        sub_style = ParagraphStyle(
            "SubTitle", parent=styles["Normal"],
            fontName="Helvetica", fontSize=9.5, leading=13,
            textColor=colors.HexColor("#475569"), alignment=TA_LEFT,
        )
        section_style = ParagraphStyle(
            "Section", parent=styles["Normal"],
            fontName="Helvetica-Bold", fontSize=11.5, leading=15,
            textColor=colors.HexColor("#123760"), spaceBefore=12, spaceAfter=6,
        )
        normal_style = ParagraphStyle(
            "Normal2", parent=styles["Normal"],
            fontName="Helvetica", fontSize=9.5, leading=14,
            textColor=colors.HexColor("#334155"),
        )
        badge_style = ParagraphStyle(
            "BadgeText", parent=styles["Normal"],
            fontName="Helvetica-Bold", fontSize=9.5, leading=14,
            textColor=colors.HexColor("#1E293B"),
        )

        severity = str(report_data.get("severity", "Low"))
        sev_color = {
            "High": colors.HexColor("#B91C1C"),
            "Moderate": colors.HexColor("#B45309"),
            "Medium": colors.HexColor("#B45309"),
        }.get(severity, colors.HexColor("#0F766E"))

        story = []

        # ── Hospital Header with Logo ─────────────────────────────────────────
        header_info = [
            Paragraph("SHRI SARVESHWAR NETRALAYA  |  VISION AI", hospital_style),
            Paragraph(
                "Department of Ophthalmology & Clinical Myopia Screening<br/>"
                "Plot No. 5, Mitra Nagar, near Gurudwara, Jalna Road, Chhatrapati Sambhajinagar<br/>"
                "Tel: +91 98819 36866 / (0240) 2322370  ·  Hours: Mon–Sat, 10:00 AM – 7:00 PM IST",
                sub_style,
            ),
        ]
        if LOGO_PATH.is_file():
            logo_img = Image(str(LOGO_PATH), width=3.9 * cm, height=1.3 * cm)
            header_table = Table([[logo_img, header_info]], colWidths=[4.3 * cm, 13.1 * cm])
            header_table.setStyle(TableStyle([
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ]))
            story.append(header_table)
        else:
            story.extend(header_info)
        story.append(Spacer(1, 0.25 * cm))
        story.append(HRFlowable(width="100%", thickness=2, color=colors.HexColor("#123760")))
        story.append(Spacer(1, 0.35 * cm))

        # ── Patient & Report Metadata ─────────────────────────────────────────
        now = datetime.now()
        review_status = str(report_data.get("review_status", "preliminary")).replace("_", " ").title()
        attending_doc = report_data.get("signed_off_by_name") or report_data.get("assigned_doctor_name") or "Assigned Ophthalmologist"
        meta_data = [
            ["Report ID", f"VAI-{patient_id[-6:].upper()}-{now.strftime('%m%d')}",
             "Generated On", now.strftime("%d %b %Y, %I:%M %p")],
            ["Patient Name", str(patient_data.get("name", "N/A")),
             "Age / Gender", f"{patient_data.get('age', 'N/A')} yrs / {patient_data.get('gender', 'N/A')}"],
            ["Assigned Doctor", str(attending_doc),
             "Clinician Verdict", f"{report_data.get('doctor_verdict', 'Pending')} ({review_status})"],
        ]
        meta_table = Table(meta_data, colWidths=[3.5 * cm, 5.5 * cm, 3.5 * cm, 4.9 * cm])
        meta_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F8FAFC")),
            ("TEXTCOLOR", (0, 0), (-1, -1), colors.HexColor("#334155")),
            ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
            ("FONTNAME", (2, 0), (2, -1), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
            ("PADDING", (0, 0), (-1, -1), 6),
        ]))
        story.append(meta_table)
        story.append(Spacer(1, 0.35 * cm))

        # ── Clinical Biometry & Fundus Summary ────────────────────────────────
        story.append(Paragraph("1. Clinical Biometry & AI Screening Summary", section_style))

        prob = report_data.get("confidence", 0)
        prob_pct = f"{float(prob) * 100:.1f}%" if isinstance(prob, (int, float)) else str(prob)

        fundus_pred = str(report_data.get("fundus_prediction", "N/A"))
        fundus_conf = report_data.get("fundus_confidence")
        fundus_str = (
            f"{fundus_pred} ({float(fundus_conf) * 100:.1f}%)"
            if isinstance(fundus_conf, (int, float))
            else fundus_pred
        )
        if report_data.get("fundus_review_required"):
            fundus_str += " [Specialist Review Flagged]"

        diag_data = [
            ["Clinical Parameter", "Measured / Estimated Value", "Clinical Context"],
            ["Myopia Severity Risk", severity, "XGBoost Clinical Model"],
            ["Myopia Risk Probability", prob_pct, "Model Probability Score"],
            ["Axial Length (AL)", _fmt_num(report_data.get("axial_length"), " mm"), "Ocular Biometry"],
            ["Spherical Equivalent (SPHEQ)", _fmt_num(report_data.get("current_spheq"), " D"), "Current Refraction"],
            ["Predicted Next SPHEQ", _fmt_num(report_data.get("predicted_next_spheq"), " D"), "Estimated Next-Visit Drift"],
            ["Progression Velocity", str(report_data.get("progression_rate", "N/A")), "Longitudinal Risk Tier"],
            ["Retinal Fundus AI (PALM)", fundus_str, "EfficientNet-B0 + Grad-CAM++"],
        ]
        diag_table = Table(diag_data, colWidths=[5.4 * cm, 5.4 * cm, 6.6 * cm])
        diag_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#123760")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("FONTNAME", (0, 1), (0, -1), "Helvetica-Bold"),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
            ("PADDING", (0, 0), (-1, -1), 6.5),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
            ("TEXTCOLOR", (1, 1), (1, 1), sev_color),
            ("FONTNAME", (1, 1), (1, 1), "Helvetica-Bold"),
        ]))
        story.append(diag_table)
        story.append(Spacer(1, 0.35 * cm))

        # ── Patient Lifestyle Profile ─────────────────────────────────────────
        story.append(Paragraph("2. Lifestyle & Genetic Risk Profile", section_style))
        parental_idx = 0
        try:
            parental_idx = max(0, min(2, int(patient_data.get("parental_myopia", 0))))
        except (TypeError, ValueError):
            parental_idx = 0

        lifestyle_data = [
            ["Factor", "Reported Value", "Factor", "Reported Value"],
            ["Daily Screen Time", f"{patient_data.get('screen_time', 'N/A')} hrs/day",
             "Near Reading Time", f"{patient_data.get('reading_time', 'N/A')} hrs/day"],
            ["Outdoor Daylight", f"{patient_data.get('outdoor_activity', 'N/A')} hrs/day",
             "Sleep Duration", f"{patient_data.get('sleep_hours', 'N/A')} hrs/day"],
            ["Parental Myopia", ["None", "1 Parent", "2 Parents"][parental_idx],
             "Study / Work Hours", f"{patient_data.get('work_hours', 'N/A')} hrs/day"],
        ]
        ls_table = Table(lifestyle_data, colWidths=[4.2 * cm, 4.5 * cm, 4.2 * cm, 4.5 * cm])
        ls_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1E293B")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("FONTNAME", (0, 1), (0, -1), "Helvetica-Bold"),
            ("FONTNAME", (2, 1), (2, -1), "Helvetica-Bold"),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
            ("PADDING", (0, 0), (-1, -1), 6.5),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
        ]))
        story.append(ls_table)
        story.append(Spacer(1, 0.35 * cm))

        # ── Clinical Recommendation & Doctor Note ─────────────────────────────
        story.append(Paragraph("3. Clinical Guidance & Care Plan", section_style))
        recs = {
            "High": (
                "HIGH RISK — URGENT CONSULTATION RECOMMENDED: Clinical and/or biometric indicators show elevated "
                "myopia progression risk. Schedule a comprehensive dilated ophthalmic examination within 4 weeks to "
                "evaluate myopia control options (specialty lenses, atropine therapy, or orthokeratology)."
            ),
            "Moderate": (
                "MODERATE RISK — MONITORING ADVISED: Schedule a follow-up eye examination within 3 months. "
                "Encourage at least 2 hours of daily outdoor daylight, enforce the 20-20-20 screen break rule, "
                "and maintain proper reading distance (35–40 cm)."
            ),
            "Medium": (
                "MODERATE RISK — MONITORING ADVISED: Schedule a follow-up eye examination within 3 months. "
                "Encourage at least 2 hours of daily outdoor daylight, enforce the 20-20-20 screen break rule, "
                "and maintain proper reading distance (35–40 cm)."
            ),
            "Low": (
                "LOW RISK — ROUTINE CARE: Current screening indicators are within a lower-risk range. "
                "Continue annual routine eye check-ups, balanced screen habits, and daily outdoor activity."
            ),
        }
        story.append(Paragraph(recs.get(severity, recs["Low"]), badge_style))

        clinical_note = report_data.get("clinical_note")
        signed_by = report_data.get("signed_off_by_name")
        if clinical_note or signed_by:
            story.append(Spacer(1, 0.25 * cm))
            note_text = f"<b>Attending Clinician ({signed_by or 'Registered Ophthalmologist'}):</b> {clinical_note or 'Reviewed and signed off.'}"
            story.append(Paragraph(note_text, normal_style))

        story.append(Spacer(1, 0.45 * cm))

        # ── Footer ────────────────────────────────────────────────────────────
        story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#CBD5E1")))
        story.append(Spacer(1, 0.2 * cm))
        story.append(Paragraph(
            "CONFIDENTIAL MEDICAL REPORT · Generated by Vision AI at Shri Sarveshwar Netralaya. "
            "AI outputs are clinical decision-support tools and do not replace an in-person ophthalmic diagnosis. "
            "Seek urgent care immediately for sudden vision loss, flashes, or new floaters.",
            ParagraphStyle("Footer", parent=styles["Normal"], fontSize=7.5, leading=10.5,
                           textColor=colors.HexColor("#64748B"), alignment=TA_CENTER),
        ))

        doc.build(story)
        return str(filepath)

    except Exception as e:
        print(f"[PDF] Error generating report: {e}")
        return ""
