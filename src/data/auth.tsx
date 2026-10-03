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

export async function signOut() {
  await supabase?.auth.signOut();
}
