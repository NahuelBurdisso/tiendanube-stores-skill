#!/usr/bin/env node
/* ============================================================
   create-catalog.mjs — create categories + products in ANY store
   from a JSON catalog file. Generic; no hardcoded data.

   Usage:
     node create-catalog.mjs [catalog.json]   (default ./catalog.json)
   Needs creds in env or ./.env (see tn-api.mjs). See catalog.example.json.

   Catalog shape:
   {
     "attribute": "Talle",                 // REQUIRED if any product has variants; omit only when none do
     "categories": [ { "name": "Urbanas", "description": "..." } ],
     "products": [
       { "name": "Aura Low", "category": "Urbanas", "price": 89999,
         "promo_pct": 20, "description": "...", "stock": 8,
         "variants": ["39","40","41","42"],   // size values; omit for single variant
         "images": ["https://...","https://..."], "free_shipping": false }
     ]
   }
   ============================================================ */

import { readFileSync } from 'node:fs';
import { es, money, promo, createCategory, createProduct, getStore, sleep } from './tn-api.mjs';

const file = process.argv[2] || 'catalog.json';
const cat = JSON.parse(readFileSync(file, 'utf8'));

if (!cat.attribute && (cat.products || []).some((p) => p.variants?.length)) {
  console.error(`ERROR: ${file} has products with "variants" but no top-level "attribute".`);
  console.error('The API rejects variant values without an attribute name (422 on every product).');
  console.error('Add e.g. "attribute": "Talle" at the top level of the catalog JSON and retry.');
  process.exit(1);
}

function buildVariants(p) {
  const price = money(p.price);
  const promotional_price = p.promo_pct ? promo(p.price, p.promo_pct) : undefined;
  const stock = p.stock ?? 10;
  if (!p.variants || p.variants.length === 0) {
    return [{ price, promotional_price, stock }];
  }
  return p.variants.map((v, i) => ({
    price, promotional_price,
    stock: typeof stock === 'number' ? stock : (5 + i),
    values: [es(String(v))],
  }));
}

async function main() {
  const store = await getStore();
  console.log(`Store: ${store.name?.es || store.name || store.id} (${store.id})`);

  const catId = {};
  for (const c of cat.categories || []) {
    const created = await createCategory({ name: es(c.name), description: es(c.description || c.name) });
    catId[c.name] = created.id;
    console.log(`+ category ${c.name} -> ${created.id}`);
    await sleep(400);
  }

  const made = [];
  for (const p of cat.products || []) {
    const payload = {
      name: es(p.name),
      description: es(p.description ? `<p>${p.description}</p>` : p.name),
      published: p.published !== false,
    };
    if (p.category && catId[p.category]) payload.categories = [catId[p.category]];
    if (cat.attribute && p.variants?.length) payload.attributes = [es(cat.attribute)];
    payload.variants = buildVariants(p);
    if (p.images?.length) payload.images = p.images.map((src) => ({ src }));
    if (p.free_shipping) payload.free_shipping = true;
    try {
      const created = await createProduct(payload);
      made.push({ id: created.id, name: p.name });
      console.log(`+ product ${p.name} -> ${created.id}`);
    } catch (e) {
      console.error(`! ${p.name}: ${e.message}`);
    }
    await sleep(700);
  }

  console.log(`\nDone. categories=${Object.keys(catId).length} products=${made.length}/${(cat.products || []).length}`);
}

main().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
