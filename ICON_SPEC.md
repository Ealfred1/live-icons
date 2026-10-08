# Living Icons Specification (ICON_SPEC.md)

One-page specification for AI assistants creating or updating live icons.

> **RULE #1**: Never modify `src/engine.js` or `src/presets.js`.
> **RULE #2**: Output only the icon definition file (`src/icons/<name>.js`).
> **RULE #3**: Separate geometry from motion. Perfect the SVG structure before fine-tuning timing and power values.

---

## 1. Grid & Geometry Standards

- **Coordinate Grid**: `24 × 24` viewBox (`viewBox="0 0 24 24"`).
- **Live Area**: Active visual bounds within `20 × 20` (padding of 2 units from keyline edges).
- **Default Stroke**: `stroke-width: 1.5`, `stroke-linecap="round"`, `stroke-linejoin="round"`.
- **Inheritance**: Base SVG uses `fill="none" stroke="currentColor"`. Styling is handled via CSS / CSS variables.
- **No Inline Presentation**: Do NOT put `stroke-width`, `stroke-linecap`, or `stroke-linejoin` directly on path elements. Let parent SVG / CSS classes handle stroke rules.
- **Drawable Paths**: Any path intended for stroke dash animations (e.g. progress, draw, cracks) MUST declare `pathLength="1"`.

---

## 2. Naming Conventions

Prefix class names with `<initial>-<part>` to isolate component styles and avoid conflicts:
- Bell: `b-swing`, `b-clapper`, `b-badge`, `b-wave`
- Heart: `h-body`, `h-fill`, `h-ecg`, `h-spark`, `h-mini`
- Download: `d-tray`, `d-arrow`, `d-bar`, `d-puff`
- Gear: `g-rotor`, `g-ring`, `g-core`, `g-ticks`

---

## 3. Motion Preset Catalog (`src/presets.js`)

Call motion presets instead of hand-writing Web Animations API frames:

| Verb | Signature | Purpose | Example |
|---|---|---|---|
| `swing` | `swing(el, { power, duration, loop })` | Pendulum oscillation on pivot | Bell ringing |
| `beat` | `beat(el, { scale, duration, loop })` | 2-stage organic heartbeat | Like heart |
| `bob` | `bob(el, { distance, duration, loop })` | Vertical float bounce | Download arrow |
| `draw` | `draw(el, { duration, delay, easing })` | Stroke reveal (`pathLength="1"`) | ECG line, checklist |
| `pop` | `pop(el, { peak, duration })` | Quick scale punch | Notification badge |
| `shake` | `shake(el, { power, duration })` | Lateral / rotational jitter | Error / break state |
| `burst` | `burst(els, { delay, duration, travel })` | Radial sparks dispersion | Heart explosion |
| `rise` | `rise(els, { duration })` | Floating upward particles (`data-dx`) | Mini floating hearts |
| `pulse` | `pulse(el, { scale, duration })` | Expanding / fading shockwave | Ping radar / ripple |
| `wave` | `wave(els, { duration, power, loop })` | Directional wave arcs (`data-dir`) | Audio waves |
| `puff` | `puff(els, { duration })` | Dust puff particles (`data-dx`) | Impact dust |

---

## 4. Standard Event Handlers

Each icon exports a `make(btn)` factory returning event callbacks:
- `enter()`: Pointer hover enter
- `leave()`: Pointer hover exit
- `down()` / `up()`: Pointer press down / release
- `click()`: Primary activate / click
- `dbl()`: Secondary / toggle action (e.g. mute, turbo, break)
- `ctx()`: Context menu (right-click)
- `hold()` / `holdEnd()`: Press & hold (after 550ms) / hold release
- `wheel(dy)`: Mouse wheel scroll over icon
- `focus()`: Keyboard focus received (`:focus-visible`)
- `key(k)`: Arrow keys (`ArrowUp`, `ArrowDown`, `ArrowLeft`, `ArrowRight`)
- `reset()`: Escape key
- `idle()`: Ambient motion trigger when idle for ~6s

---

## 5. Icon Template

```javascript
import { defineIcon } from '../element.js';
import { swing, pop, pulse } from '../presets.js';

defineIcon('myicon', {
  tag: 'category',
  label: 'Accessible description of icon and controls.',
  desc: 'Short explanation of what each interaction does.',
  keys: '← → action · ↑ alt · Esc reset',

  svg: `
    <g class="m-part">
      <path d="..." />
    </g>
  `,

  make(btn) {
    const part = btn.querySelector('.m-part');

    return {
      enter() { swing(part, { power: 0.8 }); },
      click() { pop(part); },
      // ...other event hooks
    };
  },
});
```
