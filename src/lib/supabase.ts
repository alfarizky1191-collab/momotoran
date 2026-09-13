import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
export const supabase = isSupabaseConfigured ? createClient(supabaseUrl!, supabaseAnonKey!, {
  global: { fetch: async (input, init) => {
    const controller = new AbortController();
    const cancel = () => controller.abort();
    if (init?.signal?.aborted) controller.abort();
    init?.signal?.addEventListener('abort', cancel);
    const timer = setTimeout(cancel, 12000);
    try { return await fetch(input, { ...init, signal: controller.signal }); }
    finally { clearTimeout(timer); init?.signal?.removeEventListener('abort', cancel); }
  } },
  auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: Platform.OS === 'web' },
}) : null;
if (supabase && Platform.OS !== 'web') AppState.addEventListener('change', (state) => state === 'active' ? supabase.auth.startAutoRefresh() : supabase.auth.stopAutoRefresh());
