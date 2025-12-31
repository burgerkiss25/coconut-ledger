import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const SUPABASE_URL = "https://urxhkwozkuwvhlvswuvm.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVyeGhrd296a3V3dmhsdnN3dXZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcwNDA0NDMsImV4cCI6MjA4MjYxNjQ0M30.NFBI1hGFeCvO5n8cxLYCGERbyYY5lGbAvVR6o3a1YLg";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const DEFAULTS = {
  sellPrice: 7,
  duePer: 6,
  bonusPct: 10,
};

