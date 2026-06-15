// Downloads all Etsy media (images + video) per product into images/cards/<id>/
// and writes data/media.json for the product gallery to consume.
// Usage: node scripts/fetch-media.js <path-to-etsy-media.json>
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = process.argv[2] || path.join(ROOT, 'data', 'etsy-media.json');
const CARDS_DIR = path.join(ROOT, 'images', 'cards');

const manifest = JSON.parse(fs.readFileSync(SRC, 'utf8'));

async function download(url, dest) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 1000) throw new Error(`Too small (${buf.length}b): ${url}`);
  fs.writeFileSync(dest, buf);
  return buf.length;
}

(async () => {
  const media = {};
  let okImg = 0, failImg = 0, okVid = 0, failVid = 0;

  for (const [id, entry] of Object.entries(manifest)) {
    const dir = path.join(CARDS_DIR, id);
    fs.mkdirSync(dir, { recursive: true });
    const rec = { images: [], video: null };

    for (let i = 0; i < entry.images.length; i++) {
      const n = String(i + 1).padStart(2, '0');
      const rel = `images/cards/${id}/${n}.jpg`;
      try {
        await download(entry.images[i], path.join(dir, `${n}.jpg`));
        rec.images.push(rel);
        okImg++;
      } catch (e) { console.error(`IMG FAIL ${id} #${i + 1}: ${e.message}`); failImg++; }
    }

    if (entry.video) {
      const rel = `images/cards/${id}/video.mp4`;
      try {
        await download(entry.video, path.join(dir, 'video.mp4'));
        rec.video = rel;
        okVid++;
      } catch (e) { console.error(`VID FAIL ${id}: ${e.message}`); failVid++; }
    }

    media[id] = rec;
    console.log(`${id}: ${rec.images.length} imgs${rec.video ? ' + video' : ''}`);
  }

  fs.writeFileSync(path.join(ROOT, 'data', 'media.json'), JSON.stringify(media, null, 0));
  console.log(`\nDONE images ok=${okImg} fail=${failImg} | videos ok=${okVid} fail=${failVid}`);
})();
