// Chladni plate (T10): mode change settles into a figure; the theory overlay draws lines;
// the tone button is opt-in (and never autoplays).
const settled = async (page) => {
  await page.waitForFunction(() => /at rest/i.test(document.querySelector('.readout div:nth-child(3) dd')?.textContent ?? ''), null, { timeout: 15000 });
};
export default {
  route: '/lab/chladni/',
  states: [
    {
      name: 'mode-3-4-settled',
      run: async (page) => {
        await page.locator('.chladni').scrollIntoViewIfNeeded();
        await page.getByRole('radio', { name: '3 · 4' }).check();
        await settled(page);
        const share = Number((await page.locator('.readout div:nth-child(3) dd').textContent()).match(/(\d+)%/)[1]);
        if (share < 40) throw new Error(`only ${share}% of the sand settled on nodal lines`);
      },
    },
    {
      name: 'theory-overlay',
      run: async (page) => {
        await page.locator('.chladni').scrollIntoViewIfNeeded();
        await settled(page);
        const before = await page.locator('.chladni canvas').evaluate((c) => c.toDataURL());
        await page.getByLabel('Show the theory').check();
        await page.waitForTimeout(300);
        const after = await page.locator('.chladni canvas').evaluate((c) => c.toDataURL());
        if (before === after) throw new Error('theory overlay did not draw');
      },
    },
    {
      name: 'tone-is-opt-in',
      run: async (page) => {
        await page.locator('.chladni').scrollIntoViewIfNeeded();
        const off = await page.getByRole('button', { name: /tone/i }).getAttribute('aria-pressed');
        if (off !== 'false') throw new Error('tone should start off');
        await page.getByRole('button', { name: /tone/i }).click();
        const on = await page.getByRole('button', { name: /tone/i }).getAttribute('aria-pressed');
        if (on !== 'true') throw new Error('tone toggle did not switch on');
        await page.getByRole('button', { name: 'Shake the plate' }).click();
        await page.waitForTimeout(600);
      },
    },
    {
      name: 'mobile-dark',
      variant: 'mobile-dark',
      run: async (page) => { await page.locator('.chladni').scrollIntoViewIfNeeded(); await settled(page); },
    },
  ],
};
