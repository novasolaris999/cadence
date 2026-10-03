# Google sign-in setup (one time, about 15 minutes)

Two websites talk to each other here, so the order matters:
Supabase gives you a **callback address** that Google needs, and Google gives you a **Client ID and
secret** that Supabase needs. Keep both tabs open.

The "Continue with Google" button appears in the app by itself once Part C is saved.

## Part A. Get the callback address from Supabase
1. Supabase > your project > **Authentication** > under **Configuration**, **Sign In / Providers**.
2. Click **Google** in the provider list. Do not enable it yet.
3. Copy the **Callback URL (for OAuth)**. It looks like
   `https://chkcbhabkqwguykzdzaf.supabase.co/auth/v1/callback`. Keep this tab open.

## Part B. Create the Google sign-in client
1. Open **console.cloud.google.com** and sign in with the Google account you will use for Cadence.
2. Top bar: project picker > **New project**. Name: `Cadence`. Click **Create**, then select it.
3. Search bar: type **Google Auth Platform** and open it (older consoles: **APIs & Services > OAuth
   consent screen**). Click **Get started**.
   - App name: `Cadence`. User support email: your email. **Next**.
   - Audience: **External**. **Next**.
   - Contact email: your email. **Next**, agree, **Create**.
4. Left menu: **Audience**. Under **Test users**, click **Add users**, add your own Gmail address, **Save**.
   Leave the publishing status on **Testing**: only the test users you list can sign in, which is
   exactly what a one-person app wants, and Google does not need to review it.
5. Left menu: **Clients** > **Create client**.
   - Application type: **Web application**. Name: `Cadence web`.
   - **Authorized redirect URIs** > **Add URI** > paste the Callback URL from Part A.
   - Click **Create**.
6. A dialog shows the **Client ID** and **Client secret**. Copy both (you can also download the JSON).
   The secret goes only into Supabase in Part C, never into the app or the repo.

## Part C. Switch Google on in Supabase
1. Back in the Supabase tab (Google provider panel from Part A).
2. Turn **Enable Sign in with Google** on.
3. Paste the **Client ID** and **Client secret**. Leave the other options as they are. **Save**.

## Part D. Try it
Open the app, sign out (Settings > Sign out), and tap **Continue with Google**.
- Google may show "Google hasn't verified this app". That is expected for your own test app:
  click **Continue**.
- You land back in Cadence, signed in to the **same account** as before (it matches by email).

If it says sign-ups are not allowed: in Supabase, turn **Allow new users to sign up** back on, sign
in with Google once, then turn it off again.
