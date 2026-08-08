"""
Real PDF Report Generator using ReportLab
Generates professional clinical PDF reports for myopia screenings.
"""
from pathlib import Path
from datetime import datetime
from typing import Dict, Any

REPORTS_DIR = Path(__file__).parent.parent / "reports"
REPORTS_DIR.mkdir(parents=True, exist_ok=True)

def generate_pdf_report(patient_data: Dict[str, Any], report_data: Dict[str, Any]) -> str:
    """
    Generate a professional PDF report for a patient's clinical evaluation.
    Returns the file path string.
    """
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib import colors
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import cm
        from reportlab.platypus import (
            SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
        )
        from reportlab.lib.enums import TA_CENTER, TA_LEFT

        patient_id = str(patient_data.get("id", "unknown"))
        timestamp  = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename   = f"myopia_report_{patient_id}_{timestamp}.pdf"
        filepath   = REPORTS_DIR / filename

        doc = SimpleDocTemplate(str(filepath), pagesize=A4,
                                rightMargin=2*cm, leftMargin=2*cm,
                                topMargin=2*cm, bottomMargin=2*cm)

        styles = getSampleStyleSheet()
        title_style   = ParagraphStyle("Title2",   parent=styles["Title"],  fontSize=20, textColor=colors.HexColor("#1E3A8A"), spaceAfter=6)
        sub_style     = ParagraphStyle("SubTitle",  parent=styles["Normal"], fontSize=10, textColor=colors.HexColor("#64748B"), alignment=TA_CENTER)
        section_style = ParagraphStyle("Section",   parent=styles["Normal"], fontSize=12, textColor=colors.HexColor("#1E3A8A"), fontName="Helvetica-Bold", spaceBefore=14, spaceAfter=6)
        normal_style  = ParagraphStyle("Normal2",   parent=styles["Normal"], fontSize=10, textColor=colors.HexColor("#334155"))

        severity = str(report_data.get("severity", "Low"))
        sev_color = {"High": colors.HexColor("#DC2626"), "Moderate": colors.HexColor("#D97706"), "Medium": colors.HexColor("#D97706")}.get(severity, colors.HexColor("#059669"))

        story = []

        # ── Header ─────────────────────────────────────────────────────────────
        story.append(Paragraph("Vision AI", title_style))
        story.append(Paragraph("Myopia Detection & Clinical Analysis Report", sub_style))
        story.append(Spacer(1, 0.3*cm))
        story.append(HRFlowable(width="100%", thickness=2, color=colors.HexColor("#3B82F6")))
        story.append(Spacer(1, 0.4*cm))

        # ── Report Meta ─────────────────────────────────────────────────────────
        now = datetime.now()
        meta_data = [
            ["Report ID", f"RPT-{patient_id[-6:].upper()}-{now.strftime('%m%d')}",
             "Date Generated", now.strftime("%d %B %Y, %I:%M %p")],
            ["Patient Name", str(patient_data.get("name", "N/A")),
             "Age / Gender", f"{patient_data.get('age','N/A')} yrs / {patient_data.get('gender','N/A')}"],
        ]
        meta_table = Table(meta_data, colWidths=[4*cm, 6*cm, 4*cm, 4*cm])
        meta_table.setStyle(TableStyle([
            ("BACKGROUND",   (0,0),(-1,-1), colors.HexColor("#F1F5F9")),
            ("TEXTCOLOR",    (0,0),(-1,-1), colors.HexColor("#475569")),
            ("FONTNAME",     (0,0),(0,-1),  "Helvetica-Bold"),
            ("FONTNAME",     (2,0),(2,-1),  "Helvetica-Bold"),
            ("FONTSIZE",     (0,0),(-1,-1), 9),
            ("GRID",         (0,0),(-1,-1), 0.5, colors.HexColor("#CBD5E1")),
            ("PADDING",      (0,0),(-1,-1), 6),
            ("ROWBACKGROUNDS",(0,0),(-1,-1),[colors.HexColor("#F8FAFC"), colors.HexColor("#F1F5F9")]),
        ]))
        story.append(meta_table)
        story.append(Spacer(1, 0.5*cm))

        # ── AI Diagnosis Summary ────────────────────────────────────────────────
        story.append(Paragraph("AI Diagnostic Summary", section_style))

        prob = report_data.get("confidence", 0)
        prob_pct = f"{float(prob)*100:.1f}%" if isinstance(prob, (int, float)) else str(prob)

        diag_data = [
            ["Parameter", "Value", "Interpretation"],
            ["Myopia Severity", severity, "Model Classification"],
            ["AI Confidence", prob_pct, "Probability Score"],
            ["Predicted Next SPHEQ", f"{report_data.get('predicted_next_spheq', 'N/A')} D", "Next Visit Estimate"],
            ["Progression Rate", str(report_data.get("progression_rate", "N/A")), "Year-over-Year Change"],
            ["Doctor's Verdict", str(report_data.get("doctor_verdict", "Pending")), "Clinical Confirmation"],
        ]
        diag_table = Table(diag_data, colWidths=[6*cm, 5*cm, 7*cm])
        diag_table.setStyle(TableStyle([
            ("BACKGROUND",    (0,0),(-1,0),   colors.HexColor("#1E3A8A")),
            ("TEXTCOLOR",     (0,0),(-1,0),   colors.white),
            ("FONTNAME",      (0,0),(-1,0),   "Helvetica-Bold"),
            ("FONTSIZE",      (0,0),(-1,-1),  9),
            ("FONTNAME",      (0,1),(0,-1),   "Helvetica-Bold"),
            ("GRID",          (0,0),(-1,-1),  0.5, colors.HexColor("#CBD5E1")),
            ("PADDING",       (0,0),(-1,-1),  7),
            ("ROWBACKGROUNDS",(0,1),(-1,-1),  [colors.white, colors.HexColor("#F8FAFC")]),
            ("TEXTCOLOR",     (1,1),(1,1),    sev_color),
            ("FONTNAME",      (1,1),(1,1),    "Helvetica-Bold"),
        ]))
        story.append(diag_table)
        story.append(Spacer(1, 0.5*cm))

        # ── Patient Lifestyle ───────────────────────────────────────────────────
        story.append(Paragraph("Patient Lifestyle Factors", section_style))
        lifestyle_data = [
            ["Factor", "Value", "Factor", "Value"],
            ["Screen Time", f"{patient_data.get('screen_time', 'N/A')} hrs/day",
             "Reading Time", f"{patient_data.get('reading_time', 'N/A')} hrs/day"],
            ["Outdoor Activity", f"{patient_data.get('outdoor_activity', 'N/A')} hrs/day",
             "Sleep Hours", f"{patient_data.get('sleep_hours', 'N/A')} hrs/day"],
            ["Parental Myopia", ["None","1 Parent","2 Parents"][int(patient_data.get("parental_myopia",0))],
             "Work/Study Hours", f"{patient_data.get('work_hours', 'N/A')} hrs/day"],
        ]
        ls_table = Table(lifestyle_data, colWidths=[4.5*cm, 4*cm, 4.5*cm, 4*cm])
        ls_table.setStyle(TableStyle([
            ("BACKGROUND",    (0,0),(-1,0),  colors.HexColor("#0F172A")),
            ("TEXTCOLOR",     (0,0),(-1,0),  colors.white),
            ("FONTNAME",      (0,0),(-1,0),  "Helvetica-Bold"),
            ("FONTSIZE",      (0,0),(-1,-1), 9),
            ("FONTNAME",      (0,1),(0,-1),  "Helvetica-Bold"),
            ("FONTNAME",      (2,1),(2,-1),  "Helvetica-Bold"),
            ("GRID",          (0,0),(-1,-1), 0.5, colors.HexColor("#CBD5E1")),
            ("PADDING",       (0,0),(-1,-1), 7),
            ("ROWBACKGROUNDS",(0,1),(-1,-1), [colors.white, colors.HexColor("#F8FAFC")]),
        ]))
        story.append(ls_table)
        story.append(Spacer(1, 0.5*cm))

        # ── Recommendation ──────────────────────────────────────────────────────
        story.append(Paragraph("Clinical Recommendation", section_style))
        recs = {
            "High":     "🔴 URGENT: Patient shows high risk indicators. Immediate ophthalmology consultation recommended. Consider orthokeratology or myopia control lenses. Follow-up within 1 month.",
            "Moderate": "🟡 CAUTION: Patient shows moderate risk. Schedule follow-up within 3 months. Implement lifestyle modifications — increase outdoor activity to 2+ hrs/day, limit screen time.",
            "Medium":   "🟡 CAUTION: Patient shows moderate risk. Schedule follow-up within 3 months. Implement lifestyle modifications — increase outdoor activity to 2+ hrs/day, limit screen time.",
            "Low":      "🟢 NORMAL: Patient shows low risk. Annual screening recommended. Encourage continued healthy habits — outdoor activity, balanced screen use, adequate sleep.",
        }
        story.append(Paragraph(recs.get(severity, recs["Low"]), normal_style))
        story.append(Spacer(1, 0.5*cm))

        # ── Footer ─────────────────────────────────────────────────────────────
        story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#94A3B8")))
        story.append(Spacer(1, 0.2*cm))
        story.append(Paragraph(
            "This report was generated by Vision AI. It is intended for clinical support "
            "only and does not replace professional medical diagnosis. All findings should be "
            "reviewed by a qualified ophthalmologist.",
            ParagraphStyle("Footer", parent=styles["Normal"], fontSize=7.5, textColor=colors.HexColor("#94A3B8"), alignment=TA_CENTER)
        ))

        doc.build(story)
        return str(filepath)

    except Exception as e:
        print(f"[PDF] Error generating report: {e}")
        return ""
