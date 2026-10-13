# Optional Google sign-in

The portal offers email/password sign-in first, with an optional Continue with Google button below it. `/signup` creates patient accounts using email verification, and `/forgot-password` restores access through an emailed verification code. Google configuration failures do not block password login. Existing doctor accounts can use their password or linked Google account; public registration cannot assign doctor access.

## Configure Google

1. Open [Google Auth Platform](https://console.cloud.google.com/auth/overview) in your Google Cloud project. Configure the application name, audience, support email and authorised domains. Add test users while the app is in testing.
2. Create an OAuth client of type **Web application**.
3. Add your exact frontend origins under **Authorised JavaScript origins**. For local development, add `http://localhost:5173` and `http://127.0.0.1:5173`. If Vite runs on another port, register that exact origin too. Add your production HTTPS origin before deployment.
4. Put `GOOGLE_CLIENT_ID=<your ID ending in .apps.googleusercontent.com>` in `backend/.env`. Keep the other settings. No client secret is needed for this JavaScript ID-token flow, and no frontend environment variable is required.
5. Install backend dependencies with `backend/venv/Scripts/python.exe -m pip install -r backend/requirements.txt`, then restart the backend and frontend. Sign in at `/login`.
6. Verify a patient sign-in, sign-out, and a hospital-approved doctor sign-in using real Google accounts. This final provider test requires your configured Google client ID and authorised origins.

Official references: [Google button setup](https://developers.google.com/identity/gsi/web/guides/display-button), [server-side token verification](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token).

## Accounts and staff access

- Google-created accounts initially have no password. They can keep using Google or use the verified password-reset flow to set a password for the registered email. Email verification and password reset require working SMTP.

- New Google accounts receive the **patient** role. No browser-supplied role is accepted.
- An existing hospital account with the same verified Gmail/Workspace email is linked without changing its ID or role, preserving report ownership. Duplicate legacy email records require administrator resolution.
- Subsequent sign-ins use Google's stable `sub` identifier. The saved contact email cannot be changed through the profile form. A Workspace address change needs hospital assistance to update the report recipient.
- Google accounts using non-Gmail, non-Workspace mailboxes are rejected because Google cannot verify their ongoing mailbox ownership. Migrate such existing accounts with the hospital administrator before use.
- The hospital administrator can provision an approved doctor locally, from the project root:

```powershell
backend/venv/Scripts/python.exe backend/provision_doctor.py --email doctor@gmail.com --name "Doctor Name" --confirm-doctor
```

This command writes the doctor role to the database. Run it only for verified staff. It has not been run automatically. Review pre-existing doctor accounts before deployment because the earlier signup UI permitted doctor-role selection.

## Verification and deployment notes

The backend verifies Google's signature, expiry, audience, issuer, verified email and a server-issued nonce challenge. It uses a unique sparse index on Google subject IDs. The challenge expires after five minutes; Retry starts a fresh one. The frontend stores the returned application bearer token using the project's existing session mechanism.

Use a strong `JWT_SECRET_KEY`, HTTPS, restricted production CORS origins and a privacy policy reflecting the real data practices before deployment. Secure HttpOnly session cookies, durable rate limiting, access reviews and audit retention are further production improvements, not claims made by this implementation. Do not put OAuth secrets in frontend files or commit `.env`.

Automated tests use synthetic Google claims and browser callbacks. They do not establish that a real Google Cloud project is configured.
