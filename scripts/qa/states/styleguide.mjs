// Interaction states for the design-system surface (T4).
export default {
  route: '/styleguide/',
  states: [
    {
      name: 'theme-toggled',
      // Starts in light (system), clicks the header toggle: the page must switch to dark
      // and remember it.
      run: async (page) => {
        await page.click('[data-theme-toggle]');
        const t = await page.evaluate(() => [document.documentElement.dataset.theme, localStorage.getItem('theme')]);
        if (t[0] !== 'dark' || t[1] !== 'dark') throw new Error(`toggle failed: ${t}`);
      },
    },
    {
      name: 'card-hover',
      run: async (page) => {
        const card = page.locator('.lab-card').first();
        await card.scrollIntoViewIfNeeded();
        await card.hover();
        await page.waitForTimeout(2200); // let the re-plot finish
      },
    },
    {
      name: 'keyboard-focus',
      run: async (page) => {
        await page.locator('.btn--primary').first().scrollIntoViewIfNeeded();
        await page.locator('.btn--primary').first().focus();
        await page.keyboard.press('Shift+Tab');
        await page.keyboard.press('Tab');
      },
    },
    {
      name: 'playground-ridge',
      run: async (page) => {
        const pg = page.locator('.playground');
        await pg.scrollIntoViewIfNeeded();
        await pg.locator('select').selectOption('ridge');
        await pg.locator('input[type=range]').fill('1.2');
        await page.waitForTimeout(3200);
        const n = await pg.locator('svg.plot path').count();
        const sp = await pg.locator('svg.plot').getAttribute('aria-label');
        if (n < 20) throw new Error(`playground did not re-plot (paths=${n}, ${sp})`);
      },
    },
    {
      name: 'mobile-playground',
      variant: 'mobile-dark',
      run: async (page) => {
        await page.locator('.playground').scrollIntoViewIfNeeded();
        await page.locator('.playground button').tap();
        await page.waitForTimeout(2600);
      },
    },
  ],
};
