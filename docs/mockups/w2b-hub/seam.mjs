// Colour-seam probe: node docs/mockups/w2b-hub/seam.mjs <png>...
// Reads a column of pixels (x = 6 CSS px, outside every card, so only page ground and hub fade) and
// reports the largest one-row colour step (max channel difference, 0-255). A hard edge reads as a
// single big step; a fade as many small ones. Also the step where the header card / first role card
// meets the hub ground (their edge column at x = 195).
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
const page = await br.newPage();
for (const f of process.argv.slice(2)) {
  const b64 = readFileSync(f).toString('base64');
  const r = await page.evaluate(async (src) => {
    const img = new Image(); img.src = src; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    const col = (x) => { const d = g.getImageData(x, 0, 1, img.height).data; const px = []; for (let i = 0; i < d.length; i += 4) px.push([d[i], d[i + 1], d[i + 2]]); return px; };
    const steps = (px) => { let max = 0, at = 0; for (let y = 1; y < px.length; y++) { const s = Math.max(...px[y].map((v, k) => Math.abs(v - px[y - 1][k]))); if (s > max) { max = s; at = y; } } return { maxStep: max, atCssY: Math.round(at / 2) }; };
    const ground = col(12);
    // Ignore the site header's 3px gradient bar (rows 0-8 at 2x): not part of the hub.
    return { height: img.height / 2, ground: steps(ground.slice(10)), groundTop: ground[20], groundMid: ground[Math.floor(img.height / 2)], groundBottom: ground[img.height - 4] };
  }, `data:image/png;base64,${b64}`);
  console.log(f.split('/').pop(), JSON.stringify(r));
}
await br.close();
