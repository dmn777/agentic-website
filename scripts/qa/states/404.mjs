// 404: served for a real missing path, the title block names that path.
export default {
  route: '/404.html',
  states: [
    {
      name: 'missing-path',
      fullPage: true,
      // Chromium logs the document's own 404; that is the point of this state.
      allowConsole: [/status of 404/],
      run: async (page) => {
        const res = await page.goto(page.url().replace('/404.html', '/no/such-plate/'));
        if (res.status() !== 404) throw new Error(`expected 404, got ${res.status()}`);
        await page.waitForTimeout(300);
        const sheet = await page.locator('[data-sheet]').textContent();
        if (sheet !== '/no/such-plate/ (missing)') throw new Error(`sheet reads "${sheet}"`);
      },
    },
  ],
};
