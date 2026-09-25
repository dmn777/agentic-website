// qa:game — Darkfield's harness (TESTING.md §Game). Drives the built game through its
// ?test=1 hook (window.__game) and the bot library in game-driver.mjs (window.__qa), so
// every check is deterministic and runs in simulated time.
//
//   npm run build && npm run qa:game [-- --only state-machine,random-bots] [--label T12]
//
// Checks (TESTING.md §Game 1–6):
//   state-machine  title → play → pause → play → over → restart, through the hook and the
//                  real UI (buttons, P/Esc/Enter/M keys, window blur); sound starts muted;
//                  the arrow keys still steer after every way of resuming
//   scripted-bot   a loop-steering bot scores > 0 on a fixed seed; a second run and a
//                  replay of the recorded inputs end in the identical state
//   random-bots    3 seeded random policies: no errors, the canvas keeps changing, and each
//                  run ends within 120 simulated s
//   difficulty     d(t) and every parameter move monotonically over 5 simulated minutes;
//                  the contaminant count rises with them
//   touch-390      at 390 px with touch: thumb buttons visible and ≥ 44 px, tap to start,
//                  hold a thumb to turn, drag on the field to steer, no horizontal overflow
//   frame-time     mid-game, 320 step(1) calls with the frame forced to draw, and 180
//                  animation frames of one step each: both medians < 20 ms
// Each check gets a fresh page and fails on a thrown error, a soft failure (soft(): noted,
// and the check carries on), a console error or an uncaught page error.
// Output: ../qa/<date>/<label>/game.json; the console prints one line per check.
// Playtests use the driver instead: node scripts/qa/game-driver.mjs (see its header).
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { start } from './serve.mjs';
import { today, parseArgs } from './routes.mjs';
import { openGame, game, act } from './game-driver.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = parseArgs();
const label = typeof args.label === 'string' ? args.label : 'game';
const OUT = path.resolve(here, '../../../qa', today(), label);

const TURN = 3.4, DT = 1 / 60;           // sim.ts: turn rate (rad/s), tick
const WORLD = 1040;                      // render.ts: the canvas spans 2R + 40 world units
const expect = (cond, msg) => { if (!cond) throw new Error(msg); };
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const r2 = (x) => Math.round(x * 100) / 100;

