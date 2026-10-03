import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Browser-safe values, baked into the build by Vite from Vercel's environment variables.
// The publishable key is public by design: row level security is what protects your data.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY) as
  | string
  | undefined;

/** Null when the env vars are missing: the app then runs on demo data. */
export const supabase: SupabaseClient | null =
  url && key
    ? createClient(url, key, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      })
    : null;
