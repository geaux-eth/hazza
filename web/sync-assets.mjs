#!/usr/bin/env node
/**
 * Post-build script: reads Vite's manifest.json and updates
 * the hardcoded asset filenames in worker/src/pages.ts.
 *
 * Run after every `vite build`:
 *   node sync-assets.mjs
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const manifestPath = resolve(__dirname, 'dist/.vite/manifest.json');
const pagesPath = resolve(__dirname, '../worker/src/pages.ts');

// Read manifest
let manifest;
try {
  manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
} catch (e) {
  console.error('Could not read manifest at', manifestPath);
  console.error('Run `npm run build` first (with manifest: true in vite.config.ts)');
  process.exit(1);
}

// Extract filenames from manifest
// Entry point: src/main.tsx → produces the main JS + CSS
const entry = manifest['src/main.tsx'] || manifest['index.html'];
if (!entry) {
  console.error('Could not find entry point in manifest. Keys:', Object.keys(manifest));
  process.exit(1);
}

const mainJs = entry.file; // e.g. "assets/index-BX5alvrp.js"
const mainCss = entry.css?.[0]; // e.g. "assets/index-Cm8Pt-ao.css"

// Find xmtp chunk
let xmtpJs = null;
for (const [key, val] of Object.entries(manifest)) {
  if (key.includes('xmtp') || (val.file && val.file.includes('xmtp'))) {
    xmtpJs = val.file;
    break;
  }
}

// Extract just the filename (strip "assets/" prefix)
const jsFile = mainJs?.replace('assets/', '') || null;
const cssFile = mainCss?.replace('assets/', '') || null;
const xmtpFile = xmtpJs?.replace('assets/', '') || null;

console.log('Manifest entries:');
console.log('  JS:   ', jsFile || 'NOT FOUND');
console.log('  CSS:  ', cssFile || 'NOT FOUND');
console.log('  XMTP: ', xmtpFile || 'NOT FOUND');

// Read pages.ts
let pages = readFileSync(pagesPath, 'utf8');
let updated = false;

// Replace CSS filename
if (cssFile) {
  const cssRegex = /index-[A-Za-z0-9_-]+\.css/g;
  const before = pages;
  pages = pages.replace(cssRegex, cssFile);
  if (pages !== before) { updated = true; console.log('  Updated CSS →', cssFile); }
}

// Replace main JS filename
if (jsFile) {
  // Match the entry JS (the one in the <script> tag, not modulepreload)
  const jsRegex = /(?<=src="\$\{SPA_ASSET_BASE\}\/assets\/)index-[A-Za-z0-9_-]+\.js/g;
  const before = pages;
  pages = pages.replace(jsRegex, jsFile);
  if (pages !== before) { updated = true; console.log('  Updated JS →', jsFile); }
}

// Replace XMTP chunk filename
if (xmtpFile) {
  const xmtpRegex = /xmtp-[A-Za-z0-9_-]+\.js/g;
  const before = pages;
  pages = pages.replace(xmtpRegex, xmtpFile);
  if (pages !== before) { updated = true; console.log('  Updated XMTP →', xmtpFile); }
}

if (updated) {
  writeFileSync(pagesPath, pages);
  console.log('\npages.ts updated successfully.');
} else {
  console.log('\nNo changes needed — filenames already match.');
}
