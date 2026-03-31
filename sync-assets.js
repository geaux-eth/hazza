#!/usr/bin/env node
// Reads Vite manifest and updates worker/src/pages.ts with correct asset filenames.
// Run after `npm run build` in web/ and before `wrangler deploy` in worker/.
const fs = require('fs');
const path = require('path');

const manifestPath = path.join(__dirname, 'web/dist/.vite/manifest.json');
const pagesPath = path.join(__dirname, 'worker/src/pages.ts');

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const entry = manifest['index.html'];
if (!entry) { console.error('No index.html entry in manifest'); process.exit(1); }

const jsFile = entry.file;            // e.g. "assets/index-BjX17ADf.js"
const cssFile = entry.css?.[0] || ''; // e.g. "assets/index-CdaGkCaa.css"
const xmtpImport = (entry.imports || []).find(i => i.includes('xmtp'));
const xmtpFile = xmtpImport ? manifest[xmtpImport]?.file || xmtpImport.replace(/^_/, 'assets/') : '';

let pages = fs.readFileSync(pagesPath, 'utf8');

// Replace JS entry
pages = pages.replace(
  /assets\/index-[A-Za-z0-9_-]+\.js/g,
  jsFile
);
// Replace CSS entry
if (cssFile) {
  pages = pages.replace(
    /assets\/index-[A-Za-z0-9_-]+\.css/g,
    cssFile
  );
}
// Replace XMTP preload
if (xmtpFile) {
  pages = pages.replace(
    /assets\/xmtp-[A-Za-z0-9_-]+\.js/g,
    xmtpFile
  );
}

fs.writeFileSync(pagesPath, pages);
console.log(`Updated pages.ts: JS=${jsFile} CSS=${cssFile} XMTP=${xmtpFile}`);
