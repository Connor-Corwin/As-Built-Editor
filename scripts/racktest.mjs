import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await b.newPage({ viewport: { width: 1280, height: 850 } });
const errors=[]; p.on('console',m=>m.type()==='error'&&errors.push(m.text())); p.on('pageerror',e=>errors.push(String(e)));
await p.goto('http://localhost:5193/', { waitUntil: 'networkidle' });
await p.getByPlaceholder(/new project name/i).fill('RackProj');
await p.getByRole('button', { name: /create project/i }).click();
// Open Racks section (collapsible) - click the header
await p.getByPlaceholder(/rack name/i).fill('Rack 1 — Head End');
await p.getByRole('button', { name: /\+ Add rack/ }).click();
// Rack editor should appear; add an Amplifier and a Network Switch
await p.getByRole('button', { name: /Amplifier/ }).click();
await p.getByRole('button', { name: /Network Switch/ }).click();
await p.waitForTimeout(400);
const before = await p.evaluate(() => document.querySelectorAll('.cursor-move').length);

// Drag the first equipment block up by ~5 U (5*26=130px)
const block = p.locator('.cursor-move').first();
const box = await block.boundingBox();
await p.mouse.move(box.x + box.width/2, box.y + box.height/2);
await p.mouse.down();
await p.mouse.move(box.x + box.width/2, box.y + box.height/2 - 130, { steps: 8 });
await p.mouse.up();
await p.waitForTimeout(400);

// Read the selected item's Start U field to confirm it moved
const startU = await p.evaluate(() => {
  const labels = [...document.querySelectorAll('label')];
  const f = labels.find(l => l.textContent.includes('Start U'));
  return f ? f.querySelector('input').value : null;
});

// Reload and confirm persistence: rack + 2 items survive
await p.reload({ waitUntil: 'networkidle' });
await p.getByText('RackProj').click();
  await p.waitForTimeout(300);
  await p.getByText('Rack 1 — Head End').click();
await p.waitForTimeout(500);
const afterReload = await p.evaluate(() => document.querySelectorAll('.cursor-move').length);

await b.close();
const ok = before===2 && Number(startU)>1 && afterReload===2 && errors.length===0;
console.log(JSON.stringify({ blocksAdded: before, startUAfterDrag: startU, blocksAfterReload: afterReload, consoleErrors: errors, PASS: ok }, null, 2));
process.exit(ok?0:1);
