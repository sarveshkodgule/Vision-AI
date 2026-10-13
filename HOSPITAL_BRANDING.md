# Shri Sarveshwar Netralaya website

Research and implementation: 7 October 2026 (Asia/Calcutta).

Patient experience and optional Google authentication update: 13 October 2026. See [HOSPITAL_WEBSITE_REVIEW.md](HOSPITAL_WEBSITE_REVIEW.md) for implemented features, remaining hospital capabilities and verification limitations, and [GOOGLE_SIGN_IN_SETUP.md](GOOGLE_SIGN_IN_SETUP.md) for activation steps.

The user confirmed this is the hospital on Jalna Road, Mitra Nagar, Chhatrapati Sambhajinagar (Aurangabad), associated with Dr. Hemant Anaspure. Public listings also spell the name **Sri Sarveshwar Netralaya**.

## What changed

- Rebuilt Home, About and Contact with a shared hospital header/footer, responsive navigation, a navy, warm-white and burgundy theme, serif headings, the supplied hospital eye emblem, and consistent wordmark.
- Added the hospital address, click-to-call appointment enquiries, Google Maps directions, doctor profile and qualification reference, visit preparation, FAQs, urgent-symptom guidance, and patient portal links.
- Replaced the old placeholder US contact details and contact form that showed a successful send without transmitting anything. Appointments are arranged by telephone; the website does not claim to book them.
- Applied the identity and accent palette to login, registration, password reset, and patient/doctor dashboards, including chart accent colours. Model outputs, risk colours, Grad-CAM, screening APIs, report delivery and authentication services were not changed.
- Kept the public chatbot connected to the existing `/chatbot/general` endpoint, with clear error handling. Signed-in visitors can now view the hospital homepage without being immediately redirected to the dashboard.
- Added a hospital favicon, page title, description, visible keyboard focus, skip link, reduced-motion CSS, and native accessible FAQ disclosures.

## Research and source limits

