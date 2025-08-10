import { createClient } from '@supabase/supabase-js';

// 🔍 Log environment variables to verify they're loading
console.log("Supabase URL:", process.env.REACT_APP_SUPABASE_URL);
console.log("Supabase KEY:", process.env.REACT_APP_SUPABASE_KEY);

// ✅ Create the Supabase client using environment variables
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);