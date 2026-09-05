import { createClient } from "@supabase/supabase-js";

console.log("Supabase URL:", process.env.SUPABASE_URL);
console.log("Supabase Secret Key:", process.env.SUPABASE_SECRET_KEY);

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false,
        },
    }
);

export default supabase;