import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";
export const SUPABASE_URL = "https://lxfpvlxtkqwnznxsvlqf.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4ZnB2bHh0a3F3bnpueHN2bHFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk2NjM1MDEsImV4cCI6MjA3NTIzOTUwMX0.vHqB4RtzzvH2TH8ipGfqUJ4AOuHFo55nCs-usDB3-jg";
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);