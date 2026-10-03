import type { DataApi } from './api';
import { sampleApi } from './sampleApi';
import { supabase } from './supabase';
import { supabaseApi } from './supabaseApi';

/** The storage the app uses: Supabase when configured, otherwise demo data. */
export const api: DataApi = supabase ? supabaseApi(supabase) : sampleApi;
