import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://kygyugvojbzawohswyuv.supabase.co";
const supabaseKey = "sb_publishable_sUbdY8ajIle7wiV3MuHm5Q_VHQ-Kxw_";

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
