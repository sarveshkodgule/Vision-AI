"""Generate synthetic report examples locally. No database calls or emails.

Run with the backend virtual environment. Optional --render needs pymupdf.
"""
import argparse
from pathlib import Path
from bson import ObjectId
from services.patient_report_service import make_patient_pdf


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--render', action='store_true')
    args = parser.parse_args()
    directory = Path(__file__).resolve().parent / 'reports' / 'previews'
    directory.mkdir(parents=True, exist_ok=True)
    for risk, probability in [('Low', .15), ('Medium', .55), ('High', .82)]:
        record = dict(_id=ObjectId('000000000000000000000001'), name='Sample Patient (demonstration)',
                      age=12, gender='Female', created_at='2026-10-01T10:30:00', risk_level=risk,
                      myopia_probability=probability, screen_time=4, reading_time=2,
                      outdoor_activity=1, sleep_hours=8, parental_myopia=1)
        owner = {'name': record['name'], 'email': 'sample.patient@example.com'}
        pdf = make_patient_pdf(record, owner)
        path = directory / f'VisionAI_Sample_{risk}.pdf'
        path.write_bytes(pdf)
        print(path)
        if args.render:
            import pymupdf
            with pymupdf.open(stream=pdf, filetype='pdf') as document:
                print(f'  {len(document)} pages')
                for index, page in enumerate(document):
                    page.get_pixmap(matrix=pymupdf.Matrix(1.2, 1.2)).save(directory / f'{risk}_page_{index+1}.png')


if __name__ == '__main__':
    main()
