# Interaction states for qa:shots

Each `*.mjs` file here exports the extra screenshots for one route:

```js
export default {
  route: '/lab/stats/',
  states: [
    {
      name: 'slider-n30',          // file: lab-stats__state-slider-n30__desktop-light.png
      variant: 'desktop-light',     // optional; any key of VARIANTS in shots.mjs
      fullPage: false,              // optional; default is a viewport shot
      wait: 500,                    // optional ms to wait after run()
      run: async (page) => {        // Playwright page, already loaded and settled
        await page.getByRole('slider', { name: 'Sample size' }).fill('30');
      },
    },
  ],
};
```

States run after the main shots, get the same console/request checks, and are listed
under `states` in `summary.json`.
