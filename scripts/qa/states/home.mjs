// Home: the frontispiece re-plots a new specimen on request.
export default {
  route: '/',
  states: [
    {
      name: 'draw-another',
      wait: 3600,
      run: async (page) => {
        const before = await page.locator('[data-hero-plot] svg.plot').innerHTML();
        await page.getByRole('button', { name: /draw another/i }).click();
        await page.getByRole('button', { name: /draw another/i }).click();
        const after = await page.locator('[data-hero-plot] svg.plot').innerHTML();
        const n = await page.locator('[data-hero-n]').textContent();
        if (before === after) throw new Error('specimen did not change');
        if (n !== '3') throw new Error(`specimen counter is ${n}, expected 3`);
      },
    },
    {
      name: 'draw-another-mobile',
      variant: 'mobile-light',
      wait: 3600,
      run: async (page) => {
        const btn = page.getByRole('button', { name: /draw another/i });
        await btn.scrollIntoViewIfNeeded();
        await btn.tap();
      },
    },
  ],
};
