#!/usr/bin/env node
/* ============================================================
   tn-api.mjs — generic Tienda Nube / Nuvemshop Admin API client.
   Works for ANY store. No hardcoded data. Importable + CLI.

   Credentials (from env or a local .env in cwd):
     TIENDANUBE_ACCESS_TOKEN   (required)
     TIENDANUBE_STORE_ID       (required; == OAuth user_id)
     API_BASE                  (default https://api.tiendanube.com/v1)
     CONTACT_EMAIL             (for the required User-Agent)

   Library:   import { api, getStore, listAll, es, money } from './tn-api.mjs'
   CLI:       node tn-api.mjs GET  /store
              node tn-api.mjs GET  /products '{"fields":"id,name"}'   (query for GET)
              node tn-api.mjs POST /categories '{"name":{"es":"Hombre"}}'
              node tn-api.mjs PUT  /products/123 '{"published":false}'
              node tn-api.mjs DELETE /products/123
   ============================================================ */

import { readFileSync, existsSync } from 'node:fs';

// --- minimal .env loader (no dependency) ---
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

const TOKEN = process.env.TIENDANUBE_ACCESS_TOKEN;
const STORE = process.env.TIENDANUBE_STORE_ID;
const BASE = process.env.API_BASE || 'https://api.tiendanube.com/v1';
const CONTACT = process.env.CONTACT_EMAIL || 'dev@example.com';

function requireCreds() {
  if (!TOKEN || !STORE) {
    throw new Error('Missing TIENDANUBE_ACCESS_TOKEN or TIENDANUBE_STORE_ID (set env or .env).');
  }
}

const HEADERS = () => ({
  Authentication: `bearer ${TOKEN}`,
  'Content-Type': 'application/json',
  'User-Agent': `tn-api toolkit (${CONTACT})`,
});

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const es = (s) => ({ es: s });           // localized text field
export const money = (n) => String(n);          // prices are strings
export const promo = (n, pct = 20) => String(Math.round(n * (1 - pct / 100)));

function qs(obj) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(obj || {})) p.set(k, v);
  const s = p.toString();
  return s ? `?${s}` : '';
}

/** Core request. For GET, pass query params as `body` object. Retries 429. */
export async function api(method, path, body) {
  requireCreds();
  const isGet = method.toUpperCase() === 'GET';
  const url = `${BASE}/${STORE}${path}${isGet && body ? qs(body) : ''}`;
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetch(url, {
      method,
      headers: HEADERS(),
      body: !isGet && body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 429) { await sleep(2000 * (attempt + 1)); continue; }
    const text = await res.text();
    let json; try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }
    if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${JSON.stringify(json)}`);
    return { json, headers: res.headers };
  }
  throw new Error(`${method} ${path} -> too many 429 retries`);
}

/** Follow Link-header pagination, return the full array. */
export async function listAll(path, params = {}) {
  const out = [];
  let page = 1;
  for (;;) {
    const { json, headers } = await api('GET', path, { ...params, per_page: 200, page });
    if (!Array.isArray(json) || json.length === 0) break;
    out.push(...json);
    const link = headers.get('link') || '';
    if (!link.includes('rel="next"')) break;
    page += 1;
    await sleep(300);
  }
  return out;
}

// --- convenience wrappers (extend as needed) ---
export const getStore       = () => api('GET', '/store').then((r) => r.json);
export const listProducts   = (params) => listAll('/products', params);
export const getProduct     = (id) => api('GET', `/products/${id}`).then((r) => r.json);
export const createProduct  = (p) => api('POST', '/products', p).then((r) => r.json);
export const updateProduct  = (id, p) => api('PUT', `/products/${id}`, p).then((r) => r.json);
export const deleteProduct  = (id) => api('DELETE', `/products/${id}`).then((r) => r.json);
export const listCategories = (params) => listAll('/categories', params);
export const createCategory = (c) => api('POST', '/categories', c).then((r) => r.json);
export const updateCategory = (id, c) => api('PUT', `/categories/${id}`, c).then((r) => r.json);
export const deleteCategory = (id) => api('DELETE', `/categories/${id}`).then((r) => r.json);
export const createCoupon   = (c) => api('POST', '/coupons', c).then((r) => r.json);
export const listOrders     = (params) => listAll('/orders', params);
export const addProductImage = (productId, src) =>
  api('POST', `/products/${productId}/images`, { src }).then((r) => r.json);

// --- CLI ---
const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const [method, path, bodyStr] = process.argv.slice(2);
  if (!method || !path) {
    console.error('Usage: node tn-api.mjs <METHOD> <path> [jsonBody]');
    process.exit(1);
  }
  let body; if (bodyStr) { try { body = JSON.parse(bodyStr); } catch { console.error('bad JSON body'); process.exit(1); } }
  api(method, path, body)
    .then((r) => console.log(JSON.stringify(r.json, null, 2)))
    .catch((e) => { console.error(e.message); process.exit(1); });
}
