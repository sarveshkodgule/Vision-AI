# Hospital website status — 13 October 2026

## Implemented in the project

- Hospital eye logo, navy/ivory/burgundy theme, responsive navigation and mobile phone/portal actions.
- Public hospital/doctor information, directions, call links, visit checklist and patient FAQs. Calling the hospital is the actual appointment flow; there is no live booking calendar.
- A visible English/मराठी choice on the homepage. It remembers the choice and uses everyday Marathi for homepage text, care-navigation tabs, FAQs, navigation/footer and assistant controls. The same preference is used by the existing patient guidance and visit information.
- Patient screening summary explaining the result, its meaning and next action; screening is distinguished from a medical diagnosis.
- Grouped View PDF, Download and Email report actions with email status and error/retry states. Live email delivery depends on working SMTP; provider acceptance is not proof of inbox delivery.
- Patient and doctor workspaces, screening history, and optional Google sign-in below email/password login.
- A hospital gallery component is prepared, but its photo collection is currently empty. Empty galleries and failed images are hidden. Add the hospital-approved photographs when supplied; no new doctor portrait or biographical claims were added in this update.

## Still needed for a real hospital launch

1. Hospital-approved photographs, doctor biography, service descriptions, actual consultation hours, fees and accessibility information.
2. Appointment availability, hospital-confirmed bookings, cancellation and reminders if online scheduling is required.
3. Individually approved staff access, stronger authentication and a documented recovery/deprovisioning process. See `DOCTOR_SIGN_IN.md`; the current registration code is not a device passkey.
4. Clinician review of patient-facing advice, privacy/consent and retention policies, deployment access controls, backups and monitoring.
5. Full translation of remaining About/Contact page sections, authentication forms, detailed dashboard forms and PDF reports. The homepage selector does not imply that every page or AI-generated response is translated.
6. End-to-end checks of production Google origins, real SMTP, database connectivity and model assets on the deployment host. Mocked browser tests cannot establish that these external services work.

## This update's UI changes

Visible language controls, more readable Marathi heading sizes and line spacing, clearer screening context near the primary buttons, consistent rounded contact cards, softer navy hero geometry and a burgundy highlight for opened FAQs. Existing risk colours and model predictions are unchanged.

## Validation

- Frontend lint and production build passed.
- General website browser checks passed at 1440/390/320px.
- New English/Marathi homepage checks passed at 1440/1024/768/390/320px, including persisted selection, keyboard navigation, FAQs, assistant controls and mocked doctor login.
- Patient experience checks passed for report viewing/downloading/email status, retries, result guidance, language persistence and the empty gallery state.
- 25 backend authentication/API tests passed, including six staff-registration tests. These checks used synthetic identities and mocked persistence; no real email or live Google login was performed.
