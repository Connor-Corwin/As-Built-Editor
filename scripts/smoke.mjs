import { chromium } from 'playwright';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const URL = process.env.URL || 'http://localhost:5188/';

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
const page = await browser.newPage();
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));

await page.goto(URL, { waitUntil: 'networkidle' });

// Create a project.
await page.getByPlaceholder(/new project name/i).fill('Smoke Test Building');
await page.getByRole('button', { name: /create project/i }).click();

// Should now be in the workspace.
await page.getByText(/drop pdf drawings here/i).waitFor({ timeout: 5000 });

// Upload both sample PDFs.
await page.setInputFiles('input[type=file]', [
  join(root, 'samples/sample-vector.pdf'),
  join(root, 'samples/sample-scanned.pdf'),
]);

// Wait for both uploads to land in the sidebar list.
await page.locator('aside ul li').nth(1).waitFor({ timeout: 10000 });

// Wait for the canvas (rendered PDF page) to appear with real dimensions.
await page.waitForFunction(() => {
  const c = document.querySelector('canvas');
  return c && c.width > 0 && c.height > 0;
}, { timeout: 10000 });

const docCount = await page.locator('aside ul li').count();
const pageLabel = await page.locator('text=/\\d+ \\/ \\d+/').first().textContent();
const canvas = await page.locator('canvas').first().boundingBox();

// Reload and confirm persistence (IndexedDB) — project + docs survive.
await page.reload({ waitUntil: 'networkidle' });
await page.getByText('Smoke Test Building').click();
await page.locator('aside ul li').first().waitFor({ timeout: 10000 });
const docCountAfter = await page.locator('aside ul li').count();

await browser.close();

const ok = docCount === 2 && docCountAfter === 2 && canvas && canvas.width > 10;
console.log(JSON.stringify({
  docCountBeforeReload: docCount,
  docCountAfterReload: docCountAfter,
  pageLabel: pageLabel?.trim(),
  canvasRendered: !!canvas,
  consoleErrors: errors,
  PASS: ok,
}, null, 2));
process.exit(ok && errors.length === 0 ? 0 : 1);
