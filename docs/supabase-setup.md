# Supabase setup (one time)

Everything here is clicked in the browser. The order matters: each step depends on the one before.

## 1. Create the project
1. Go to supabase.com, sign in (GitHub sign-in is easiest), click **New project**.
2. Name: `cadence`. Region: **West US (North California)** (closest to San Francisco = faster app).
3. Database password: click **Generate**, save it in your password manager. The app never uses it;
   you only need it for direct database access later.
4. Wait until the project finishes provisioning (about a minute).

## 2. Create the tables and security rules
1. Left sidebar: **SQL Editor** > **New query**.
2. Paste the whole of `supabase/migrations/0001_init.sql` from this repo and click **Run**.
3. Expect "Success. No rows returned".

Why before connecting the app: the app's first sign-in creates your settings and categories, which
needs the tables to exist.

## 3. Allow the sign-in link to come back to the app
**Authentication** > **URL Configuration**:
- **Site URL**: your production URL once it exists (phase 7). For now, your latest preview URL.
- **Redirect URLs**, add both:
  - `https://cadence-*-novasolaris999s-projects.vercel.app/**` (every Vercel preview)
  - `http://localhost:5173/**` (local development)

Why before signing in: Supabase only redirects to allowlisted URLs. Without this, the email link
sends you to the Site URL instead of the preview you are testing.

## 4. Put the 6-digit code in the sign-in emails
**Authentication** > **Email Templates**. In both **Confirm signup** (used the very first time) and
**Magic Link** (used after that), add this line under the existing link:

```html
<p>Or enter this code in the app: <strong>{{ .Token }}</strong></p>
```

Why: on iPhone, a home-screen app does not share its login with Safari, so tapping the link signs in
Safari instead of the app. Typing the code signs in wherever you typed it.

## 5. Give the app its address and browser key
1. Supabase: **Project Settings** > **API Keys**. Copy the **Publishable key** (`sb_publishable_...`).
   If there is none, click **Create new API keys**. Never copy a **Secret** key into the app.
2. Supabase: **Project Settings** > **Data API** (or the project home page). Copy the **Project URL**
   (`https://<something>.supabase.co`).
3. Vercel: project **cadence** > **Settings** > **Environment Variables**. Add, for all environments:
   - `VITE_SUPABASE_URL` = the Project URL
   - `VITE_SUPABASE_PUBLISHABLE_KEY` = the publishable key
4. Vercel: **Deployments** > newest deployment > **...** > **Redeploy**.

Why redeploy: Vite writes these values into the app when it builds, so a build made before you added
them does not have them. Until then the app shows a "Demo data" badge.

## 6. Sign in, then close the door
1. Open the new preview link, enter your email, and sign in with the link or the code.
2. Then: **Authentication** > **Sign In / Providers** > turn off **Allow new users to sign up** > Save.

Why last: your own account must exist before sign-ups close. After this, nobody else can create an
account, even though the app's address and publishable key are public.

## Good to know
- Free projects pause after about a week without use. Daily use keeps it awake; if it pauses, open the
  Supabase dashboard and click **Restore**. No data is lost.
- Supabase's built-in email sender allows only a few emails per hour. Fine for one person; avoid
  requesting many sign-in emails in a row.
- Future schema changes arrive as new files in `supabase/migrations/` (0002, 0003, ...). Run each new
  file once, in order, in the SQL Editor.
