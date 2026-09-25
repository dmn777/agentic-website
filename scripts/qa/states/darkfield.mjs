// Darkfield (Plate VIII): in-game states for qa:shots. The runner loads the page without the
// test hook; each state reloads it with ?test=1 and drives window.__game (and the bot
// library window.__qa from game-driver.mjs) to a known moment, asserts that the moment
// really is on screen, and leaves the canvas drawn for the shot. In test mode nothing
// redraws the canvas between steps, so the shot shows exactly the last drawn frame.
import { gameReady, game, act, press } from '../game-driver.mjs';

const testMode = async (page) => {
  await page.goto(new URL('?test=1', page.url()).href, { waitUntil: 'load' });
  await gameReady(page);
  await page.evaluate(() => window.__qa.useVirtualClock()); // effects age with the ticks
};
/** A new run from the seed, started with the real Start button (a hook start would leave
 *  the stage's keyboard focus ring showing, which a player never sees). */
const startRun = async (page, seed) => { await game(page, 'seed', seed); return press(page, 'start'); };
const fail = (msg, s) => { throw new Error(`${msg} (${JSON.stringify({ mode: s.mode, t: s.t, score: s.score, diatoms: s.diatoms, hazards: s.hazards, trailPoints: s.trailPoints })})`); };
const visible = (page, sel) => page.locator(sel).isVisible();

const captureMoment = async (page) => {
        await testMode(page);
        await startRun(page, 'shot-capture');
        await game(page, 'cheat', { hazards: 'off' });
        let best = null;
        for (let i = 0; i < 6; i++) {
          await page.evaluate(() => window.__qa.begin({ loopAround: 'cluster' }));
          let r;
          do r = await page.evaluate(() => window.__qa.run({ stopOnEvents: true })); while (r.reason === 'event' && !r.events.some((e) => e.type === 'capture'));
          const cap = r.events.find((e) => e.type === 'capture');
          if (cap && (!best || cap.caught > best.caught)) best = cap;
          if (cap?.caught >= 2 || r.state.mode !== 'play') break;
        }
        if (!best) fail('no loop captured anything', await game(page, 'getState'));
        // The run stopped on the capture tick; age the effects a little (100 ms) and redraw.
        await page.evaluate(() => window.__qa.redraw(100));
        const s = await game(page, 'getState');
        if (s.stats.captured < 1 || s.score <= 0) fail('the capture did not score', s);
};

export default {
  route: '/lab/darkfield/',
  states: [
    {
      // A run in progress: two catches banked, contaminants in, the pen part-way round a
      // third diatom so the wet line curves across the field.
      name: 'playing',
      variant: 'desktop-light',
      wait: 100,
      run: async (page) => {
        await testMode(page);
        let s;
        for (const seed of ['shot-playing', 'shot-playing-2', 'shot-playing-3']) {
          await startRun(page, seed);
          for (let i = 0; i < 2; i++) s = (await act(page, { loopAround: 'nearest', radius: 85 })).state;
          if (s.mode === 'play') s = (await act(page, { loopAround: 'nearest', radius: 110 }, { budget: 150 })).state;
          if (s.mode === 'play' && s.hazards >= 1 && s.diatoms >= 3 && s.trailPoints >= 60 && s.score > 0) break;
        }
        if (s.mode !== 'play') fail('the run ended before the shot', s);
        if (s.score <= 0 || s.diatoms < 3 || s.hazards < 1 || s.trailPoints < 60) fail('the field is missing catches, diatoms, a contaminant or the line', s);
      },
    },
    {
      // The frame just after a loop closes: the hatched wash, the "+points ×n" label, the
      // catches flashing. Contaminants are off (a cheat) so nothing interrupts the loops.
      name: 'capture',
      variant: 'desktop-light',
      wait: 100,
      run: captureMoment,
    },
    {
      // The same moment under reduced motion: the wash and label, no flights (visual QA m13).
      name: 'capture-rm',
      variant: 'desktop-light-rm',
      wait: 100,
      run: captureMoment,
    },
    {
      // The title screen's attract mode: the field drifts behind the card (visual QA M5).
      name: 'title-attract',
      variant: 'desktop-dark',
      run: async (page) => {
        const canvas = page.locator('.darkfield canvas');
        await canvas.scrollIntoViewIfNeeded();
        const a = await canvas.evaluate((c) => c.toDataURL());
        await page.waitForTimeout(700);
        const b = await canvas.evaluate((c) => c.toDataURL());
        if (a === b) throw new Error('the title field does not move');
      },
    },
    {
      // Keyboard focus on the field, reached with Tab (visual QA m13).
      name: 'focus',
      variant: 'desktop-light',
      run: async (page) => {
        await page.locator('.darkfield').scrollIntoViewIfNeeded();
        await page.locator('[data-action="sound"]').focus();
        await page.keyboard.press('Tab');
        await page.keyboard.press('Shift+Tab');
        await page.keyboard.press('Tab');
        const ok = await page.evaluate(() => document.activeElement?.matches('.darkfield [data-action="pause"], .darkfield .stage'));
        if (!ok) throw new Error(`focus went to ${await page.evaluate(() => document.activeElement?.outerHTML.slice(0, 80))}`);
      },
    },
    {
      name: 'paused',
      variant: 'desktop-light',
      run: async (page) => {
        await testMode(page);
        await startRun(page, 'shot-paused');
        await act(page, { loopAround: 'nearest' });
        await page.evaluate(() => window.__qa.step(45));
        const s = await press(page, 'pause');
        if (s.mode !== 'paused') fail('the Pause button did not pause', s);
        if (!(await visible(page, '[data-screen="paused"]'))) fail('the paused card is not showing', s);
      },
    },
    {
      // Game over on a phone: the result card over the ink blot, the thumb buttons below.
      name: 'over-mobile',
      variant: 'mobile-dark',
      wait: 100,
      run: async (page) => {
        await testMode(page);
        let s = await startRun(page, 'shot-over');
        for (let i = 0; i < 40 && s.mode === 'play'; i++) s = (await act(page, { loopAround: 'nearest' })).state;
        while (s.mode === 'play') s = await page.evaluate(() => window.__qa.step(600));
        if (s.mode !== 'over') fail('the run did not end', s);
        s = await page.evaluate(() => window.__qa.redraw(600)); // let the ink blot bloom
        await page.locator('.darkfield').evaluate((el) => el.scrollIntoView({ block: 'center' }));
        if (!(await visible(page, '[data-screen="over"]'))) fail('the game-over card is not showing', s);
        for (const side of ['left', 'right']) if (!(await visible(page, `[data-touch="${side}"]`))) fail(`the ${side} thumb button is not showing`, s);
      },
    },
    {
      // Game over under reduced motion: the blot is there at once, nothing shakes.
      name: 'over-rm',
      variant: 'desktop-light-rm',
      wait: 100,
      run: async (page) => {
        await testMode(page);
        let s = await startRun(page, 'shot-over');
        for (let i = 0; i < 40 && s.mode === 'play'; i++) s = (await act(page, { loopAround: 'nearest' })).state;
        while (s.mode === 'play') s = await page.evaluate(() => window.__qa.step(600));
        if (s.mode !== 'over') fail('the run did not end', s);
        s = await page.evaluate(() => window.__qa.redraw(600)); // let the ink blot bloom
        await page.locator('.darkfield').evaluate((el) => el.scrollIntoView({ block: 'center' }));
        if (!(await visible(page, '[data-screen="over"]'))) fail('the game-over card is not showing', s);
      },
    },
  ],
};
