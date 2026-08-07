# Sevak Library — Deploy & Release Runbook

How to push the current code to production (frontend + Supabase backend).

## 0. Overview

| Layer       | Host                 | How it deploys                         |
|-------------|----------------------|----------------------------------------|
| Frontend    | Vercel (sevak-library.vercel.app) | Auto-deploys on `git push` to `master` |
| Database    | Supabase (wubjaxhrduzeidzqutoq)   | SQL migrations (manual)                |
| Edge function | Supabase            | `supabase functions deploy` (manual)   |

## 1. Frontend (Vercel)

1. Commit and push:
   ```bash
   git add -A
   git commit -m "your change"
   git push origin master
   ```
2. Vercel auto-builds. Confirm the deployed JS/CSS chunk hashes match the latest `npm run build` output.

## 2. Database migration

The only pending migration is `supabase/migrations/0004_resume_payment.sql`
(extends `get_application_by_ref` to return payment fields).

Apply it in the **Supabase Dashboard → SQL Editor**:
1. Open https://supabase.com/dashboard/project/wubjaxhrduzeidzqutoq
2. SQL Editor → new query
3. Paste the contents of `supabase/migrations/0004_resume_payment.sql` and Run.

> Do NOT use `supabase db push` from this machine — the logged-in CLI account
> does not have access to this project (`wubjaxhrduzeidzqutoq`).

## 3. Edge function: send-membership-email

Dashboard steps (easiest):

1. **Function config — Verify JWT must be OFF**
   - Edge Functions → `send-membership-email` → Settings
   - "Verify JWT with legacy secret" = **OFF**, then Save.
   - Required so the public auto-payment email and `#/pay/<ref>` work without a JWT.

2. **Secrets**
   - Edge Functions → Secrets (or project Settings → Edge Functions)
   - Ensure these exist:
     - `GMAIL_USER=library.sevak@gmail.com`
     - `GMAIL_APP_PASSWORD=<the 16-char app password>`
     - `APP_URL=https://sevak-library.vercel.app`
     - `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` (auto-provided, but verify)

3. **Deploy the new code**
   - Edge Functions → `send-membership-email` → Deploy
   - Paste the contents of `supabase/functions/send-membership-email/index.ts`
     (or redeploy from CLI using an account that owns the project).

CLI alternative (only if you log in with the account that owns the project):
```bash
supabase login
supabase link --project-ref wubjaxhrduzeidzqutoq
supabase secrets set GMAIL_USER=library.sevak@gmail.com
supabase secrets set GMAIL_APP_PASSWORD="<app password>"
supabase secrets set APP_URL=https://sevak-library.vercel.app
supabase functions deploy send-membership-email
supabase functions update send-membership-email --verify-jwt false
```

## 4. Smoke test

1. Submit a test application on https://sevak-library.vercel.app/#/
2. Expect a **payment email from library.sevak@gmail.com** with a
   "Complete my payment" button linking to `#/pay/<ref>`.
3. Open `#/pay/<ref>` → checkout should load with the correct plan/fee/ref.
4. Complete payment (enter a test txn id) → status becomes PAYMENT_SUBMITTED.
5. Admin: sign in at `#/admin/login`, verify → approve → applicant gets the
   membership ID email from library.sevak@gmail.com.
6. If an email is missing, check Edge Functions → `send-membership-email` → Logs
   (it logs SMTP errors and writes every attempt to the `mail_log` table).

## 5. Trouble-shooting

- **Emails not arriving** → check function Logs + `mail_log` table; confirm
  `GMAIL_APP_PASSWORD` secret and 2-Step Verification still on the account.
- **Auto payment email fails** → confirm Verify JWT is OFF on the function.
- **`get_application_by_ref` errors** → migration 0004 not applied (run it).
- **App password revoked** → regenerate at https://myaccount.google.com/apppasswords
  and update the `GMAIL_APP_PASSWORD` secret.
