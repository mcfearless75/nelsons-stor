#!/usr/bin/env node
/**
 * Phase 0e — migrate local card media to Supabase Storage + product_media.
 *
 * Reads data/media.json, uploads every image/video under images/cards/** to the
 * `card-media` Storage bucket, then rebuilds the product_media rows (idempotent).
 *
 * No npm install needed — uses Node 18+ global fetch and the Storage/PostgREST
 * REST APIs directly with the service-role key.
 *
 * Run (PowerShell):
 *   $env:SUPABASE_URL="https://hysikygygqzbmgkajpwo.supabase.co"
 *   $env:SUPABASE_SERVICE_ROLE_KEY="<service-role key from dashboard>"
 *   node scripts/migrate-media.js
 *
 * Safe to re-run: storage uploads upsert, and product_media rows are cleared
 * per-product before re-insert.
 */

const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = 'card-media';
const ROOT = path.resolve(__dirname, '..');
const MEDIA_JSON = path.join(ROOT, 'data', 'media.json');

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('ERROR: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment first.');
  process.exit(1);
}

const contentType = (file) => {
  const ext = path.extname(file).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.mp4') return 'video/mp4';
  return 'application/octet-stream';
};

const publicUrl = (objectPath) =>
  `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${objectPath}`;

async function uploadFile(localRelPath, objectPath) {
  const abs = path.join(ROOT, localRelPath);
  if (!fs.existsSync(abs)) {
    console.warn(`  ! missing local file, skipping: ${localRelPath}`);
    return false;
  }
  const body = fs.readFileSync(abs);
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${objectPath}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SERVICE_KEY}`,
      apikey: SERVICE_KEY,
      'Content-Type': contentType(localRelPath),
      'x-upsert': 'true',
    },
    body,
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`upload failed ${objectPath}: ${res.status} ${txt}`);
  }
  return true;
}

async function clearProductMedia(productId) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/product_media?product_id=eq.${encodeURIComponent(productId)}`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${SERVICE_KEY}`,
        apikey: SERVICE_KEY,
        Prefer: 'return=minimal',
      },
    }
  );
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`clear product_media failed ${productId}: ${res.status} ${txt}`);
  }
}

async function insertMediaRows(rows) {
  if (rows.length === 0) return;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/product_media`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SERVICE_KEY}`,
      apikey: SERVICE_KEY,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`insert product_media failed: ${res.status} ${txt}`);
  }
}

async function main() {
  const media = JSON.parse(fs.readFileSync(MEDIA_JSON, 'utf8'));
  const productIds = Object.keys(media);
  console.log(`Migrating media for ${productIds.length} products to ${SUPABASE_URL}\n`);

  let totalFiles = 0;
  let totalRows = 0;

  for (const productId of productIds) {
    const entry = media[productId];
    const images = Array.isArray(entry.images) ? entry.images : [];
    const video = entry.video || null;
    const rows = [];
    let sort = 0;

    console.log(`• ${productId} (${images.length} images${video ? ' + video' : ''})`);

    for (const imgRel of images) {
      const objectPath = `${productId}/${path.basename(imgRel)}`;
      const ok = await uploadFile(imgRel, objectPath);
      if (ok) {
        rows.push({ product_id: productId, type: 'image', url: publicUrl(objectPath), sort_order: sort++ });
        totalFiles++;
      }
    }

    if (video) {
      const objectPath = `${productId}/${path.basename(video)}`;
      const ok = await uploadFile(video, objectPath);
      if (ok) {
        rows.push({ product_id: productId, type: 'video', url: publicUrl(objectPath), sort_order: sort++ });
        totalFiles++;
      }
    }

    await clearProductMedia(productId);
    await insertMediaRows(rows);
    totalRows += rows.length;
  }

  console.log(`\nDone. Uploaded ${totalFiles} files, wrote ${totalRows} product_media rows.`);
}

main().catch((err) => {
  console.error('\nMIGRATION FAILED:', err.message);
  process.exit(1);
});
