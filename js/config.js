import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const DEFAULTS = {
  sellPrice: 7,
  duePer: 6,
  bonusPct: 10,
};

const LEGACY_PUBLIC_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVyeGhrd296a3V3dmhsdnN3dXZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcwNDA0NDMsImV4cCI6MjA4MjYxNjQ0M30.NFBI1hGFeCvO5n8cxLYCGERbyYY5lGbAvVR6o3a1YLg";

function parseJsonConfigNode() {
  const node = globalThis.document?.getElementById("runtime-config");
  if (!node?.textContent) return {};

  try {
    return JSON.parse(node.textContent);
  } catch {
    console.warn("[config] runtime-config script tag exists but is not valid JSON");
    return {};
  }
}

function collectRuntimeEnv() {
  const metaEnv = typeof import.meta !== "undefined" && import.meta?.env ? import.meta.env : {};
  const globalEnv = globalThis.__LEDGER_CONFIG__ || globalThis.process?.env || {};
  const inlineEnv = parseJsonConfigNode();

  return {
    SUPABASE_URL:
      globalEnv.SUPABASE_URL ||
      inlineEnv.SUPABASE_URL ||
      metaEnv.SUPABASE_URL ||
      metaEnv.VITE_SUPABASE_URL ||
      metaEnv.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_ANON_KEY:
      globalEnv.SUPABASE_ANON_KEY ||
      inlineEnv.SUPABASE_ANON_KEY ||
      metaEnv.SUPABASE_ANON_KEY ||
      metaEnv.VITE_SUPABASE_ANON_KEY ||
      metaEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };
}

function requireRuntimeConfig() {
  const env = collectRuntimeEnv();

  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    throw new Error(
      "Supabase Konfiguration fehlt: SUPABASE_URL und SUPABASE_ANON_KEY müssen zur Runtime gesetzt sein (z.B. via .env Build-Step oder runtime-config Skript).",
    );
  }

  if (env.SUPABASE_ANON_KEY.trim() === LEGACY_PUBLIC_KEY) {
    throw new Error(
      "Bekannter Public Key erkannt. Bitte sicheren Key via Runtime-Variablen setzen und RLS für alle Tabellen aktivieren.",
    );
  }

  return {
    supabaseUrl: env.SUPABASE_URL,
    supabaseAnonKey: env.SUPABASE_ANON_KEY,
  };
}

export function loadSupabaseClient() {
  const cfg = requireRuntimeConfig();
  return createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
}
