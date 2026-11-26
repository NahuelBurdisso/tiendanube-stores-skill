#!/usr/bin/env node
/* ============================================================
   oauth-token.mjs — exchange a Tienda Nube OAuth `code` for an
   access_token + store_id, and save them into ./.env. Any store.

   Prereq in env or ./.env:
     TIENDANUBE_APP_ID, TIENDANUBE_CLIENT_SECRET   (from partners.tiendanube.com)

   1) Owner opens:  https://www.tiendanube.com/apps/<APP_ID>/authorize/
      authorizes, lands on redirect with ?code=XXXX
   2) node oauth-token.mjs <code>

   ⚠️ Auth codes are SINGLE-USE. This captures the token on the first
   (only) exchange and writes it to .env immediately — never just print it.
   ============================================================ */

import { readFileSync, writeFileSync, existsSync, appendFileSync } from 'node:fs';

function loadEnv() {
  if (!existsSync('.env')) return;
  for (const line of readFileSync('.env', 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!m || process.env[m[1]]) continue;
    let v = m[2].trim();
    if (v.length >= 2 && (v[0] === '"' || v[0] === "'") && v.endsWith(v[0])) v = v.slice(1, -1);
    process.env[m[1]] = v;
  }
}
loadEnv();

const APP_ID = process.env.TIENDANUBE_APP_ID;
const SECRET = process.env.TIENDANUBE_CLIENT_SECRET;
const code = process.argv[2];

if (!APP_ID || !SECRET) { console.error('Set TIENDANUBE_APP_ID and TIENDANUBE_CLIENT_SECRET (env or .env).'); process.exit(1); }
if (!code) {
  console.error(`No code given.\nOpen: https://www.tiendanube.com/apps/${APP_ID}/authorize/`);
  console.error('Authorize, copy ?code=... from the redirect, then: node oauth-token.mjs <code>');
  process.exit(1);
}

function upsertEnv(key, val) {
  let env = existsSync('.env') ? readFileSync('.env', 'utf8') : '';
  const re = new RegExp(`^\\s*${key}\\s*=.*$`, 'm');
  if (re.test(env)) { env = env.replace(re, `${key}=${val}`); writeFileSync('.env', env); }
  else appendFileSync('.env', `${env.endsWith('\n') || env === '' ? '' : '\n'}${key}=${val}\n`);
}

const res = await fetch('https://www.tiendanube.com/apps/authorize/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ client_id: APP_ID, client_secret: SECRET, grant_type: 'authorization_code', code }),
});
const text = await res.text();
let j;
try { j = JSON.parse(text); }
catch { console.error(`EXCHANGE FAILED: HTTP ${res.status}, non-JSON response:\n${text.slice(0, 300)}`); process.exit(2); }
if (!res.ok || j.error || !j.access_token) {
  console.error('EXCHANGE FAILED:', `HTTP ${res.status}`, j.error || '', j.error_description || '');
  console.error('(codes are single-use — get a fresh one from the authorize URL)');
  process.exit(2);
}

upsertEnv('TIENDANUBE_ACCESS_TOKEN', j.access_token);
upsertEnv('TIENDANUBE_STORE_ID', j.user_id);
console.log(`Saved to .env — store_id=${j.user_id}, scope=${j.scope}, token length=${j.access_token.length}`);
console.log('Verify: node tn-api.mjs GET /store');
