# Subspace Radio — One-Time Setup (Yanni's checklist)

These are the account-side steps only you can do. Do them in order; each takes a few minutes.
When all are done, tell Claude "setup done" and the build continues with live verification.

## 1. Supabase (project `lgcmbmlapksmdbkhkyyv`)

1. Open [supabase.com/dashboard](https://supabase.com/dashboard) → your project → SQL Editor.
2. If you have NOT yet run `supabase/schema.sql` on this project: paste its contents, Run.
3. Paste the contents of `supabase/radio-schema.sql`, Run. (Safe to re-run.)
4. Authentication → Users: confirm your admin user exists. If you haven't yet:
   add user (your email + strong password), copy its UUID, then in SQL Editor run:
   `insert into user_roles (user_id, role) values ('<uuid>', 'admin');`
5. Authentication → Sign In / Up:
   - Enable **Anonymous sign-ins**.
   - Disable public email signups (no new email users).
6. Authentication → Attack Protection (or Bot and Abuse Protection):
   - Enable **Captcha** and choose **Turnstile**; paste the Turnstile SECRET key from step 2 below.
7. Your account (not the project): enable MFA on your Supabase login itself.
8. App-level MFA for the host account (the authenticator code the radio admin asks for)
   is enrolled later from the radio admin screen during M5; nothing to do yet.

## 2. Cloudflare — Turnstile (the invisible bot test)

1. [dash.cloudflare.com](https://dash.cloudflare.com) → Turnstile → Add site.
2. Name: `subspace-radio`. Domains: `subspaceresonator.com`, `localhost`.
3. Widget mode: **Invisible**.
4. Copy the **Site Key** → goes in `.env` as `VITE_TURNSTILE_SITE_KEY` and in Vercel env.
5. Copy the **Secret Key** → paste into Supabase captcha settings (step 1.6 above).

## 3. Cloudflare — Realtime (the stream relay)

1. dash.cloudflare.com → Realtime (SFU) → Create app. Name: `subspace-radio`.
2. Copy the **App ID** and **App Secret**.

## 4. Vercel — environment variables

Project Settings → Environment Variables (all environments):

| Name | Value | Exposed to browser? |
|---|---|---|
| `VITE_TURNSTILE_SITE_KEY` | Turnstile site key | yes (by design) |
| `SUPABASE_URL` | `https://lgcmbmlapksmdbkhkyyv.supabase.co` | NO |
| `SUPABASE_SECRET_KEY` | Supabase secret/service key (Settings → API) | NO |
| `CF_REALTIME_APP_ID` | from step 3 | NO |
| `CF_REALTIME_APP_SECRET` | from step 3 | NO |

(`VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` should already be there from before;
add them if missing, same values as your local `.env`.)

Also add `VITE_TURNSTILE_SITE_KEY=<site key>` to your local `.env` file.

## 5. Account safety (from the owner's chapter; do once)

MFA on: GitHub, Vercel, Supabase, Cloudflare, Google. Unique passwords in a password manager.

## 6. Verify (I do this with you)

After steps 1-4: run `node scripts/rls-probe.mjs` in the project folder.
Every line must say PASS. Then the build continues to M3 (live stream round-trip).
