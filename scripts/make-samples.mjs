/**
 * Generates two sample PDFs under samples/ for manual + automated testing:
 *  - sample-vector.pdf   : crisp text/linework, like a CAD/Visio export.
 *  - sample-scanned.pdf  : a rasterized image page, like a scanned drawing.
 * Run with: node scripts/make-samples.mjs
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'samples');
await mkdir(outDir, { recursive: true });

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
const page = await browser.newPage();

const vectorHtml = `<!doctype html><html><body style="font-family:sans-serif;padding:40px">
  <h1>AVL As-Built — Building A</h1>
  <h2>Rack 1 Elevation (sample vector page)</h2>
  <table border="1" cellpadding="6" style="border-collapse:collapse">
    <tr><th>RU</th><th>Equipment</th></tr>
    <tr><td>42</td><td>Patch Panel</td></tr>
    <tr><td>40-41</td><td>Network Switch</td></tr>
    <tr><td>38-39</td><td>DSP / Audio Matrix</td></tr>
    <tr><td>1-3</td><td>Amplifier</td></tr>
  </table>
  <p>Connections: DSP OUT 1 → AMP IN 1 (audio), SW P1 → DSP NET (network).</p>
</body></html>`;

await page.setContent(vectorHtml, { waitUntil: 'load' });
await page.pdf({ path: join(outDir, 'sample-vector.pdf'), format: 'Letter' });

// A "scanned" page: a single rasterized image filling the page.
const scannedHtml = `<!doctype html><html><body style="margin:0">
  <img style="width:100%;display:block" src="data:image/svg+xml;base64,${Buffer.from(
    `<svg xmlns='http://www.w3.org/2000/svg' width='850' height='1100'>
       <rect width='850' height='1100' fill='#f4f1e8'/>
       <text x='60' y='90' font-size='34' font-family='monospace' fill='#222'>SCANNED AS-BUILT (raster)</text>
       <rect x='60' y='140' width='730' height='420' fill='none' stroke='#333' stroke-width='2'/>
       <text x='80' y='190' font-size='20' fill='#333'>Conference Room AV — signal flow</text>
       <line x1='80' y1='260' x2='760' y2='260' stroke='#333'/>
       <line x1='80' y1='340' x2='760' y2='340' stroke='#333'/>
     </svg>`,
  ).toString('base64')}"/>
</body></html>`;

await page.setContent(scannedHtml, { waitUntil: 'load' });
await page.pdf({ path: join(outDir, 'sample-scanned.pdf'), format: 'Letter' });

await browser.close();
console.log('Wrote samples/sample-vector.pdf and samples/sample-scanned.pdf');
