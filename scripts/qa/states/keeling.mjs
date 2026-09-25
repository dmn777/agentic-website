// Scroll positions for the Keeling story (T8): scroll each step to the middle of the
// viewport and assert the sticky chart switched to that step's view.
const at = (i, view, variant = 'desktop-light') => ({
  name: `step-${i}-${view}${variant.startsWith('mobile') ? '-mobile' : ''}`,
  variant,
  wait: 1400,
  run: async (page) => {
    // Put the step's card where a reader would be reading it: mid-viewport on desktop,
    // in the band below the sticky chart (~62 %) on phones.
    const card = page.locator('.step__card').nth(i);
    await card.evaluate((el, mobile) => {
      const r = el.getBoundingClientRect();
      const target = innerHeight * (mobile ? 0.62 : 0.5);
      scrollBy(0, r.top + Math.min(r.height, 120) / 2 - target);
    }, variant.startsWith('mobile'));
    await page.waitForTimeout(1200);
    const got = await page.locator('.story').getAttribute('data-view');
    if (got !== view) throw new Error(`step ${i}: chart shows "${got}", expected "${view}"`);
  },
});

export default {
  route: '/lab/keeling/',
  states: [
    at(0, 'first'),
    at(2, 'cycle'),
    at(4, 'decades'),
    at(5, 'now'),
    at(6, 'gap'),
    at(1, 'years', 'mobile-dark'),
    at(4, 'decades', 'mobile-light'),
  ],
};
