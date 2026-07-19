import { createClient } from "@supabase/supabase-js";

// Le worker écrit toujours avec la service_role key : il n'y a pas de
// session utilisateur ici, donc RLS doit être court-circuité volontairement.
export const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);
