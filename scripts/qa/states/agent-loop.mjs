// Agent-loop replay (T9): stepping, playing, and a mobile view.
export default {
  route: '/lab/agent-loop/',
  states: [
    {
      name: 'step-to-first-call',
      run: async (page) => {
        const loop = page.locator('.loop');
        await loop.scrollIntoViewIfNeeded();
        const next = page.getByRole('button', { name: 'Next step' });
        await next.click(); await next.click();
        const kind = await page.locator('.card__label').innerText();
        if (!/tool call/i.test(kind)) throw new Error(`step 3 shows "${kind}", expected a tool call`);
        // The diagram must agree with the card: a tool call lights the Tools node.
        const node = await page.locator('.node--on text').textContent();
        if (node !== 'Tools') throw new Error(`card shows a tool call but the diagram lights "${node}"`);
        await page.getByRole('button', { name: 'Next step' }).click();
        const kind2 = await page.locator('.card__label').innerText();
        const node2 = await page.locator('.node--on text').textContent();
        if (!/result/i.test(kind2) || node2 !== 'Context') throw new Error(`result step: card "${kind2}", diagram "${node2}"`);
        await page.getByRole('button', { name: 'Previous step' }).click();
      },
    },
    {
      name: 'scrub-to-result',
      run: async (page) => {
        await page.locator('.loop').scrollIntoViewIfNeeded();
        await page.locator('.loop input[type=range]').fill('17');
        const kind = await page.locator('.card__label').innerText();
        if (!/result|call|thinking|says/i.test(kind)) throw new Error(`unexpected card "${kind}"`);
        const ctx = await page.locator('.card__kind .label').nth(1).innerText();
        if (!/\d{2},\d{3} tokens/i.test(ctx)) throw new Error(`context readout "${ctx}"`);
      },
    },
    {
      name: 'play',
      wait: 200,
      run: async (page) => {
        await page.locator('.loop').scrollIntoViewIfNeeded();
        await page.getByRole('radio', { name: '4×' }).check();
        await page.getByRole('button', { name: /play/i }).click();
        await page.waitForTimeout(2500);
        const label = await page.locator('.loop .control__head .label').innerText();
        const n = Number((label.match(/Step (\d+)/i) ?? [, '0'])[1]);
        if (n < 4) throw new Error(`playing did not advance (at ${label})`);
      },
    },
    {
      name: 'mobile-step',
      variant: 'mobile-dark',
      run: async (page) => {
        await page.locator('.loop').scrollIntoViewIfNeeded();
        await page.getByRole('button', { name: 'Next step' }).tap();
        await page.getByRole('button', { name: 'Next step' }).tap();
        await page.locator('.card').scrollIntoViewIfNeeded();
      },
    },
  ],
};
