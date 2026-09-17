import { createClient } from "@supabase/supabase-js";

/**
 * SERVER-ONLY Supabase client using the service_role key — bypasses RLS.
 * Never import this from client components; the anon client (lib/supabase.ts)
 * is for anything user-facing.
 */
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);
