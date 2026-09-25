// Interaction states for the three stats plates (T6): slider changes, a drag, presets, the
// guess game. Each run() asserts that the displayed numbers actually changed.
const text = (page, sel) => page.locator(sel).first().innerText();

export default [
  {
    route: '/lab/stats/sampling/',
    states: [
      {
        name: 'bimodal-n30-draw100',
        run: async (page) => {
          const ex = page.locator('.explorable').first();
          await ex.scrollIntoViewIfNeeded();
          await ex.getByText('Two humps').click();
          await ex.locator('input[type=range]').fill('30');
          await ex.getByRole('button', { name: 'Draw 100' }).click();
          const cap = await text(page, 'figcaption:has-text("Means of")');
          if (!/400 samples of size 30/i.test(cap)) throw new Error(`caption: ${cap}`);
          await page.locator('figure:has-text("Means of")').scrollIntoViewIfNeeded();
        },
      },
      {
        name: 'mobile-run',
        variant: 'mobile-dark',
        wait: 300,
        run: async (page) => {
          const run = page.getByRole('button', { name: 'Run' });
          await run.scrollIntoViewIfNeeded();
          await run.tap();
          await page.waitForTimeout(1500);
          await page.getByRole('button', { name: 'Pause' }).tap();
          const cap = await text(page, 'figcaption:has-text("Means of")');
          const k = Number((cap.match(/Means of ([\d,]+)/i) ?? [, '0'])[1].replace(/,/g, ''));
          if (!(k > 300)) throw new Error(`run did not add samples (${k})`);
        },
      },
    ],
  },
  {
    route: '/lab/stats/base-rates/',
    states: [
      {
        name: 'rare-disease',
        run: async (page) => {
          await page.getByRole('button', { name: 'Rare disease' }).click();
          const v = await text(page, '.verdict');
          if (!/Of the 11 people/.test(v)) throw new Error(`verdict: ${v}`);
          await page.locator('.answer').scrollIntoViewIfNeeded();
        },
      },
      {
        name: 'slider-specificity',
        run: async (page) => {
          const spec = page.locator('input[type=range]').nth(2);
          await spec.scrollIntoViewIfNeeded();
          await spec.fill('0.999');
          const v = await text(page, '.verdict');
          if (!/Of the 10 people/.test(v)) throw new Error(`verdict: ${v}`);
        },
      },
      { name: 'mobile-spam', variant: 'mobile-dark', fullPage: true, run: async (page) => { await page.getByRole('button', { name: 'Spam filter' }).tap(); } },
    ],
  },
  {
    route: '/lab/stats/least-squares/',
    states: [
      {
        name: 'drag-point',
        run: async (page) => {
          const svg = page.locator('svg.plotarea');
          await svg.scrollIntoViewIfNeeded();
          const r0 = await text(page, '.readout div:nth-child(2) dd');
          const c = page.locator('svg.plotarea circle').first();
          const b = await c.boundingBox();
          await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
          await page.mouse.down();
          await page.mouse.move(b.x + 40, b.y - 180, { steps: 8 });
          await page.mouse.up();
          const r1 = await text(page, '.readout div:nth-child(2) dd');
          if (r0 === r1) throw new Error(`r did not change after drag (${r0})`);
        },
      },
      {
        name: 'outlier-squares',
        run: async (page) => {
          await page.locator('svg.plotarea').scrollIntoViewIfNeeded();
          await page.getByRole('button', { name: 'Add a far-out point' }).click();
          await page.getByLabel('Squared residuals').check();
          const n = await text(page, '.readout div:nth-child(5) dd');
          if (n !== '13') throw new Error(`points: ${n}`);
          if (await page.locator('circle.pt--hi').count() < 1) throw new Error('no high-leverage point marked');
        },
      },
      {
        name: 'guess-r',
        run: async (page) => {
          const g = page.locator('.game');
          await g.scrollIntoViewIfNeeded();
          await g.locator('input[type=range]').fill('0.5');
          await g.getByRole('button', { name: 'Check my guess' }).click();
          const res = await text(page, '.game .result');
          if (!/r = -?\d\.\d\d/.test(res)) throw new Error(`result: ${res}`);
        },
      },
      {
        name: 'mobile-tap-add',
        variant: 'mobile-light',
        run: async (page) => {
          const svg = page.locator('svg.plotarea');
          await svg.scrollIntoViewIfNeeded();
          const b = await svg.boundingBox();
          await page.mouse.click(b.x + b.width * 0.85, b.y + b.height * 0.2);
          const n = await text(page, '.readout div:nth-child(5) dd');
          if (n !== '13') throw new Error(`tap did not add a point (points: ${n})`);
        },
      },
    ],
  },
];
