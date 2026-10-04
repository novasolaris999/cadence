# Capture setup (phase 9)

Capture reads what you type (or dictate with your keyboard's mic) and proposes to-dos, habits, routines, and
one-off blocks. A small server function that ships with the app (`api/capture.ts`, deployed by Vercel on every
push) holds your Claude API key and asks Claude. The key never reaches your phone, the app's code, or GitHub.

You do this once. It takes about 10 minutes, in two places: the Claude Console and Vercel.

## Why this order

1. The workspace and its spend limit come before the key, so the key is capped from its first request.
2. The key is shown only once, so you create it right before pasting it into Vercel.
3. Vercel reads settings when a deployment starts, so the settings go in before the fresh deployment that uses them.

## 1. Claude Console (platform.claude.com)

This is separate from your Claude app subscription.

1. **Billing**: add a small amount of credit, for example $5. One capture costs a fraction of a cent.
2. **Settings > Workspaces**: create a workspace named `cadence` and give it a monthly spend limit, for example $5.
   If you do not see a limit there, set it under **Settings > Limits** instead.
   Why: Capture's spending is fenced off and capped. A leaked key could cost at most this much.
3. **Settings > API keys > Create key**:
   - Name: `cadence-capture`
   - Linked account: yourself
   - Workspace: `cadence`
   - Expiration: Never (the spend limit is the safety net; to replace the key later, create a new one, paste it
     into Vercel, then delete the old one)

   Copy the key (it starts with `sk-ant-`) and go straight to step 2.

## 2. Vercel (vercel.com, your `cadence` project)

**Settings > Environment Variables**. Add two variables. For each, tick both **Production** and **Preview**.

| Name | Value | Notes |
|---|---|---|
| `ANTHROPIC_API_KEY` | the key you just copied | Turn on **Sensitive**: it can then never be viewed again, only replaced. |
| `CAPTURE_ALLOWED_EMAILS` | the email you sign in to Cadence with | Only these accounts can use Capture. More later, separated by commas. |

Optional: `CAPTURE_MODEL` to use a different Claude model (leave it out for `claude-sonnet-5-5`).

Then tell Claude "done": a fresh preview deployment is needed to pick the settings up (Claude pushes one), or in
Vercel open **Deployments**, the newest one for the branch, **...**, **Redeploy**.

## 3. Try it

Open the preview, tap the pencil-in-a-square button at the top, and type "Oat milk to shopping". You should see a
preview card. Tap **Add**.

If it shows a message instead:

| Message | Fix |
|---|---|
| Capture is not enabled for this account | `CAPTURE_ALLOWED_EMAILS` must match your sign-in email exactly; then redeploy. |
| Capture is not set up: the ANTHROPIC_API_KEY setting is missing | Add it for both Production and Preview; then redeploy. |
| The Claude API key was not accepted | Paste the key again (no spaces); then redeploy. |
| Claude is busy or the monthly limit was reached | Wait, or raise the workspace limit. |
| Sign in to use capture | Sign out and in again. |

## Later

- **Friends**: add their emails to `CAPTURE_ALLOWED_EMAILS` (comma-separated) and redeploy. Before that, a daily
  limit per person will be added so one person cannot use up the monthly budget.
- **Different model**: set `CAPTURE_MODEL` and redeploy.
- **Tests**: `tests/captureApi.test.ts` runs the function against stand-ins for Claude and Supabase Auth on every
  `npm test`; no key or network is used.
