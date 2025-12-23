import { createClient } from '@supabase/supabase-js';

// Pull from Vite env. Crash fast if they are missing so we catch bad deploy configs.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase environment variables are missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
}
console.log('SUPA_ENV', import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY?.slice(0,8));

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
