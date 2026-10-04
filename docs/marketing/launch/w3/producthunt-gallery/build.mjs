// Renders the five ProductHunt gallery images at 1270x760, plus the required
// 240x240 listing thumbnail.
//
// Typography and palette are taken from the live site (Newsreader + Manrope,
// navy #0b2b45 on cream #f8ebd6) so the gallery matches heardagain.com and the
// existing OG image rather than approximating it.
//
// Run from the repo root:  node docs/marketing/launch/w3/producthunt-gallery/build.mjs
// Requires the system chromium at /usr/bin/chromium-browser.

import { chromium } from '@playwright/test';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, 'src');

const WIDTH = 1270;
const HEIGHT = 760;

const CREAM = '#f8ebd6';
const NAVY = '#0b2b45';
const NAVY_PANEL = '#16334a';

const WAVE = ['#59397c', '#2b228a', '#344a71', '#146870', '#3f7a6a', '#507564', '#7e8a4f', '#aa9249', '#ce9530', '#f1a72e'];

const dataUri = (file, mime) =>
  `data:${mime};base64,${readFileSync(join(SRC, file)).toString('base64')}`;

const PHOTO_SUNSET = dataUri('photo-family-sunset.jpg', 'image/jpeg');
const SHOT_FEATURES = dataUri('shot-features.png', 'image/png');
const SHOT_SELFHOSTED = dataUri('shot-selfhosted.png', 'image/png');

const BASE_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,200..800;1,6..72,200..800&family=Manrope:wght@300..800&display=swap');
* { margin: 0; padding: 0; box-sizing: border-box; }
body { width: var(--w, ${WIDTH}px); height: var(--h, ${HEIGHT}px); overflow: hidden;
       font-family: Manrope, sans-serif; color: ${NAVY};
       -webkit-font-smoothing: antialiased; }
.frame { position: relative; width: var(--w, ${WIDTH}px); height: var(--h, ${HEIGHT}px); overflow: hidden; background: ${CREAM}; }
.serif { font-family: Newsreader, serif; }
.rule { position: absolute; left: 0; right: 0; bottom: 0; height: 9px;
        background: linear-gradient(90deg, ${WAVE.join(',')}); }
