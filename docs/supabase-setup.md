# Supabase setup (one time)

Everything here is clicked in the browser. Keep two tabs open: **Supabase** (supabase.com/dashboard,
your `cadence` project) and **Vercel** (vercel.com, your `cadence` project). The order matters: each
part depends on the one before.

Menu names drift a little between dashboard versions. If a label differs, look for the closest match.

---

## Part 1. Create the project (done)
Project `cadence`, region West US (North California), password saved.

## Part 2. Run the schema
SQL Editor > New query > paste the whole of `supabase/migrations/0001_init.sql` > make sure nothing is
highlighted (if text is selected, Supabase runs only the selection) > Run > "Success. No rows returned".

Check it worked by running this in a new SQL Editor query:

```sql
select tablename, rowsecurity as protected from pg_tables where schemaname = 'public' order by tablename;
```

Expected: 6 rows (`blocks`, `categories`, `day_logs`, `settings`, `targets`, `week_plans`), all with
`protected = true`. In **Table Editor**, the tables appear when the **schema** dropdown at the top left
is set to `public`.

- 0 rows: the schema did not run in this project. Run the migration again (whole file, nothing selected).
- An error like "type ... already exists" when re-running: part of it ran before. Ask Claude for a
  clean-up script rather than editing by hand.

---

## Part 3. Tell Supabase where the app lives (Supabase tab)

**Why first:** the sign-in email contains a link back to the app. Supabase refuses to send you to an
address it does not know, as protection against someone redirecting your login to their own site.

1. Left sidebar: click **Authentication** (the icon of a person, or the word, depending on width).
2. In Authentication's own menu, under **Configuration**, click **URL Configuration**.
3. **Site URL** box: replace whatever is there (often `http://localhost:3000`) with your latest
   Vercel preview link, for example `https://cadence-51fqv3pj2-novasolaris999s-projects.vercel.app`.
   Click **Save**. (In phase 7 this becomes the production address.)
4. **Redirect URLs** section: click **Add URL**, paste exactly:
   `https://cadence-*-novasolaris999s-projects.vercel.app/**`
   then **Save URLs**.
   - The first `*` stands for the random part of each preview link, so every future preview works.
   - `/**` allows any page inside the app.
   - Do not use the broader `https://*.vercel.app/**`: that would let any Vercel site receive your login.

## Part 4. Sign-in code in the email (optional, skip for now)

Supabase only allows editing email templates after you connect your own email sender ("custom SMTP").
The code is only needed on iPhone, where a home-screen app does not share Safari's login. On Android
(Pixel) and desktop, the link in the default email signs you in, so skip this part.

If you ever want the code (or more than Supabase's few emails per hour): connect a free sender such as
Resend under **Authentication > Emails > SMTP settings**, then add this line under the link in both the
**Confirm signup** and **Magic Link** templates:

```html
<p>Or enter this code in the app: <strong>{{ .Token }}</strong></p>
```

## Part 5. Copy the two values the app needs (Supabase tab)

**Why:** the app needs the project's address (URL) and a browser key to talk to it. The browser key is
meant to be public; your data is protected by the security rules from Part 2.

1. Bottom of the left sidebar: click the **gear** (**Project Settings**).
2. Click **API Keys**.
   - If you see a **Publishable key** starting with `sb_publishable_`, click its copy icon.
   - If you only see "anon" and "service_role", click **Create new API keys** first, then copy the
     publishable key.
   - Never copy a **Secret key** (`sb_secret_...`) or **service_role** key into the app.
   Paste it somewhere temporary (a note).
3. Still in Project Settings, click **Data API** (or use the **Connect** button at the top of the
   project). Copy the **Project URL**, which looks like `https://abcdefghijk.supabase.co`. Paste it
   into the same note.

## Part 6. Give the values to Vercel (Vercel tab)

**Why:** Vercel builds the app. These values are written into the app during the build, so they must
be in Vercel, and a new build is needed after adding them.

1. vercel.com > click the **cadence** project.
2. Top tabs: **Settings**. Left menu: **Environment Variables**.
3. Add the first variable:
   - **Key**: `VITE_SUPABASE_URL`
   - **Value**: the Project URL from Part 5
   - **Environments**: tick all three (Production, Preview, Development)
   - Click **Save**.
4. Add the second variable the same way:
   - **Key**: `VITE_SUPABASE_PUBLISHABLE_KEY`
   - **Value**: the publishable key from Part 5
   - all three environments, **Save**.
   Check the keys are spelled exactly like this, including `VITE_` at the start: the app only sees
   variables that start with `VITE_`.
5. Top tabs: **Deployments**. On the top row (newest), click the **⋯** menu > **Redeploy** >
   **Redeploy** again to confirm. Leave "use existing build cache" as it is.
6. Wait about a minute until the row says **Ready**. Click it, then **Visit** to open the new link.
   (Each deployment gets its own link; the Redirect URL pattern from Part 3 already covers it.)

Success: the app opens on a **Sign in** card, and the yellow "Demo data" badge is gone.

## Part 7. Sign in (app + email)

1. On the sign-in card, enter your email, tap **Email me a sign-in link**.
2. Open the email from Supabase on the same device ("Confirm your signup" the first time) and tap
   the link. It opens the app signed in.
3. You land on **Today**. Open **Goals**: you should see "No routines yet".

If the link opens a page that says the link is invalid or expired, request a new email and use the
newest one: each new email cancels the previous link.

## Part 8. Close sign-ups (Supabase tab)

**Why last:** your own account now exists. Turning sign-ups off means nobody else can ever create an
account in your project, even though the app's address and browser key are public.

1. **Authentication** > under **Configuration** > **Sign In / Providers**.
2. Find **Allow new users to sign up** (in some versions it is inside the **Email** provider: click
   **Email** to open it). Turn it **off**. Click **Save**.
3. Check: **Authentication** > **Users** shows exactly one user, your email.

---

## Good to know
- Free projects pause after about a week without use. Daily use keeps it awake; if it pauses, open the
  Supabase dashboard and click **Restore**. No data is lost.
- Supabase's built-in email sender allows only a few emails per hour. Avoid requesting many sign-in
  emails in a row; if you hit the limit, wait an hour.
- Future schema changes arrive as new files in `supabase/migrations/` (0002, 0003, ...). Run each new
  file once, in order, in the SQL Editor.