/** Step in chunks until pred(state) holds or the tick budget runs out. */
async function stepUntil(page, pred, budget, chunk = 60) {
  let s = await game(page, 'getState');
  for (let n = 0; n < budget && !pred(s); n += chunk) s = await game(page, 'step', chunk);
  return s;
}
/** The [data-screen] cards that are rendered. */
const screens = (page) => page.evaluate(() => [...document.querySelectorAll('[data-screen]')].filter((e) => e.getClientRects().length).map((e) => e.dataset.screen));
async function expectScreen(page, want, when) {
  await page.waitForFunction((w) => {
    const v = [...document.querySelectorAll('[data-screen]')].filter((e) => e.getClientRects().length).map((e) => e.dataset.screen);
    return w ? v.length === 1 && v[0] === w : v.length === 0;
  }, want, { timeout: 2000 }).catch(() => {});
  const got = await screens(page);
  expect(want ? got.length === 1 && got[0] === want : got.length === 0, `${when}: expected ${want ? `the ${want} card` : 'no card'}, saw [${got.join(', ')}]`);
}
/** SHA-1 of the canvas pixels. */
async function canvasHash(page) {
  const hex = await page.evaluate(async () => {
    const c = document.querySelector('canvas[data-qa-canvas]');
    const px = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    const d = await crypto.subtle.digest('SHA-1', px);
    return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
  });
  return hex.slice(0, 12);
}
/** Node-side seeded PRNG (mulberry32 over sha1(seed)) for the random bots. */
function rng(seed) {
  let a = createHash('sha1').update(String(seed)).digest().readUInt32LE(0);
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const newRun = async (page, seed, cheat) => {
  await game(page, 'seed', seed);
  const s = await game(page, 'input', 'start');
  return cheat ? game(page, 'cheat', cheat) : s;
};

const checks = {
  // 1. The state machine, through the hook and the real UI.
  async 'state-machine'({ page, soft }) {
    const stage = page.locator('.stage');
    const pauseBtn = page.locator('[data-action="pause"]');
    const soundBtn = page.locator('[data-action="sound"]');
    const scoreText = async () => (await page.locator('[data-score]').textContent()).trim();
    let s = await game(page, 'seed', 'machine');
    expect(s.mode === 'title', `a new seed starts on ${s.mode}, not title`);
    await expectScreen(page, 'title', 'on load');
    expect(await pauseBtn.isDisabled(), 'the pause button is enabled on the title screen');

    // Sound: muted by default; the button and the M key both toggle it.
    expect(s.muted === true && (await soundBtn.getAttribute('aria-pressed')) === 'false', `sound should start muted (state muted=${s.muted}, aria-pressed=${await soundBtn.getAttribute('aria-pressed')})`);
    await soundBtn.click();
    s = await game(page, 'getState');
    expect(!s.muted && (await soundBtn.getAttribute('aria-pressed')) === 'true', 'the sound button did not turn the sound on');
    await stage.focus();
    await page.keyboard.press('m');
    s = await game(page, 'getState');
    expect(s.muted && (await soundBtn.getAttribute('aria-pressed')) === 'false', 'M did not turn the sound off');
    await page.keyboard.press('m');
    expect(!(await game(page, 'getState')).muted, 'M did not turn the sound back on');
    s = await game(page, 'input', 'mute');
    expect(s.muted && (await soundBtn.getAttribute('aria-pressed')) === 'false', "input('mute') did not toggle the sound");

    // Start from the title card's button.
    await page.locator('[data-action="start"]').click();
    s = await game(page, 'getState');
    expect(s.mode === 'play' && s.tick === 0, `Start → ${s.mode} at tick ${s.tick}`);
    await expectScreen(page, null, 'after Start');
    s = await game(page, 'step', 30);
    expect(s.tick === 30, `30 steps → tick ${s.tick}`);

    // Four ways to pause, three to resume; the clock stands still while paused.
    const frozen = async (how) => {
      const a = await game(page, 'getState');
      expect(a.mode === 'paused', `${how}: mode ${a.mode}, not paused`);
      await expectScreen(page, 'paused', how);
      expect((await pauseBtn.textContent()).trim() === 'Resume', `${how}: the HUD button does not say Resume`);
      const b = await game(page, 'step', 90);
      expect(b.tick === a.tick && b.t === a.t && b.ink === a.ink && b.pen.x === a.pen.x && b.pen.y === a.pen.y, `${how}: the run moved while paused (tick ${a.tick} → ${b.tick})`);
      return b.tick;
    };
    const resumed = async (how, tick) => {
      const a = await game(page, 'getState');
      expect(a.mode === 'play', `${how}: mode ${a.mode}, not play`);
      await expectScreen(page, null, how);
      const b = await game(page, 'step', 10);
      expect(b.tick === tick + 10, `${how}: 10 steps → tick ${b.tick}, expected ${tick + 10}`);
      await keysSteer(how);
    };
    // After any way of resuming, the keyboard must still steer (GAME_DESIGN.md §Controls).
    const focused = () => page.evaluate(() => { const e = document.activeElement; return e === document.body ? 'body' : e.tagName.toLowerCase() + (e.dataset.action ? `[data-action=${e.dataset.action}]` : '') + (e.classList.contains('stage') ? '.stage' : ''); });
    const steered = [];
    const keysSteer = async (how) => {
      const a = await game(page, 'getState');
      await page.keyboard.down('ArrowLeft');
      const b = await game(page, 'step', 10);
      await page.keyboard.up('ArrowLeft');
      const turned = wrap(b.pen.heading - a.pen.heading), ok = b.stats.rimHits > a.stats.rimHits ? Math.abs(turned) > 1e-3 : Math.abs(turned + 10 * TURN * DT) < 1e-3; // headings are rounded to 1e-4
      steered.push(`${how}: ${ok ? 'yes' : 'NO'}`);
      soft(ok, `after ${how}, holding ← does not steer (focus is on ${await focused()})`);
    };
    await game(page, 'input', 'pause');
    let t = await frozen("input('pause')");
    await page.locator('[data-action="resume"]').click();
    await resumed('the Resume card button', t);
    await stage.focus();
    await keysSteer('focusing the field');
    await pauseBtn.click();
    t = await frozen('the HUD Pause button');
    await pauseBtn.click();
    await resumed('the HUD Resume button', t);
    await stage.focus();
    await page.keyboard.press('p');
    t = await frozen('the P key');
    await page.keyboard.press('Escape');
    await resumed('the Escape key', t);
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    t = await frozen('window blur');
    await game(page, 'input', 'pause');
    await resumed("input('pause') again", t);
    await stage.focus();
    await soundBtn.click();
    await keysSteer('clicking Sound mid-run');
    await soundBtn.click();

    // Score something (contaminants off so contact can't end it first), then run dry.
    await game(page, 'cheat', { hazards: 'off' });
    const loop = await act(page, { loopAround: 'nearest' });
    s = loop.state;
    expect(s.score > 0, `the loop bot scored nothing before game over (${JSON.stringify(loop.result)})`);
    expect(await scoreText() === String(s.score), `the HUD score shows ${await scoreText()}, the state ${s.score}`);
    s = await stepUntil(page, (x) => x.mode === 'over', 120 * 60);
    expect(s.mode === 'over' && s.overReason === 'ink', `no game over by ink within 120 s (mode ${s.mode}, ink ${s.ink})`);
    await expectScreen(page, 'over', 'game over');
    const card = await page.locator('[data-screen="over"]').innerText();
    expect(/out of ink/i.test(card) && card.includes(String(s.score)), `the over card does not show the reason and score: ${JSON.stringify(card.slice(0, 120))}`);
    expect(s.best === s.score, `best ${s.best} is not the first run's score ${s.score}`);
    expect(await pauseBtn.isDisabled(), 'the pause button is enabled on the game-over card');
    const after = await game(page, 'step', 60);
    expect(after.tick === s.tick, `the run moved after game over (tick ${s.tick} → ${after.tick})`);
    const first = { overAt: s.t, reason: s.overReason, score: s.score, caught: s.stats.captured };

    // Three restarts: the Play again button, the Enter key, and the hook.
    const reset = async (how, runs) => {
      const r = await game(page, 'getState');
      expect(r.mode === 'play' && r.tick === 0 && r.t === 0 && r.score === 0 && r.ink === 100 && r.trailLen === 0, `${how} did not reset the run: ${JSON.stringify({ mode: r.mode, tick: r.tick, score: r.score, ink: r.ink, trailLen: r.trailLen })}`);
      expect(r.stats.runs === runs && r.stats.loops === 0 && r.best === first.score, `${how}: runs ${r.stats.runs}, loops ${r.stats.loops}, best ${r.best}`);
      await expectScreen(page, null, how);
      expect(await scoreText() === '0', `${how}: the HUD score shows ${await scoreText()}`);
    };
    await page.locator('[data-action="start"]').click();
    await reset('Play again', 2);
    s = await stepUntil(page, (x) => x.mode === 'over', 120 * 60);
    expect(s.mode === 'over', 'run 2 did not end');
    await stage.focus();
    await page.keyboard.press('Enter');
    await reset('Enter', 3);
    s = await stepUntil(page, (x) => x.mode === 'over', 120 * 60);
    expect(s.mode === 'over', 'run 3 did not end');
    await game(page, 'input', 'start');
    await reset("input('start')", 4);
    return { first, idleRunOverAt: s.t, keysSteerAfter: steered };
  },

  // 2. A known policy scores deterministically: two runs and a replay agree exactly.
  async 'scripted-bot'({ page }) {
    const SEED = 'scripted-1', LOOPS = 5;
    const play = async () => {
      await newRun(page, SEED, { hazards: 'off' });
      return page.evaluate((n) => {
        const qa = window.__qa, inputs = [], loops = [];
        let s;
        for (let i = 0; i < n; i++) {
          qa.begin({ loopAround: 'nearest', radius: 80 });
          const r = qa.run({ record: true });
          inputs.push(...r.inputs);
          loops.push(r.result ? `${r.result.caught}@${r.result.ticks}` : r.reason);
          s = r.state;
          if (s.mode !== 'play') break;
        }
        return { inputs, loops, state: s };
      }, LOOPS);
    };
    const sig = (s) => JSON.stringify([s.mode, s.tick, s.score, s.ink, s.pen, s.stats, s.diatomList, s.trailPoints]);
    const a = await play();
    const b = await play();
    await newRun(page, SEED, { hazards: 'off' });
    const c = await page.evaluate((inp) => window.__qa.replay(inp), a.inputs);
    expect(a.state.score > 0, `the bot scored nothing (${a.loops.join(' ')})`);
    expect(JSON.stringify(a.inputs) === JSON.stringify(b.inputs), 'the bot chose different inputs on the second run');
    expect(sig(a.state) === sig(b.state), `two runs differ: ${sig(a.state).slice(0, 160)} vs ${sig(b.state).slice(0, 160)}`);
    expect(sig(c) === sig(a.state), `replaying the recorded inputs differs: ${sig(c).slice(0, 160)}`);

    // For the record (not asserted): the same bot with contaminants on, until the run ends.
    await newRun(page, SEED);
    const live = await page.evaluate(() => {
      const qa = window.__qa;
      let s = window.__game.getState();
      for (let i = 0; i < 60 && s.mode === 'play'; i++) { qa.begin({ loopAround: 'nearest', radius: 80 }); s = qa.run().state; }
      return { t: s.t, reason: s.overReason, score: s.score, caught: s.stats.captured, snaps: s.stats.snaps };
    });
    return {
      seed: SEED, contaminants: 'off (cheat), so contact cannot cut the script short',
      score: a.state.score, tick: a.state.tick, pen: a.state.pen, loops: a.loops.join(' '), inputs: a.inputs.length,
      withContaminants: live,
    };
  },

  // 3. Seeded random policies: no errors, a changing canvas, and a run that ends.
  async 'random-bots'({ page }) {
    const BOUND = 120 * 60, HASH_EVERY = 300;
    const runs = [];
    for (const seed of ['random-1', 'random-2', 'random-3']) {
      const rnd = rng(seed);
      await page.evaluate(() => window.__qa.release());
      let s = await newRun(page, seed);
      const hashes = [{ tick: 0, h: await canvasHash(page) }];
      let next = HASH_EVERY, segments = 0;
      while (s.mode === 'play' && s.tick < BOUND) {
        const u = rnd(), n = 15 + Math.floor(rnd() * 46);
        let inp = {};
        if (u < 0.25) inp = { left: true };
        else if (u < 0.5) inp = { right: true };
        else if (u >= 0.75) { const a = rnd() * 2 * Math.PI, r = 460 * Math.sqrt(rnd()); inp = { aim: { x: r * Math.cos(a), y: r * Math.sin(a) } }; }
        s = await page.evaluate(([inp, n]) => { window.__qa.apply(inp); return window.__game.step(n); }, [inp, n]);
        segments++;
        if (s.tick >= next || s.mode !== 'play') { hashes.push({ tick: s.tick, h: await canvasHash(page) }); next += HASH_EVERY; }
      }
      await page.evaluate(() => window.__qa.release());
      const distinct = new Set(hashes.map((x) => x.h)).size;
      const same = hashes.findIndex((x, i) => i > 0 && x.h === hashes[i - 1].h);
      runs.push({ seed, over: s.mode === 'over', t: s.t, reason: s.overReason, score: s.score, caught: s.stats.captured, loops: s.stats.loops, snaps: s.stats.snaps, rimHits: s.stats.rimHits, segments, hashes: hashes.length, distinct, same });
    }
    for (const r of runs) {
      expect(r.over, `${r.seed}: still in play after ${BOUND / 60} simulated s`);
      expect(r.same < 0 && r.distinct === r.hashes, `${r.seed}: the canvas did not change between two samples (${r.distinct} distinct of ${r.hashes})`);
    }
    return runs.map((r) => ({ seed: r.seed, overAt: r.t, reason: r.reason, score: r.score, caught: r.caught, snaps: r.snaps, rimHits: r.rimHits, canvasHashes: `${r.distinct}/${r.hashes} distinct` }));
  },

  // 4. The difficulty curve, measured in the state.
  async difficulty({ page }) {
    const SAMPLE = 600, END = 300 * 60;
    // (a) Bottomless ink and no contaminants; the pen circles on the left key.
    let s = await newRun(page, 'difficulty', { ink: 1e9, hazards: 'off' });
    await page.evaluate(() => window.__qa.apply({ left: true }));
    const samples = [{ t: s.t, d: s.d, ...s.params }];
    while (s.tick < END) {
      s = await game(page, 'step', SAMPLE);
      expect(s.mode === 'play', `the run ended at ${s.t} s (${s.overReason}) despite the cheats`);
      samples.push({ t: s.t, d: s.d, ...s.params });
    }
    const up = ['penSpeed', 'drain', 'respawnDelay', 'hazardSpeed', 'homing', 'hazardTarget'];
    for (let i = 1; i < samples.length; i++) {
      const a = samples[i - 1], b = samples[i];
      expect(b.d > a.d, `d did not rise between ${a.t} s and ${b.t} s (${a.d} → ${b.d})`);
      for (const k of up) expect(b[k] >= a[k], `${k} fell between ${a.t} s and ${b.t} s (${a[k]} → ${b[k]})`);
      expect(b.diatomTarget <= a.diatomTarget, `diatomTarget rose between ${a.t} s and ${b.t} s`);
    }
    const first = samples[0], last = samples.at(-1);
    for (const k of [...up, 'diatomTarget']) expect(first[k] !== last[k], `${k} did not change over 5 minutes (${first[k]})`);
    await page.evaluate(() => window.__qa.release());

    // (b) The contaminant count follows hazardTarget in a live run: contaminants frozen
    // where they spawn (at the rim) so the circling pen never meets them.
    s = await newRun(page, 'difficulty-hazards', { ink: 1e9, hazards: 'frozen' });
    await page.evaluate(() => window.__qa.apply({ left: true }));
    const counts = [];
    while (s.tick < END) {
      s = await game(page, 'step', SAMPLE);
      expect(s.mode === 'play', `the frozen-contaminant run ended at ${s.t} s (${s.overReason})`);
      counts.push({ t: s.t, hazards: s.hazards, target: s.params.hazardTarget });
    }
    await page.evaluate(() => window.__qa.release());
    for (let i = 1; i < counts.length; i++) expect(counts[i].hazards >= counts[i - 1].hazards, `the contaminant count fell at ${counts[i].t} s`);
    // Before the grace period ends there are none; after it, exactly the target.
    const off = counts.filter((c) => c.hazards !== (c.t < s.hazardGrace ? 0 : c.target));
    expect(!off.length, `contaminants ≠ hazardTarget at ${off.map((c) => `${c.t} s (${c.hazards}/${c.target})`).join(', ')}`);
    expect(counts.at(-1).hazards > counts[0].hazards, `the contaminant count did not rise (${counts[0].hazards} → ${counts.at(-1).hazards})`);
    const pick = (x) => ({ d: x.d, penSpeed: r2(x.penSpeed), drain: r2(x.drain), diatomTarget: x.diatomTarget, respawnDelay: r2(x.respawnDelay), hazardTarget: x.hazardTarget, hazardSpeed: r2(x.hazardSpeed), homing: r2(x.homing) });
    const rises = [];
    for (let i = 1; i < counts.length; i++) if (counts[i].hazards > counts[i - 1].hazards) rises.push(`${counts[i].hazards}@${Math.round(counts[i].t)}s`);
    return { samples: samples.length, start: pick(first), end: { t: last.t, ...pick(last) }, contaminants: `${counts[0].hazards}@${Math.round(counts[0].t)}s ${rises.join(' ')} (frozen, cheat)` };
  },

  // 5. Touch at 390 px: thumb buttons, tap to start, hold to turn, drag to steer.
  async 'touch-390'({ page }) {
    const W = 390, H = 844;
    const cdp = await page.context().newCDPSession(page);
    // Real touches through CDP (so pointer capture works as on a phone). Chromium delivers
    // pointermove aligned to animation frames, and in test mode nothing else asks for frames:
    // wait two frames after each touch so the page has seen it before the next step().
    const touch = async (type, pts = []) => {
      await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y]) => ({ x, y })) });
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    };
    const toClient = (x, y) => page.evaluate(([x, y, world]) => {
      const r = document.querySelector('canvas[data-qa-canvas]').getBoundingClientRect(), k = r.width / world;
      return [r.left + r.width / 2 + x * k, r.top + r.height / 2 + y * k];
    }, [x, y, WORLD]);

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(overflow <= W, `horizontal overflow: scrollWidth ${overflow} > ${W}`);
    await page.locator('.darkfield').evaluate((el) => el.scrollIntoView({ block: 'center' }));
    const boxes = {};
    for (const side of ['left', 'right']) {
      const btn = page.locator(`[data-touch="${side}"]`);
      expect(await btn.isVisible(), `the ${side} thumb button is not visible`);
      const b = await btn.boundingBox();
      boxes[side] = b;
      expect(b.width >= 44 && b.height >= 44, `the ${side} thumb button is ${b.width}×${b.height} px, under 44×44`);
      expect(b.x >= 0 && b.y >= 0 && b.x + b.width <= W && b.y + b.height <= H, `the ${side} thumb button is outside the viewport: ${JSON.stringify(b)}`);
    }
    const stageBox = await page.locator('.stage').boundingBox();
    expect(stageBox.y >= 0 && stageBox.y + stageBox.height <= H, `the field and the thumb buttons don't fit on screen together: stage ${JSON.stringify(stageBox)}`);

    // Tap Start.
    let s = await game(page, 'seed', 'touch-tap');
    await page.locator('[data-action="start"]').tap();
    s = await game(page, 'getState');
    expect(s.mode === 'play', `tapping Start → ${s.mode}`);

    // Hold a thumb button for N ticks: the heading turns by N·TURN·DT against a no-input run.
    const N = 30, want = N * TURN * DT;
    const base = await (async () => { await newRun(page, 'touch-thumb'); return game(page, 'step', N); })();
    const thumbs = {};
    for (const [side, sign] of [['left', -1], ['right', 1]]) {
      await newRun(page, 'touch-thumb');
      const b = boxes[side];
      const at = [b.x + b.width / 2, b.y + b.height / 2];
      await touch('touchStart', [at]);
      s = await game(page, 'step', N);
      await touch('touchEnd');
      const turned = wrap(s.pen.heading - base.pen.heading);
      expect(s.stats.rimHits === 0 && base.stats.rimHits === 0, 'the pen hit the rim during the thumb test');
      expect(Math.abs(turned - sign * want) < 0.05, `holding ${side} for ${N} ticks turned the pen by ${turned.toFixed(3)} rad, expected ${(sign * want).toFixed(3)}`);
      const h = s.pen.heading;
      s = await game(page, 'step', 20);
      expect(Math.abs(wrap(s.pen.heading - h)) < 1e-9, `the pen kept turning after the ${side} thumb was released`);
      thumbs[side] = r2(turned);
    }

    // Drag a finger across the field: the pen turns towards it. Start ahead of the pen
    // (0, −200: no turn needed), drag to (320, 150), right of it, and hold.
    const errTo = (st, p) => Math.abs(wrap(Math.atan2(p[1] - st.pen.y, p[0] - st.pen.x) - st.pen.heading));
    const finger = [320, 150], HOLD = 40;
    await newRun(page, 'touch-drag');
    const baseDrag = await game(page, 'step', 6 * 2 + HOLD);
    await newRun(page, 'touch-drag');
    const drag = [[0, -200], [80, -150], [160, -80], [240, 0], [300, 80], finger];
    await touch('touchStart', [await toClient(...drag[0])]);
    for (const p of drag.slice(1)) { await touch('touchMove', [await toClient(...p)]); await game(page, 'step', 2); }
    await game(page, 'step', 2);
    s = await game(page, 'step', HOLD);
    await touch('touchEnd');
    const err = errTo(s, finger), errBase = errTo(baseDrag, finger);
    expect(err < 0.2, `after the drag the pen heads ${err.toFixed(2)} rad off the finger`);
    expect(errBase > 1, `control: without input the pen happens to head at the finger too (${errBase.toFixed(2)} rad)`);
    const h = s.pen.heading;
    s = await game(page, 'step', 20);
    expect(Math.abs(wrap(s.pen.heading - h)) < 1e-9, 'the pen kept steering after the finger lifted');
    return { scrollWidth: overflow, thumb: `${Math.round(boxes.left.width)}×${Math.round(boxes.left.height)} px`, thumbTurn: thumbs, dragError: r2(err), noInputError: r2(errBase) };
  },

  // 6. Frame time mid-game: one tick plus one render per step(1).
  async 'frame-time'({ page }) {
    // A busy field: bottomless ink, contaminants frozen at the rim, and a wide circle round
    // the centre that is longer than the wet line, so the full 1,500 u trail is always drawn.
    // Three measurements of the same thing, because Chromium defers canvas drawing:
    //   plain      back-to-back step(1): the canvas only records, and rasterises every few
    //              calls, so the median flatters; the mean is the amortised cost
    //   readback   step(1) then a 1-pixel getImageData, which forces the frame to be drawn:
    //              the per-frame cost of the simulation plus the render (asserted < 20 ms)
    //   rAF        one step(1) per animation frame, as in play, with the HUD's DOM updates:
    //              the frame-to-frame interval (asserted < 20 ms; 16.7 ms is 60 fps)
    await newRun(page, 'frames', { ink: 1e9, hazards: 'frozen' });
    const N = 320, FRAMES = 180;
    const m = await page.evaluate(async ([warmTicks, n, frames]) => {
      const qa = window.__qa, g = window.__game, C = { x: 0, y: 0 };
      const ctx = document.querySelector('canvas[data-qa-canvas]').getContext('2d');
      let s = g.getState();
      const steer = () => qa.apply({ aim: qa.circleAim(s.pen, C, 250, 1) });
      for (let i = 0; i < warmTicks; i += 10) { steer(); s = g.step(10); }
      const plain = [], readback = [], interval = [], work = [];
      // rAF first, after 30 unmeasured frames that let the compositor catch up on the
      // warm-up (the synchronous blocks below would otherwise leave it a backlog).
      const SETTLE = 30;
      await new Promise((done) => {
        let last = 0, k = 0;
        const frame = (ts) => {
          if (k > SETTLE) interval.push(ts - last);
          last = ts;
          steer();
          const t0 = qa.realNow(); s = g.step(1);
          if (k >= SETTLE) work.push(qa.realNow() - t0);
          if (++k <= SETTLE + frames) requestAnimationFrame(frame); else done();
        };
        requestAnimationFrame(frame);
      });
      for (let i = 0; i < n; i++) { steer(); const t0 = qa.realNow(); s = g.step(1); ctx.getImageData(0, 0, 1, 1); readback.push(qa.realNow() - t0); }
      for (let i = 0; i < n; i++) { steer(); const t0 = qa.realNow(); s = g.step(1); plain.push(qa.realNow() - t0); }
      ctx.getImageData(0, 0, 1, 1);
      qa.release();
      return { plain, readback, interval, work, s };
    }, [90 * 60, N, FRAMES]); // 90 s in: four contaminants, a full wet line
    const q = (xs, p) => { const v = [...xs].sort((a, b) => a - b); return v[Math.min(v.length - 1, Math.floor(p * v.length))]; };
    const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
    const s = m.s;
    expect(s.mode === 'play', `the run ended during timing (${s.overReason})`);
    const rb = { median: q(m.readback, 0.5), p95: q(m.readback, 0.95) };
    const iv = { median: q(m.interval, 0.5), p95: q(m.interval, 0.95), max: Math.max(...m.interval), over20: m.interval.filter((x) => x > 20).length };
    expect(rb.median < 20, `median step(1) with the frame drawn is ${rb.median.toFixed(2)} ms, not under 20 ms`);
    expect(iv.median < 20, `median frame interval with one step(1) per frame is ${iv.median.toFixed(2)} ms, not under 20 ms`);
    return {
      readback: { steps: N, medianMs: r2(rb.median), p95Ms: r2(rb.p95) },
      plain: { steps: N, medianMs: r2(q(m.plain, 0.5)), meanMs: r2(mean(m.plain)), p95Ms: r2(q(m.plain, 0.95)) },
      raf: { frames: FRAMES, intervalMedianMs: r2(iv.median), intervalP95Ms: r2(iv.p95), maxMs: r2(iv.max), over20ms: iv.over20, stepMedianMs: r2(q(m.work, 0.5)) },
      field: { t: s.t, diatoms: s.diatoms, hazards: s.hazards, trailLen: s.trailLen, canvas: `${s.canvas.width}×${s.canvas.height}` },
    };
  },
};
const VARIANT = { 'touch-390': 'mobile-dark' };

