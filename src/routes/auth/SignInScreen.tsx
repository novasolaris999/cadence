import { useEffect, useState, type FormEvent } from 'react';
import { Icon } from '../../components/Icon';
import { enabledProviders, sendSignInEmail, signInWithGoogle, verifyCode } from '../../data/auth';

const EMAIL_KEY = 'cadence.signin.email';

/**
 * Sign in by email. Step 1 sends a sign-in email; tapping its link signs you in.
 * Optionally, the email can also carry a code (Supabase needs custom email sending for that).
 * The code matters on iPhone, where a link opened from Mail signs in Safari rather than the
 * installed app. On Android the installed app shares Chrome's login, so the link is enough.
 */
export function SignInScreen() {
  const [email, setEmail] = useState(() => {
    try {
      return localStorage.getItem(EMAIL_KEY) ?? '';
    } catch {
      return '';
    }
  });
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  // The code only arrives if the email template includes it (needs custom email sending in Supabase).
  const [showCode, setShowCode] = useState(false);
  const [google, setGoogle] = useState(false);

  useEffect(() => {
    enabledProviders().then((p) => setGoogle(p.google));
  }, []);

  const withGoogle = async () => {
    setBusy(true);
    setError(null);
    try {
      await signInWithGoogle(); // leaves the page for Google's account picker
    } catch (err) {
      setError(friendly(err));
      setBusy(false);
    }
  };

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(id);
  }, [cooldown]);

  const send = async (e?: FormEvent) => {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await sendSignInEmail(email.trim());
      try {
        localStorage.setItem(EMAIL_KEY, email.trim());
      } catch {
        // Not important if storage is blocked.
      }
      setSent(true);
      setCooldown(60);
    } catch (err) {
      setError(friendly(err));
    } finally {
      setBusy(false);
    }
  };

  const verify = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await verifyCode(email.trim(), code.trim());
    } catch (err) {
      setError(friendly(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pt-safe flex min-h-dvh items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-6 shadow-card">
        <div className="mb-5 flex items-center gap-2">
          <img src="/logo.svg" alt="" className="h-9 w-9" />
          <div>
            <h1 className="font-display text-headline-md font-semibold uppercase tracking-tight">Cadence</h1>
            <p className="text-label-sm uppercase tracking-wider text-faint">Sign in</p>
          </div>
        </div>

        {google && !sent && (
          <>
            <button
              type="button"
              onClick={withGoogle}
              disabled={busy}
              className="flex w-full items-center justify-center gap-2.5 rounded-full border border-border bg-surface-2 py-3 text-label-lg font-semibold text-text shadow-card hover:border-faint disabled:opacity-40"
            >
              <GoogleMark />
              Continue with Google
            </button>
            <div className="my-4 flex items-center gap-3 text-label-sm uppercase tracking-wider text-faint">
              <span className="h-px flex-1 bg-border" /> or email <span className="h-px flex-1 bg-border" />
            </div>
          </>
        )}

        {!sent ? (
          <form onSubmit={send} className="flex flex-col gap-3">
            <label className="text-label-md font-semibold text-muted" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-body-lg outline-none focus:border-primary"
            />
            <button
              disabled={busy || !email.includes('@')}
              className="rounded-full bg-primary py-3 text-label-lg font-semibold text-on-primary shadow-card disabled:opacity-40"
            >
              {busy ? 'Sending…' : 'Email me a sign-in link'}
            </button>
          </form>
        ) : (
          <form onSubmit={verify} className="flex flex-col gap-3">
            <p className="flex items-start gap-2 rounded-lg bg-surface-2 p-3 text-body-sm text-muted">
              <Icon name="check_circle" size={18} className="mt-0.5 text-hit-ink" />
              <span>
                Sent to <strong className="text-text">{email}</strong>. Open the email on this device and tap the link
                to sign in.
              </span>
            </p>
            {!showCode ? (
              <button type="button" onClick={() => setShowCode(true)} className="self-start text-label-md text-muted underline">
                The email has a code instead?
              </button>
            ) : (
              <>
                <input
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="Code"
                  aria-label="Code from the email"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  className="rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-center font-mono text-headline-md tracking-[0.3em] outline-none focus:border-primary"
                />
                <button
                  disabled={busy || code.length < 6}
                  className="rounded-full bg-primary py-3 text-label-lg font-semibold text-on-primary shadow-card disabled:opacity-40"
                >
                  {busy ? 'Checking…' : 'Sign in with code'}
                </button>
              </>
            )}
            <div className="flex justify-between text-label-md">
              <button type="button" onClick={() => setSent(false)} className="text-muted underline">
                Different email
              </button>
              <button
                type="button"
                disabled={cooldown > 0 || busy}
                onClick={() => send()}
                className="text-primary-ink underline disabled:text-faint disabled:no-underline"
              >
                {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend email'}
              </button>
            </div>
          </form>
        )}

        {error && <p className="mt-3 rounded-lg bg-miss/10 p-2.5 text-body-sm text-miss-ink">{error}</p>}
      </div>
    </div>
  );
}

function friendly(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/failed to fetch|network/i.test(msg)) return 'Could not reach the server. Check your connection and try again.';
  if (/rate limit|too many/i.test(msg)) return 'Too many emails in a short time. Wait a minute and try again.';
  if (/expired|invalid/i.test(msg)) return 'That code did not work. It may have expired: send a new email.';
  if (/signups not allowed|not allowed for otp/i.test(msg)) return 'This email does not have an account here.';
  if (/provider is not enabled/i.test(msg)) return 'Google sign-in is not switched on in Supabase yet.';
  return msg;
}

/** Google's "G" mark. Brand colors are Google's and required by their sign-in guidelines. */
function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
