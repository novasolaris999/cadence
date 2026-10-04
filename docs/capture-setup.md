# Capture setup (phase 9)

Capture reads what you type (or dictate with your keyboard's mic) and proposes to-dos, habits, routines, and
one-off blocks. It runs through a small server function in Supabase called `capture`, which holds your Claude
API key. The key never reaches the browser, GitHub, or Vercel.

You do this once. It takes about 10 minutes.

## Why this order

1. The API key is shown only once when you create it, so you create it right before pasting it into Supabase.
2. The spend limit goes on before the key is used, so nothing can ever cost more than you chose.
3. The function and its secrets must both exist before the app's Capture button can work. Until then the app
   says "Capture is not set up yet" and nothing else is affected.

## 1. Claude API key and spend limit (console.anthropic.com)

1. Sign in at **console.anthropic.com** (this is separate from your Claude app subscription).
2. **Billing**: add a small amount of credit, for example $5. Capture costs a fraction of a cent per request.
3. **Settings > Limits**: set a monthly spend limit, for example $5.
4. **Settings > API Keys > Create Key**: name it `cadence-capture`. Copy the key (starts with `sk-ant-`).
   Keep the tab open until step 2.4 below.

## 2. Secrets in Supabase (supabase.com, your Cadence project)

1. Open your project, then **Edge Functions** in the left sidebar, then **Secrets**
   (also under Project Settings > Edge Functions).
2. Add `ANTHROPIC_API_KEY` = the key you just copied.
3. Add `CAPTURE_ALLOWED_EMAILS` = the email you sign in to Cadence with. Only this account can use capture,
   so nobody else can spend your API budget even if they create an account.
4. Optional: `CAPTURE_MODEL` = a different Claude model id. Leave it out to use `claude-sonnet-5-5`.

## 3. Deploy the function (Supabase dashboard editor)

1. **Edge Functions > Deploy a new function > Via Editor**.
2. Name it exactly `capture`.
3. Replace the sample code with the whole of `supabase/functions/capture/index.ts` from the repository, then
   **Deploy**.
4. Open the function's **Details** (or settings) and turn **off** "Verify JWT" (it may be called "Verify JWT
   with legacy secret" or "Enforce JWT verification"). The function checks who you are itself, against
   Supabase Auth, which works with both the old and the new key types; the built-in check can reject valid
   sign-ins on projects using the newer keys.

## 4. Try it

Open Cadence, tap the pencil-in-a-square button at the top, and type "Oat milk to shopping". You should see a
preview card. Tap **Add**.

If it shows a message instead:

| Message | Fix |
|---|---|
| Capture is not set up yet: the capture function is not deployed | Step 3: the name must be exactly `capture`. |
| Capture is not enabled for this account | Step 2.3: the email must match the one you signed in with. |
| The Claude API key was not accepted | Step 2.2: paste the key again (no spaces). |
| Claude is busy or the monthly limit was reached | Wait, or raise the limit in step 1.3. |
| Sign in to use capture | Turn "Verify JWT" off (step 3.4), or sign out and in again. |

## Updating the function later

When `supabase/functions/capture/index.ts` changes, open the function in **Edge Functions**, replace the code
with the new file, and deploy again. Claude says in the hand-off message when this is needed.

## Testing without a key

`supabase/functions/capture/check.deno.ts` runs the function against stand-ins for Claude and Supabase Auth
(no network, no key). Demo mode in the app uses a simple on-device stand-in instead of Claude.