| Detail | Source | How it is used |
| --- | --- | --- |
| Hospital name, Plot No. 5 / Mitra Nagar / Jalna Road address and 9881936866 public contact | [BharatiBiz listing](https://www.bharatibiz.com/en/sri-sarveshwar-netralaya-098819-36866), corroborated by [healthFROG](https://www.healthfrog.in/doctor/sri-sarveshwar-netralaya-aurangabad-maharashtra-jo6ckigrb.html) | Contact cards, footer and directions. These are public directory details, not independently confirmed by phone. |
| Dr. Hemant Anaspure’s association with the hospital and ophthalmology practice | [Justdial doctor listing](https://www.justdial.com/Aurangabad-Maharashtra/Dr-Hemant-Anaspure-Sri-Sarveshwar-Netralaya-Near-Gurudwara-Monda-Naka-Mitra-Nagar-Jalna-Road-Aurangabad/9999PX240-X240-150728150300-N4V7_BZDET) | About page and homepage doctor link. User also confirmed the hospital identity. |
| MBBS, MS (Ophthalmology), FCPS (Ophthalmology) | [Maharashtra Medical Council 2025 Aurangabad roll, printed page 15](https://maharashtramedicalcouncil.in/Files/AURANGABAD.pdf#page=15), corroborated in [MMC 2020 register](https://maharashtramedicalcouncil.in/Files/Register_30062020.pdf) under ANASPURE HEMANT DEVIDASRAO | Qualification line only. No residential address is reproduced. Historical qualification records do not imply a current licensing-status check. |
| Urgent symptoms of retinal detachment | [National Eye Institute](https://www.nei.nih.gov/eye-health-information/eye-conditions-and-diseases/retinal-detachment) | Brief urgent-care guidance, without claiming emergency coverage at this hospital. |

Public listings disagree on operating hours, so exact hours are omitted and visitors are asked to call. No official hospital email, confirmed procedure list, facility photos, doctor portrait, accreditation, patient counts, treatment outcomes or testimonials were verified; none were invented.

No verifiable official hospital website or downloadable logo was found during the initial research. The user subsequently supplied hospital artwork and identified its eye emblem as the hospital logo. The website now uses a cleaned adaptation of that eye alone, preserving its black curves and burgundy centre, without the poster text or background. This is an AI-assisted raster adaptation, not an official vector master. The navy/warm-white palette, burgundy accents and typography remain proposed website styling. The doctor initials are a neutral graphic, not a portrait. The Marathi wordmark spells the hospital name; the interface remains English.

## Maintaining the content

### Second design refinement

- Replaced the static homepage care cards with an interactive three-path guide: hospital visits, screening and finding reports. Tabs support arrow keys, Home/End and screen-reader relationships.
- Added a doctor introduction panel, subtle hero animation, warmer surfaces, refined typography and button feedback. Reduced-motion preferences disable CSS motion.
- Added fixed mobile call/portal actions, Escape-to-close navigation, an appointment preparation checklist with progress, and a copy-address button with success/failure feedback.
- Improved the patient portal's mobile tabs, input wording and screening progress. Mobile chat opens from the header, with a viewport-sized panel, so the launcher does not cover form buttons.
- Made the doctor's patient search filter real loaded records by name or ID, with clear empty/no-match states and a reset action. The table scrolls within its container on small screens. The header report icon now opens screening reports; the decorative unread dot was removed.
- Removed stray text before the HTML doctype to restore standards-mode rendering.
- Extended browser checks to exercise care tabs by mouse/keyboard, checklist completion, copied address, menu dismissal, mobile chat, patient search by name/ID and mobile doctor layout. External requests and clipboard writes are mocked in these checks.

- `Frontend/src/lib/hospital.js`: central hospital contact, doctor and source information, plus patient FAQs.
- `Frontend/src/components/HospitalBrand.jsx` and `Frontend/public/sarveshwar-eye.png`: shared wordmark and transparent eye emblem. The same PNG is used for the favicon, homepage and About page. The earlier `hospital-mark.svg` is no longer referenced by the website.
- `Frontend/src/components/HospitalLayout.jsx`: shared public header, mobile menu and footer.
- `Frontend/src/hospital.css`: responsive public site theme; `tailwind.config.js` also maps existing blue/indigo portal accents to the hospital palette.
- PDF and SMTP services retain their existing Vision AI branding and configured sender. This website update does not alter credentials or send mail.

### Navy and burgundy theme refinement

- Replaced the green decorative palette across public pages, authentication, patient and doctor portals, chatbot, navigation and chart accents.
- Midnight navy (`#17365d`) anchors buttons and navigation; warm white (`#faf9f7`) and pale blue surfaces provide contrast; burgundy (`#823c46`) connects editorial accents to the supplied logo.
- Renamed hospital CSS colour tokens to semantic primary/accent names; updated Tailwind portal palettes, shared form tokens and browser theme colour. Medical risk and success indicators retain their semantic colours.
- Removed the dotted page texture and added a subtle navy hero gradient and header shadow.
- Verified with lint, production build and the existing mocked browser smoke checks at desktop and mobile widths.

### Hospital eye asset

- Source: hospital poster attached by the user in this conversation, specifically its large lower eye emblem.
- Method: built-in image generation/editing tool, with the attached poster as reference and transparent background enabled; no CLI generation.
- Saved asset: `Frontend/public/sarveshwar-eye.png`, 2172 × 724 pixels, RGBA with transparency. The generated PNG was copied directly into the project.
- Presentation: burgundy hospital name beside the eye; light oval backing on dark sections keeps the black curves visible. Responsive dimensions accommodate mobile headers and compact portal branding.
- Exact editing prompt:

```text
Use case: precise-object-edit. Edit target: the most recent user-attached hospital poster. Extract ONLY the large eye emblem from the bottom half. Remove ALL poster background and ALL text. Output a clean high-resolution transparent PNG of this same emblem, centered and tightly framed on a wide canvas with about 5% empty transparent margin. Preserve its identity faithfully: asymmetric tapered black upper eyelid sweeping left and peaking above the iris then descending to a sharp right tip; black lower eyelid curving beneath; circular muted burgundy iris with the same white interlocking curved negative-space shapes and dark maroon central shape. Maintain the original geometry, proportions, orientation and black/burgundy/white colours. Clean the low-resolution edges into crisp flat smooth curves only, no stylistic redesign. No added circle, tile, frame, text, gradients, shadows or new eye details. Outside the emblem must be genuine alpha transparency; white negative-space details within the iris should stay white. Intended use: the provided hospital's website masthead and favicon.
```

## Verification

- ESLint and Vite production build.
- Playwright browser smoke check at 1440px, 390px and 320px: public pages, no horizontal overflow, mobile navigation, FAQ expansion, mocked chatbot reply, and patient/doctor portal rendering with synthetic API responses.
- Screenshots: ignored `reports/ui-preview/` directory. Browser tests do not send patient data, email or chatbot provider requests, and do not establish backend/clinical accuracy.
- Reusable smoke script: `Frontend/scripts/check-hospital-ui.cjs`. Requires a Playwright installation and its Chromium browser; it can use `PLAYWRIGHT_PACKAGE` to point at an existing Playwright package. `PREVIEW_URL` defaults to `http://127.0.0.1:5173`.
- Existing Browserslist data-age/build-timing notices may appear during build; they are not compilation failures.
