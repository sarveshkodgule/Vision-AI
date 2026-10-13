# Doctor registration code and recommended sign-in

## What exists

The current hospital code is **a staff registration code**, checked only by `POST /auth/signup`. It is not a WebAuthn passkey, a fingerprint check, or an extra factor on login. Existing doctors sign in with their own email/password or the matching Google account. The database role determines doctor access; selecting Doctor in the form cannot grant it.

## Findings and fixes (13 October 2026)

- The active backend environment had no `HOSPITAL_DOCTOR_CODE`. Previously the service silently accepted a built-in demo code. That fallback is now rejected. Missing configuration gives an explicit staff-registration message.
- A wrong hospital code used to consume the email OTP before rejecting registration. Staff authorisation is now checked first, so rejected hospital codes leave the OTP unused.
- Code comparison uses a constant-time comparison. Neither the hospital code nor email OTP is stored in the user record.
- Registration errors have an accessible alert and a way to return to correct the staff code. The doctor login form explains which password to use.
- Six isolated service tests cover missing/demo/wrong codes, OTP failures, valid registration, patient signup and existing doctor password login. No real account or email was used.

## Recommended setup for this project

Prefer individually approved doctor accounts. The project already has a local administrator command:

```powershell
cd backend
.\venv\Scripts\python.exe provision_doctor.py --email "doctor@example.com" --name "Doctor Name" --confirm-doctor
```

Replace the sample identity with the hospital-approved doctor. This command grants clinical access and should only be run by the project/hospital administrator. It was not run as part of this work. The doctor then uses **Continue with Google** with that same email. A password can be established through the existing email-verified Forgot Password flow if needed; working SMTP is required. Provision the account before the first Google login so a new account is not created as a patient.

For an existing Google login configuration, add the exact development origins to the Google OAuth Web client: `http://localhost:5173` and `http://127.0.0.1:5173`. Production needs its own HTTPS origin. A successful Google login alone does not prove that Google required MFA during that session.

If you retain the shared-code signup for a demonstration, set a private, randomly generated `HOSPITAL_DOCTOR_CODE` in `backend/.env`, restart the backend, then use **Create account → Doctor (Staff)**, the hospital code and the email OTP. The value must fit within 256 characters. Do not put it in frontend/VITE variables or share it with patients. Existing doctor login does not require this setting. No new code was generated or configured during this change.

## Best production direction

Use hospital-managed identities with enforced passkeys or MFA and an approved staff roster. With managed Google Workspace accounts, hospital administrators can enforce account security and revoke access when staff leave. Keep server-side doctor authorisation separate from the identity provider. A shared signup code proves only that someone knows the code; it does not establish that they are a doctor.

For a native **Sign in with a passkey** button, implement WebAuthn using a maintained library or identity provider:

1. Require an approved doctor account and recent authentication before enrolling a passkey.
2. Generate short-lived, single-use server challenges for enrolment and sign-in.
3. Use the browser's credential API with user verification required (device PIN, biometric or security key).
4. Verify the signature, challenge, expected origin, relying-party ID and verification flags on the server. Store the credential ID and public key; never biometric data.
5. Use HTTPS in production, an exact RP/origin configuration, and atomic challenge consumption.
6. Provide a second passkey/security key, credential revocation, audited staff recovery and session revocation. An unrestricted password fallback would weaken a passkey-only policy.

Native WebAuthn is **not implemented** in this repository yet. It needs enrolment, credential management, recovery and browser/device testing, not just another login button.

References: [Google passkey overview](https://developers.google.com/identity/passkeys/), [server-side authentication](https://developers.google.com/identity/passkeys/developer-guides/server-authentication), [server-side registration](https://developers.google.com/identity/passkeys/developer-guides/server-registration), [Workspace two-step verification](https://support.google.com/a/answer/175197), [managed-account passkeys](https://support.google.com/a/answer/13529161).
