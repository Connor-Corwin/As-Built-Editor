import { chromium } from 'playwright';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const URL = process.env.URL || 'http://localhost:5190/';

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));

await page.goto(URL, { waitUntil: 'networkidle' });

// Create + open a project.
await page.getByPlaceholder(/new project name/i).fill('UI Test Building');
await page.getByRole('button', { name: /create project/i }).click();

// Right drawer is open by default with a Drawings section -> upload there.
await page.getByText(/drop pdf drawings here/i).waitFor({ timeout: 5000 });
await page.setInputFiles('input[type=file][accept*="pdf"]', [
  join(root, 'samples/sample-vector.pdf'),
]);

// Canvas renders (the vector PDF is auto-selected as the only drawing).
await page.waitForFunction(
  () => {
    const c = document.querySelector('canvas');
    return c && c.width > 0;
  },
  { timeout: 10000 },
);
// Give the text layer time to be available before searching.
await page.waitForTimeout(600);

// Search for a known token from the vector sample ("Amplifier").
await page.getByPlaceholder(/search drawing/i).fill('Amplifier');
await page.getByRole('button', { name: /^Find$/ }).click();
await page.waitForTimeout(600);
// Matches found <=> the "No matches" warning bar is absent.
const noMatches = await page
  .getByText(/No matches for/i)
  .isVisible()
  .catch(() => false);
const hasMatches = !noMatches;

// Toggle Fill then Fit.
await page.getByRole('button', { name: /^Fill$/ }).click();
await page.waitForTimeout(300);
const fillPct = await page.locator('text=/%/').first().textContent();
await page.getByRole('button', { name: /^Fit$/ }).click();
await page.waitForTimeout(300);
const fitPct = await page.locator('text=/%/').first().textContent();

// Collapse the drawer; viewer should still show canvas.
await page.getByRole('button', { name: /hide panel/i }).click();
await page.waitForTimeout(300);
const drawerGone = !(await page
  .getByText('Save to file')
  .isVisible()
  .catch(() => false));

await browser.close();

const ok =
  hasMatches && fillPct !== fitPct && drawerGone && errors.length === 0;
console.log(
  JSON.stringify(
    {
      hasMatches,
      fillPct,
      fitPct,
      fitDiffersFromFill: fillPct !== fitPct,
      drawerCollapsed: drawerGone,
      consoleErrors: errors,
      PASS: ok,
    },
    null,
    2,
  ),
);
process.exit(ok ? 0 : 1);
