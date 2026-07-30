import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Leest SUPABASE_URL + keys uit de gitignored `.env` in de repo-root.
 * Robuust tegen inline `# comments` en spaties in het pad (fileURLToPath).
 * `process.env` wint van `.env`, zodat CI de waarden kan overrulen.
 */
function parseEnvFile() {
  const out = {};
  let text;
  try {
    text = readFileSync(fileURLToPath(new URL('../.env', import.meta.url)), 'utf8');
  } catch {
    return out;
  }
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1);
    const inlineComment = val.indexOf(' #');
    if (inlineComment !== -1) val = val.slice(0, inlineComment);
    out[key] = val.trim().replace(/^["']|["']$/g, '');
  }
  return out;
}

export function supabaseEnv() {
  const f = parseEnvFile();
  const url = process.env.SUPABASE_URL ?? f.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY ?? f.SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? f.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !serviceKey) {
    throw new Error('SUPABASE_URL, SUPABASE_ANON_KEY en SUPABASE_SERVICE_ROLE_KEY verplicht — vul .env (zie .env.example)');
  }
  return { url, anonKey, serviceKey };
}
