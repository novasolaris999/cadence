// Sign-in state. With Supabase configured you sign in by email (a magic link, or the 6-digit
// code from the same email). Without it the app runs on demo data and skips sign-in.

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';

type AuthState =
  | { status: 'loading' }
  | { status: 'demo' }
  | { status: 'signedOut' }
  | { status: 'signedIn'; email: string };

const AuthContext = createContext<AuthState>({ status: 'loading' });

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [state, setState] = useState<AuthState>(supabase ? { status: 'loading' } : { status: 'demo' });

  useEffect(() => {
    if (!supabase) return;
    const apply = (email: string | undefined | null) =>
      setState(email !== undefined && email !== null ? { status: 'signedIn', email } : { status: 'signedOut' });
    supabase.auth.getSession().then(({ data }) => apply(data.session?.user.email ?? (data.session ? '' : null)));
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      // Drop cached data from the previous account on sign-out.
      if (event === 'SIGNED_OUT') qc.clear();
      apply(session ? (session.user.email ?? '') : null);
    });
    return () => sub.subscription.unsubscribe();
  }, [qc]);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

/** Sends the sign-in email. The link brings you back to this same site. */
export async function sendSignInEmail(email: string) {
  if (!supabase) throw new Error('Supabase is not configured');
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${window.location.origin}/today` },
  });
  if (error) throw error;
}

/** Signs in with the code from the email (useful inside the installed app on iPhone). */
export async function verifyCode(email: string, code: string) {
  if (!supabase) throw new Error('Supabase is not configured');
  const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' });
  if (error) throw error;
}

/**
 * Which sign-in methods are switched on in your Supabase project. Used to show the Google button only
 * after Google has been set up, so it can never appear broken.
 */
export async function enabledProviders(): Promise<{ google: boolean }> {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return { google: false };
  try {
    const res = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } });
    const body = (await res.json()) as { external?: Record<string, boolean> };
    return { google: body.external?.google === true };
  } catch {
    return { google: false };
  }
}

/** Sends you to Google's account picker; Google sends you back here signed in. */
export async function signInWithGoogle() {
  if (!supabase) throw new Error('Supabase is not configured');
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}/today` },
  });
  if (error) throw error;
}

export async function signOut() {
  await supabase?.auth.signOut();
}