const only = typeof args.only === 'string' ? args.only.split(',') : Object.keys(checks);
const server = await start();
const browser = await chromium.launch();
const results = [];
const t0 = Date.now();
try {
  for (const name of only) {
    const fn = checks[name];
    if (!fn) { results.push({ name, ok: false, error: 'no such check' }); console.log(`FAIL ${name} — no such check`); continue; }
    const started = Date.now();
    const env = await openGame(browser, server, VARIANT[name] ?? 'desktop-light');
    // soft(cond, msg): a failure that doesn't stop the check, so one bug doesn't hide the rest.
    const failures = [];
    const soft = (cond, msg) => { if (!cond) failures.push(msg); };
    let r;
    try {
      const detail = await fn({ ...env, browser, server, soft });
      r = { name, ok: env.problems.length === 0 && failures.length === 0, detail, failures, problems: env.problems };
    } catch (e) {
      r = { name, ok: false, error: e.message.split('\n')[0], failures, problems: env.problems };
    }
    await env.ctx.close();
    r.seconds = Math.round((Date.now() - started) / 100) / 10;
    results.push(r);
    console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${name} (${r.seconds} s)${r.detail ? ' ' + JSON.stringify(r.detail) : ''}${r.error ? ' — ' + r.error : ''}`);
    for (const f of r.failures ?? []) console.log(`       failed: ${f}`);
    for (const p of r.problems ?? []) console.log(`       ${p.kind}: ${p.text}`);
  }
} finally {
  await browser.close();
  await server.close();
}
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'game.json'), JSON.stringify({ label, when: new Date().toISOString(), seconds: Math.round((Date.now() - t0) / 1000), results }, null, 2));
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} ok in ${Math.round((Date.now() - t0) / 1000)} s → ${path.relative(process.cwd(), path.join(OUT, 'game.json'))}`);
process.exitCode = failed ? 1 : 0;
