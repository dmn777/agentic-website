// Interaction states for the gallery (T7): hover-animation, detail view via click and via
// the URL hash, a parameter change, and mobile.
export default {
  route: '/lab/art/',
  states: [
    {
      name: 'hover-animates',
      run: async (page) => {
        const c = page.locator('.piece__canvas').nth(2);
        await c.scrollIntoViewIfNeeded();
        await page.waitForTimeout(400);
        const before = await c.evaluate((el) => el.toDataURL());
        await c.hover();
        await page.waitForTimeout(700);
        const mid = await c.evaluate((el) => el.toDataURL());
        if (before === mid) throw new Error('hover did not animate the thumbnail');
      },
    },
    {
      name: 'detail-open',
      wait: 4500,
      run: async (page) => {
        await page.locator('.piece__frame').first().click();
        await page.locator('dialog[open] .detail__canvas').waitFor();
        const hash = await page.evaluate(() => location.hash);
        if (!/^#art=combed&seed=11$/.test(hash)) throw new Error(`hash is ${hash}`);
      },
    },
    {
      name: 'detail-param',
      wait: 800,
      run: async (page) => {
        await page.goto(page.url().split('#')[0] + '#art=survey&seed=99');
        await page.reload();
        await page.locator('dialog[open] .detail__canvas').waitFor();
        await page.waitForTimeout(4000);
        const before = await page.locator('.detail__canvas').evaluate((el) => el.toDataURL());
        await page.locator('dialog input[type=range]').first().fill('10');
        await page.waitForTimeout(500);
        const after = await page.locator('.detail__canvas').evaluate((el) => el.toDataURL());
        if (before === after) throw new Error('parameter change did not redraw');
        const label = await page.locator('dialog .label').first().innerText();
        if (!/seed 99/i.test(label)) throw new Error(`label: ${label}`);
      },
    },
    {
      name: 'detail-dark-mobile',
      variant: 'mobile-dark',
      wait: 4500,
      run: async (page) => {
        await page.locator('.piece__frame').nth(5).scrollIntoViewIfNeeded();
        await page.locator('.piece__frame').nth(5).tap();
        await page.locator('dialog[open] .detail__canvas').waitFor();
      },
    },
  ],
};
