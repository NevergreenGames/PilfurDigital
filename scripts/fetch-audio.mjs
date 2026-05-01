#!/usr/bin/env node
// Optional: bulk-download licensed audio tracks into public/audio/.
//
// Usage:
//   node scripts/fetch-audio.mjs            # download all stations
//   node scripts/fetch-audio.mjs --station jazz
//   node scripts/fetch-audio.mjs --force    # overwrite existing files
//
// Fill in the TRACKS table below with direct download URLs you've vetted
// for license (CC0 / CC-BY 4.0). Leave entries as `null` to skip — the
// audio engine treats missing files as silence, so partial fills work fine.

import fs from 'node:fs';
import https from 'node:https';
import http from 'node:http';
import path from 'node:path';

// stations × contexts = up to 12 cells. URL string or null.
const TRACKS = {
  jazz: {
    idle: null,
    heist: null,
    outcome: null,
  },
  tense: {
    idle: null,
    heist: null,
    outcome: null,
  },
  piano: {
    idle: null,
    heist: null,
    outcome: null,
  },
  lofi: {
    idle: null,
    heist: null,
    outcome: null,
  },
};

const args = new Set(process.argv.slice(2));
const force = args.has('--force');
let onlyStation = null;
const sIdx = process.argv.indexOf('--station');
if (sIdx >= 0 && process.argv[sIdx + 1]) {
  onlyStation = process.argv[sIdx + 1];
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https://') ? https : http;
    const req = client.get(url, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        // follow redirect
        res.resume();
        download(res.headers.location, dest).then(resolve, reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        res.resume();
        return;
      }
      const out = fs.createWriteStream(dest);
      res.pipe(out);
      out.on('finish', () => out.close(resolve));
      out.on('error', reject);
    });
    req.on('error', reject);
  });
}

async function main() {
  const root = path.resolve(process.cwd(), 'public', 'audio');
  fs.mkdirSync(root, { recursive: true });

  let attempted = 0;
  let written = 0;
  let skipped = 0;

  for (const [station, contexts] of Object.entries(TRACKS)) {
    if (onlyStation && station !== onlyStation) continue;
    const dir = path.join(root, station);
    fs.mkdirSync(dir, { recursive: true });
    for (const [context, url] of Object.entries(contexts)) {
      const dest = path.join(dir, `${context}.mp3`);
      if (!url) {
        console.log(`-- ${station}/${context}: no URL configured, skipping`);
        skipped += 1;
        continue;
      }
      if (!force && fs.existsSync(dest)) {
        console.log(`== ${station}/${context}: already present, skipping (use --force to overwrite)`);
        skipped += 1;
        continue;
      }
      attempted += 1;
      try {
        console.log(`>> ${station}/${context}: ${url}`);
        await download(url, dest);
        written += 1;
      } catch (err) {
        console.error(`!! ${station}/${context}: failed: ${err.message}`);
      }
    }
  }

  console.log(`\nDone. ${written} written, ${skipped} skipped, ${attempted - written} failed.`);
  process.exit(attempted > 0 && written === 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
