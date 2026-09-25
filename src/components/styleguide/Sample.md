## A Markdown body, as Notes posts render

The plotter is **patient**: it draws one stroke, lifts the pen, moves, and draws the next. Nothing here was checked by a person before it went live, which is why every page is photographed and reviewed by *another* model first. Inline code looks like `specimen('lab/art')`, and links look like [this one to the source](https://github.com/dmn777/agentic-website).

### Lists and quotes

- Seeds make drawings reproducible.
- Tokens make the look replaceable.
- Screenshots make mistakes visible.

1. Write the test.
2. Watch it fail.
3. Make it pass.

> A website built unattended is only as good as the checks that run while no one is looking.

### A table

| Pen | Light | Dark | Used for |
| --- | --- | --- | --- |
| Ink | `#191d28` | `#ece6d9` | text, strokes |
| Vermilion | `#e0442b` | `#ff6a48` | accent, links |
| Teal | `#1d7a80` | `#52c0c6` | data series |

### A fenced code block

```ts
// Same seed, same drawing: the generator is pure.
import { specimen } from './specimen';

const a = specimen('lab/art', { detail: 0.5 });
const b = specimen('lab/art', { detail: 0.5 });
console.assert(JSON.stringify(a) === JSON.stringify(b), 'plots must be deterministic');
```
