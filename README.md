# live-icons

Multi-part interactive SVG icons with physics-flavoured motion, decoupled into a 3-tier architecture. No external runtime libraries, zero dependencies.

## Architecture

1. **Engine (`src/engine.js`)**: Generic core that handles input events (hover, click, hold, focus, drag/magnetic pointer, scroll, arrow keys, idle), reduced-motion detection, and base Web Animations API primitives.
2. **Motion Preset Library (`src/presets.js`)**: Collection of motion verbs (`swing`, `beat`, `bob`, `pop`, `shake`, `burst`, `rise`, `pulse`, `wave`, `puff`, `draw`).
3. **Icons as Data (`src/icons/*.js`)**: Each icon declares its SVG markup and hooks into motion verbs via `defineIcon()`.

## Quick Start

```html
<script src="dist/live-icons.js"></script>

<live-icon name="bell"></live-icon>
<live-icon name="heart"></live-icon>
<live-icon name="download"></live-icon>
<live-icon name="gear"></live-icon>
```

## Adding New Icons with AI

Give an AI assistant only [`ICON_SPEC.md`](./ICON_SPEC.md) along with your desired icon shape. You never need to supply the engine or preset code!

```bash
# Validate mechanical rules & SVG constraints
npm run lint

# Build single-file dist bundle & preview page
npm run build
```

## License

MIT
