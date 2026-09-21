import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables.");
}

/**
 * Browser Supabase client (anon key only).
 * Privileged exam/admin operations use the backend API + service role.
 * Never import SUPABASE_SERVICE_ROLE_KEY into frontend code.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