.paper { position: absolute; inset: 0;
         background: radial-gradient(130% 100% at 50% 0%, #fdf6e9 0%, ${CREAM} 55%, #f3e4cd 100%); }
`;

/** The waveform mark from the logo, rebuilt as SVG so it scales cleanly. */
function waveMark(height = 86, scale = 1) {
  const bars = [
    [0.18, 0], [0.26, 1], [0.52, 1], [0.86, 2], [1.0, 3],
    [0.62, 3], [0.34, 4], [0.58, 5], [0.9, 6], [1.0, 6],
    [0.7, 7], [0.42, 8], [0.24, 9], [0.18, 9],
  ];
  const bw = 13 * scale;
  const gap = 9 * scale;
  const h = height * scale;
  const w = bars.length * (bw + gap);
  const rects = bars
    .map(([f, c], i) => {
      const bh = Math.max(bw, h * f);
      return `<rect x="${i * (bw + gap)}" y="${(h - bh) / 2}" width="${bw}" height="${bh}" rx="${bw / 2}" fill="${WAVE[c]}"/>`;
    })
    .join('');
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">${rects}</svg>`;
}

const chip = (label, color) => `
  <span style="display:inline-flex;align-items:center;gap:9px;border:1.5px solid ${color}55;
               border-radius:999px;padding:9px 20px;font-size:15px;font-weight:600;
               letter-spacing:.02em;color:${NAVY};">
    <span style="width:9px;height:9px;border-radius:50%;background:${color};"></span>${label}
  </span>`;

const images = [
  {
    file: '01-hero.png',
    html: `
      <div class="frame">
        <div class="paper"></div>
        <div style="position:absolute;inset:0;display:flex;flex-direction:column;
                    align-items:center;justify-content:center;gap:0;">
          <div style="margin-bottom:34px;">${waveMark(92)}</div>
          <div class="serif" style="font-size:118px;font-weight:500;letter-spacing:-.015em;line-height:1;">Heard Again</div>
          <div style="display:flex;align-items:center;gap:18px;margin:34px 0 26px;">
            <span style="width:120px;height:1px;background:${NAVY}40;"></span>
            <span style="width:7px;height:7px;background:${NAVY}66;transform:rotate(45deg);"></span>
            <span style="width:120px;height:1px;background:${NAVY}40;"></span>
          </div>
          <div class="serif" style="font-size:38px;font-weight:400;">Family stories, preserved with care.</div>
          <div style="display:flex;gap:16px;margin-top:46px;">
            ${chip('Voice Preservation', '#59397c')}
            ${chip('Family Stories', '#146870')}
            ${chip('Consent First', '#ce9530')}
          </div>
        </div>
        <div class="rule"></div>
      </div>`,
  },
  {
    file: '02-why.png',
    html: `
      <div class="frame">
        <img src="${PHOTO_SUNSET}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;"/>
        <div style="position:absolute;inset:0;
                    background:linear-gradient(180deg, rgba(11,43,69,.60) 0%, rgba(11,43,69,.05) 26%, rgba(11,43,69,.55) 50%, rgba(11,43,69,.93) 72%, rgba(11,43,69,.97) 100%);"></div>
        <div style="position:absolute;top:44px;left:56px;display:flex;align-items:center;gap:16px;">
          <div style="filter:grayscale(1) brightness(3);">${waveMark(30)}</div>
          <span class="serif" style="font-size:27px;color:#fff;font-weight:500;">Heard Again</span>
        </div>
        <div style="position:absolute;left:56px;right:56px;bottom:66px;">
          <div class="serif" style="font-size:60px;line-height:1.14;color:#fff;font-weight:500;max-width:900px;">
            Record the stories you&rsquo;ll want to hear again.
          </div>
          <div style="margin-top:20px;font-size:21px;line-height:1.5;color:#ffffffd0;font-weight:400;max-width:830px;">
            Voices, photographs, letters and handwriting &mdash; gathered while the people
            who remember them are still here to explain them.
          </div>
        </div>
        <div class="rule"></div>
      </div>`,
  },
  {
    file: '03-what-it-does.png',
    html: `
      <div class="frame">
        <div class="paper"></div>
        <div style="position:absolute;top:62px;left:66px;right:66px;">
          <div style="font-size:13px;letter-spacing:.22em;font-weight:700;color:${NAVY}88;">WHAT IT DOES</div>
          <div class="serif" style="font-size:54px;font-weight:500;margin-top:14px;line-height:1.1;">
            A voice lab, a scrapbook, and a transcript pipeline.
          </div>
          <div style="margin-top:18px;font-size:19px;line-height:1.55;color:${NAVY}b0;max-width:880px;">
            One archive for the recordings, the photographs and the paperwork &mdash; linked
            to the people in your family tree.
          </div>
        </div>
        <img src="${SHOT_FEATURES}"
             style="position:absolute;left:66px;width:1138px;top:300px;border-radius:12px;
                    box-shadow:0 24px 54px rgba(11,43,69,.15);"/>
        <div class="rule"></div>
      </div>`,
  },
  {
    file: '04-open-source.png',
    html: `
      <div class="frame" style="display:flex;">
        <div style="width:468px;height:100%;background:${NAVY_PANEL};padding:68px 52px;
                    display:flex;flex-direction:column;justify-content:center;">
          <div style="font-size:13px;letter-spacing:.22em;font-weight:700;color:#ffffff99;">MIT LICENSED</div>
          <div class="serif" style="font-size:47px;line-height:1.16;color:#fff;font-weight:500;margin-top:20px;">
            Open source.<br/>Self&#8209;hostable.<br/>Your family&rsquo;s data stays yours.
          </div>
          <div style="margin-top:30px;font-size:18px;line-height:1.65;color:#ffffffcc;">
            Run it on your own hardware for nothing, forever. Paid plans unlock no
            extra features &mdash; they rent you the GPU, the storage and the tunnel,
            so you do not have to run one.
          </div>
          <div style="margin-top:34px;font-size:16px;color:#ffffff99;font-family:Manrope;">
            github.com/preludeofme/heard-again
          </div>
        </div>
        <div style="flex:1;position:relative;background:${CREAM};
                    display:flex;align-items:center;justify-content:center;padding:0 40px;">
          <img src="${SHOT_SELFHOSTED}"
               style="width:100%;border-radius:12px;box-shadow:0 22px 52px rgba(11,43,69,.14);"/>
        </div>
        <div class="rule"></div>
      </div>`,
  },
  {
    file: '05-start.png',
    html: `
      <div class="frame">
        <div class="paper"></div>
        <div style="position:absolute;inset:0;display:flex;flex-direction:column;
                    align-items:center;justify-content:center;">
          <div style="margin-bottom:40px;opacity:.9;">${waveMark(54)}</div>
          <div class="serif" style="font-size:72px;font-weight:500;line-height:1.14;text-align:center;max-width:720px;">
            Start your family archive this week.
          </div>
          <div style="margin-top:26px;font-size:23px;color:${NAVY}cc;">
            Open source. Consent&#8209;first. Free to self&#8209;host.
          </div>
          <div style="display:flex;align-items:center;gap:26px;margin-top:52px;font-size:19px;font-weight:600;color:${NAVY}dd;">
            <span>heardagain.com</span>
            <span style="width:5px;height:5px;border-radius:50%;background:${NAVY}66;"></span>
            <span>github.com/preludeofme/heard-again</span>
          </div>
          <div style="margin-top:46px;font-size:16px;color:${NAVY}99;">
            Cloud plans from $4.99/mo &middot; 14&#8209;day free trial &middot; or run it yourself for nothing
          </div>
        </div>
        <div class="rule"></div>
      </div>`,
  },
  {
    // ProductHunt's square listing thumbnail. It renders down to roughly 60px
    // in the homepage feed, where a wordmark turns to mush, so this is the
    // waveform alone at the largest size the square will hold.
    file: 'thumbnail-240.png',
    width: 240,
    height: 240,
    html: `
      <div class="frame">
        <div class="paper"></div>
        <div style="position:absolute;inset:0;display:flex;
                    align-items:center;justify-content:center;">
          <div style="transform:scale(.62);transform-origin:center;">${waveMark(190)}</div>
        </div>
      </div>`,
  },
];

const browser = await chromium.launch({
  executablePath: '/usr/bin/chromium-browser',
  args: ['--no-sandbox'],
});
const page = await browser.newPage({
  viewport: { width: WIDTH, height: HEIGHT },
  deviceScaleFactor: 1,
});

const tmpPath = join(HERE, '.render.html');

for (const { file, html, width = WIDTH, height = HEIGHT } of images) {
  const sizeVars = `:root { --w: ${width}px; --h: ${height}px; }`;
  // sizeVars goes after BASE_CSS: the @import must stay the first rule in the
  // sheet or Chromium drops the webfonts.
  const doc = `<!doctype html><html><head><meta charset="utf-8"><style>${BASE_CSS}${sizeVars}</style></head><body>${html}</body></html>`;
  writeFileSync(tmpPath, doc);
  await page.setViewportSize({ width, height });
  await page.goto(`file://${tmpPath}`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(HERE, file) });
  console.log('wrote', file, `${width}x${height}`);
}

await browser.close();
rmSync(tmpPath, { force: true });
