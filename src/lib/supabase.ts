import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

// Only create a real client if we have valid-looking credentials
let supabase: SupabaseClient;

const isConfigured =
    supabaseUrl.startsWith("http") &&
    supabaseUrl !== "your_supabase_project_url" &&
    supabaseAnonKey.length > 10;

if (isConfigured) {
    supabase = createClient(supabaseUrl, supabaseAnonKey);
} else {
    // Create a no-op stub so imports don't break at build time
    supabase = {
        from: () => ({
            insert: async () => ({ error: null }),
            select: async () => ({ data: [], error: null }),
            update: () => ({ eq: async () => ({ error: null }) }),
            eq: async () => ({ data: null, error: null }),
        }),
    } as unknown as SupabaseClient;
}

export { supabase, isConfigured };
