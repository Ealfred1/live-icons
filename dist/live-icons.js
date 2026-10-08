/**
 * Live Icons v0.1.0
 * Multi-part SVG living icons. Physics-flavoured motion. Zero dependencies.
 */
(() => {
  'use strict';

  // --- ENGINE ---
  /**
 * engine.js — live-icons event engine
 *
 * Written once. Never send this file to the AI when asking for new icons.
 * It handles every event (hover, press, click, dblclick, contextmenu, hold,
 * wheel, pointermove, focus, keyboard, idle), state classes, reduced-motion
 * and the three low-level animation helpers used by presets.
 *
 * Public API
 * ----------
 * mount(card, api)     – wire one card element to an icon api object
 * play(el, frames, opts) – run a WAAPI animation, cancelling the previous one
 * stopAnim(el)         – cancel a running animation
 * finishLoop(anim)     – advance an infinite loop to the end of its current
 *                         iteration so it stops cleanly
 * osc(fn, unit, amp, keys) – build oscillating keyframe arrays
 * reduce               – MediaQueryList for prefers-reduced-motion
 */

'use strict';

const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

const wait = ms => new Promise(r => setTimeout(r, ms));

/* ─── Low-level WAAPI helpers ────────────────────────────────────────────── */

/**
 * Play a WAAPI animation on `el`, cancelling any previous one.
 * Pass { smooth: true } to prepend the element's current computed transform
 * so the new animation starts exactly where it is rather than jumping.
 */
const play = (el, frames, opts = {}) => {
  if (!el || reduce.matches || !el.animate) return null;
  let f = frames;
  const prev = el.__a;
  if (prev) {
    if (opts.smooth) {
      const cur = getComputedStyle(el).transform;
      if (cur && cur !== 'none') f = [{ transform: cur }, ...frames];
    }
    prev.cancel();
  }
  const { smooth, ...o } = opts;
  const a = el.animate(f, { duration: 600, easing: 'ease-out', ...o });
  el.__a = a;
  a.onfinish = a.oncancel = () => { if (el.__a === a) el.__a = null; };
  return a;
};

/** Cancel a running animation immediately. */
const stopAnim = el => {
  if (el && el.__a) { el.__a.cancel(); el.__a = null; }
};

/**
 * Advance an infinite-loop animation to the end of its current iteration
 * so it doesn't snap back to frame 0 when it stops.
 */
const finishLoop = a => {
  if (!a) return;
  try {
    const t = a.effect.getComputedTiming();
    a.effect.updateTiming({ iterations: Math.floor(t.currentIteration || 0) + 1 });
  } catch (e) { /* ignore */ }
};

/**
 * Build an array of oscillating keyframes.
 * @param {string} fn   – CSS transform function, e.g. 'rotate'
 * @param {string} unit – CSS unit, e.g. 'deg' or 'px'
 * @param {number} amp  – peak amplitude
 * @param {number[]} keys – normalised multipliers, e.g. [1, -0.82, 0.62, …]
 * The array is padded with 0 at start and end so it starts and ends at rest.
 */
const osc = (fn, unit, amp, keys) =>
  [0, ...keys, 0].map(k => ({ transform: `${fn}(${(amp * k).toFixed(2)}${unit})` }));

/* ─── Event engine ───────────────────────────────────────────────────────── */

/**
 * Wire one card element to an icon api object.
 *
 * `api` is an object produced by an icon module. Any method may be omitted
 * and the engine will silently skip it. Standard methods:
 *   enter()            pointer enters button
 *   leave()            pointer leaves button
 *   down()             pointer/key pressed
 *   up()               pointer/key released
 *   click()            single click / Enter / Space
 *   dbl()              double-click
 *   ctx()              right-click (contextmenu)
 *   hold()             held for 550 ms
 *   holdEnd()          hold released
 *   wheel(deltaY)      scroll wheel delta
 *   move()             pointer moved inside button (throttled)
 *   focus()            keyboard focus (focus-visible)
 *   key(key)           Arrow key pressed
 *   reset()            Escape pressed
 *   idle()             no interaction for ~6 s while in view
 */
const mount = (card, api) => {
  const btn   = card.querySelector('.icon-btn');
  const stage = card.querySelector('.stage');
  const mag   = card.querySelector('.mag');
  const out   = card.querySelector('.readout code');
  const box   = card.querySelector('.events');
  const name  = card.dataset.icon;

  /* ── Chip / event-log infrastructure ─── */
  const EVENTS = [
    ['hover',       'Hover'],
    ['press',       'Press'],
    ['click',       'Click'],
    ['dblclick',    'Double click'],
    ['contextmenu', 'Right click'],
    ['hold',        'Hold'],
    ['wheel',       'Scroll'],
    ['move',        'Move'],
    ['focus',       'Focus'],
    ['key',         'Keys'],
    ['idle',        'Idle'],
  ];

  const chips = {}, lit = {};

  EVENTS.forEach(([ev, label]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.textContent = label;
    b.setAttribute('aria-label', `Fire ${label.toLowerCase()} on the ${name}`);
    b.addEventListener('click', () => sim[ev]());
    box.appendChild(b);
    chips[ev] = b;
  });

  let lastAct = performance.now();

  const log = (ev, label) => {
    lastAct = performance.now();
    out.textContent = label;
    const c = chips[ev];
    if (!c) return;
    c.classList.add('is-lit');
    clearTimeout(lit[ev]);
    lit[ev] = setTimeout(() => c.classList.remove('is-lit'), 700);
  };

  const cls = (c, on) => btn.classList.toggle(c, on);

  /* Magnetic-pull helper — small x/y nudge toward the pointer. */
  const setMag = (x, y) => {
    if (reduce.matches) return;
    mag.style.setProperty('--mx', (x * 5).toFixed(1) + 'px');
    mag.style.setProperty('--my', (y * 5).toFixed(1) + 'px');
  };

  /* ── Hold-timer bookkeeping ─── */
  let holdTimer = 0, holding = false, swallow = false;

  const endHold = () => {
    if (!holding) return;
    holding = false;
    cls('is-held', false);
    if (api.holdEnd) api.holdEnd();
  };
  const cancelHold = () => { clearTimeout(holdTimer); endHold(); };
  const noSwallow  = () => setTimeout(() => { swallow = false; }, 0);

  /* ── Internal event dispatcher ─── */
  const H = {
    enter(src) { cls('is-hover', true);  log('hover', src); if (api.enter) api.enter(); },
    leave(src) { cls('is-hover', false); cls('is-pressed', false); cancelHold(); log('hover', src); if (api.leave) api.leave(); },
    down(src)  { cls('is-pressed', true);  log('press', src); if (api.down) api.down(); },
    up(src)    { cls('is-pressed', false); log('press', src); if (api.up)   api.up();   },
    click(src) { log('click', src); if (api.click) api.click(); },
    dbl(src)   { log('dblclick', src); if (api.dbl) api.dbl(); },
    ctx(src)   { log('contextmenu', src); if (api.ctx) api.ctx(); },
    hold(src)  { holding = true; swallow = true; cls('is-held', true); log('hold', src); if (api.hold) api.hold(); },
    wheel(dy, src) { log('wheel', src); if (api.wheel) api.wheel(dy); },
    move(src)  { log('move', src); if (api.move) api.move(); },
    focus(src) { log('focus', src); if (api.focus) api.focus(); },
    key(k, src){ log('key', src);   if (api.key) api.key(k); },
    idle(src)  { log('idle', src);  if (api.idle) api.idle(); },
    reset(src) { log('key', src);   if (api.reset) api.reset(); },
  };

  /* ── Chip simulations ─── */
  const sim = {
    hover:       async () => { H.enter('simulated pointerenter'); await wait(1500); H.leave('simulated pointerleave'); },
    press:       async () => { H.down('simulated pointerdown'); await wait(260); H.up('simulated pointerup'); },
    click:       ()       => H.click('simulated click'),
    dblclick:    ()       => H.dbl('simulated dblclick'),
    contextmenu: ()       => H.ctx('simulated contextmenu'),
    hold: async () => {
      H.down('simulated pointerdown');
      H.hold('simulated hold');
      await wait(1100);
      endHold();
      H.up('simulated pointerup');
      swallow = false;
    },
    wheel: ()       => H.wheel(240, 'simulated wheel Δ240'),
    move:  async () => {
      for (const x of [-0.9, 0.9, -0.9, 0]) {
        setMag(x, x * 0.4);
        H.move('simulated pointermove');
        await wait(260);
      }
    },
    focus: async () => { cls('is-focus', true); H.focus('simulated focus'); await wait(1500); cls('is-focus', false); },
    key:   ()       => H.key('ArrowRight', 'simulated keydown ArrowRight'),
    idle:  ()       => H.idle('simulated idle'),
  };

  /* ── Native listeners ─── */
  btn.addEventListener('pointerenter', () => H.enter('pointerenter'));
  btn.addEventListener('pointerleave', () => { H.leave('pointerleave'); noSwallow(); });

  btn.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    H.down('pointerdown');
    clearTimeout(holdTimer);
    holdTimer = setTimeout(() => H.hold('hold · 550 ms'), 550);
  });
  btn.addEventListener('pointerup',     () => { H.up('pointerup'); cancelHold(); noSwallow(); });
  btn.addEventListener('pointercancel', () => { cls('is-pressed', false); cancelHold(); noSwallow(); });

  btn.addEventListener('click', e => {
    if (swallow) { swallow = false; return; }
    H.click(e.detail === 0 ? 'click · keyboard' : 'click');
  });
  btn.addEventListener('dblclick', () => H.dbl('dblclick'));

  let lastType = 'mouse';
  btn.addEventListener('pointerdown', e => { lastType = e.pointerType; }, true);
  btn.addEventListener('contextmenu', e => {
    e.preventDefault();
    if (lastType === 'touch') return;
    H.ctx('contextmenu');
  });

  let lastWheel = 0;
  btn.addEventListener('wheel', e => {
    const now = performance.now();
    if (now - lastWheel < 140) return;
    lastWheel = now;
    H.wheel(e.deltaY, 'wheel Δ' + Math.round(e.deltaY));
  }, { passive: true });

  btn.addEventListener('focus', () => {
    let vis = false;
    try { vis = btn.matches(':focus-visible'); } catch (_) {}
    cls('is-focus', vis);
    if (vis) H.focus('focus · keyboard'); else log('focus', 'focus');
  });
  btn.addEventListener('blur', () => { cls('is-focus', false); cls('is-pressed', false); log('focus', 'blur'); });

  btn.addEventListener('keydown', e => {
    if (e.repeat) return;
    if (e.key === 'Enter' || e.key === ' ')
      H.down('keydown ' + (e.key === ' ' ? 'Space' : 'Enter'));
    else if (e.key.startsWith('Arrow'))
      { e.preventDefault(); H.key(e.key, 'keydown ' + e.key); }
    else if (e.key === 'Escape')
      H.reset('keydown Escape');
  });
  btn.addEventListener('keyup', e => {
    if (e.key === 'Enter' || e.key === ' ')
      H.up('keyup ' + (e.key === ' ' ? 'Space' : 'Enter'));
  });

  /* Magnetic pull + throttled move readout. */
  let lastMove = 0;
  stage.addEventListener('pointermove', e => {
    if (e.pointerType === 'touch') return;
    const r  = btn.getBoundingClientRect();
    const nx = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width  / 2)) / r.width));
    const ny = Math.max(-1, Math.min(1, (e.clientY - (r.top  + r.height / 2)) / r.height));
    setMag(nx, ny);
    const now = performance.now();
    if (btn.contains(e.target) && now - lastMove > 180) {
      lastMove = now;
      H.move('pointermove · ' + Math.round(e.clientX - r.left) + ', ' + Math.round(e.clientY - r.top));
    }
  });
  stage.addEventListener('pointerleave', () => setMag(0, 0));

  /* Idle nudge after a stretch with no input while the card is in view. */
  const inView = () => { const r = card.getBoundingClientRect(); return r.bottom > 0 && r.top < window.innerHeight; };
  const idleLoop = () => {
    setTimeout(() => {
      if (!reduce.matches && !document.hidden && inView() && performance.now() - lastAct > 6000)
        H.idle('idle · no input');
      idleLoop();
    }, 5500 + Math.random() * 4500);
  };
  idleLoop();
};


  // --- PRESETS ---
  /**
 * presets.js — live-icons motion vocabulary
 *
 * Each export is a small function that animates one or more SVG elements.
 * All presets take an element (or elements) as the first argument, then an
 * options object. They call `play`, `stopAnim` and `finishLoop` from the
 * engine rather than wrapping WAAPI themselves, so reduced-motion is
 * handled automatically.
 *
 * Preset catalogue
 * ────────────────
 * swing(el, opts)   – pendulum oscillation on a pivot point  (bell)
 * beat(el, opts)    – two-pulse heartbeat scale               (heart)
 * bob(el, opts)     – vertical float bounce                   (download arrow)
 * spin(el, vel, ...)– continuous inertia rotation via rAF     (gear)
 * draw(el, opts)    – animate stroke-dashoffset 1→0           (progress bars)
 * pop(el, opts)     – quick scale-up / scale-down burst       (badges)
 * shake(el, opts)   – rapid lateral jitter                    (bell mute ctx)
 * burst(els, opts)  – radial sparks flying outward            (heart like)
 * rise(els, opts)   – elements float up and fade              (heart minis)
 * pulse(el, opts)   – expand-and-fade ring                    (heart ring / bell ping)
 * wave(els, opts)   – stroke-dash wave propagating outward    (bell waves)
 * puff(els, opts)   – dust particles dispersing sideways      (download done)
 */




/* ─── swing ──────────────────────────────────────────────────────────────── */
/**
 * Pendulum oscillation. The element must have its transform-origin set in CSS
 * (e.g. top-centre for a bell).
 *
 * @param {Element}  el
 * @param {object}   [opts]
 * @param {number}   [opts.power=1]       – amplitude multiplier
 * @param {number}   [opts.duration=1100] – full cycle in ms
 * @param {boolean}  [opts.loop=false]    – loop until finishLoop is called
 * @param {number}   [opts.speed=1]       – playback rate (for hold→leave)
 * @returns {Animation|null}
 */
const swing = (el, opts = {}) => {
  const { power = 1, duration = 1100, loop = false } = opts;
  const amp = 12 * power;
  const keys = loop ? [1, -1] : [1, -0.82, 0.62, -0.42, 0.24, -0.1];
  return play(el,
    osc('rotate', 'deg', amp, keys),
    { duration, easing: 'ease-in-out', smooth: true, ...(loop ? { iterations: Infinity } : {}) }
  );
};

/* ─── beat ───────────────────────────────────────────────────────────────── */
/**
 * Two-pulse heartbeat. Scales up, slightly back, back up a bit, then home.
 *
 * @param {Element}  el
 * @param {object}   [opts]
 * @param {number}   [opts.scale=1.14]    – peak scale
 * @param {number}   [opts.duration=760]
 * @param {boolean}  [opts.loop=false]
 */
const beat = (el, opts = {}) => {
  const { scale = 1.14, duration = 760, loop = false } = opts;
  const s = scale;
  const frames = [
    { transform: 'scale(1)' },
    { transform: `scale(${s})`,                offset: 0.18 },
    { transform: 'scale(.98)',                  offset: 0.34 },
    { transform: `scale(${1 + (s - 1) * 0.6})`, offset: 0.5  },
    { transform: 'scale(1)' },
  ];
  return play(el, frames, { duration, smooth: true, ...(loop ? { iterations: Infinity } : {}) });
};

/* ─── bob ────────────────────────────────────────────────────────────────── */
/**
 * Vertical float-and-return (used for the download arrow on hover).
 *
 * @param {Element}  el
 * @param {object}   [opts]
 * @param {number}   [opts.distance=2.8]  – px travel (positive = down)
 * @param {number}   [opts.duration=600]
 * @param {boolean}  [opts.loop=false]
 */
const bob = (el, opts = {}) => {
  const { distance = 2.8, duration = 600, loop = false } = opts;
  return play(el,
    osc('translateY', 'px', distance, [1]),
    { duration, easing: 'ease-in-out', smooth: true, ...(loop ? { iterations: Infinity } : {}) }
  );
};

/* ─── draw ───────────────────────────────────────────────────────────────── */
/**
 * Animate stroke-dashoffset from 1 → 0 (path must have pathLength="1").
 *
 * @param {Element}  el
 * @param {object}   [opts]
 * @param {number}   [opts.duration=700]
 * @param {number}   [opts.delay=0]
 * @param {string}   [opts.easing='ease-out']
 */
const draw = (el, opts = {}) => {
  const { duration = 700, delay = 0, easing = 'ease-out' } = opts;
  return play(el,
    [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }],
    { duration, delay, easing }
  );
};

/* ─── pop ────────────────────────────────────────────────────────────────── */
/**
 * Quick scale-out pop on an element that is already visible.
 * Used to "bump" a badge that's already shown.
 *
 * @param {Element}  el
 * @param {object}   [opts]
 * @param {number}   [opts.peak=1.45]
 * @param {number}   [opts.duration=420]
 */
const pop = (el, opts = {}) => {
  const { peak = 1.45, duration = 420 } = opts;
  return play(el,
    [{ transform: 'scale(1)' }, { transform: `scale(${peak})` }, { transform: 'scale(1)' }],
    { duration }
  );
};

/* ─── shake ──────────────────────────────────────────────────────────────── */
/**
 * Rapid rotational jitter — used for contextmenu / error states.
 *
 * @param {Element}  el
 * @param {object}   [opts]
 * @param {number}   [opts.power=1]
 * @param {number}   [opts.duration=460]
 */
const shake = (el, opts = {}) => {
  const { power = 1, duration = 460 } = opts;
  return play(el,
    osc('rotate', 'deg', 9 * power, [-1, 0.9, -0.65, 0.5, -0.2]),
    { duration, easing: 'ease-in-out', smooth: true }
  );
};

/* ─── burst ──────────────────────────────────────────────────────────────── */
/**
 * Radial sparks: each element in `els` moves slightly outward and fades.
 * Elements are animated in pairs (even/odd offset).
 *
 * @param {Element[]} els
 * @param {object}    [opts]
 * @param {number}    [opts.delay=0]
 * @param {number}    [opts.duration=640]
 * @param {number}    [opts.travel=2.2]  – px
 */
const burst = (els, opts = {}) => {
  const { delay = 0, duration = 640, travel = 2.2 } = opts;
  els.forEach((el, i) => play(el, [
    { opacity: 0, transform: `translateY(${travel * 1.2}px)` },
    { opacity: 1, transform: 'translateY(0px)',              offset: 0.3 },
    { opacity: 0, transform: `translateY(-${travel}px)` },
  ], { duration, delay: delay + (i % 2) * 40 }));
};

/* ─── rise ───────────────────────────────────────────────────────────────── */
/**
 * Elements float upward and fade — used for the heart's mini hearts.
 * Each element needs a `data-dx` attribute for its horizontal drift.
 *
 * @param {Element[]} els
 * @param {object}    [opts]
 * @param {number}    [opts.duration=950]
 */
const rise = (els, opts = {}) => {
  const { duration = 950 } = opts;
  els.forEach((el, i) => {
    const dx = Number(el.dataset.dx || 0);
    play(el, [
      { opacity: 0, transform: 'translate(0px,2px) scale(.4)' },
      { opacity: 1, transform: `translate(${dx * 0.5}px,-2.5px) scale(1)`, offset: 0.3 },
      { opacity: 0, transform: `translate(${dx * 1.4}px,-8px) scale(.7)` },
    ], { duration, delay: i * 90 });
  });
};

/* ─── pulse ──────────────────────────────────────────────────────────────── */
/**
 * Expanding, fading ring — used for bell ping and heart like burst.
 *
 * @param {Element}  el
 * @param {object}   [opts]
 * @param {number}   [opts.scale=1.5]
 * @param {number}   [opts.duration=620]
 */
const pulse = (el, opts = {}) => {
  const { scale = 1.5, duration = 620 } = opts;
  return play(el,
    [{ transform: 'scale(.55)', opacity: 0.7 }, { transform: `scale(${scale})`, opacity: 0 }],
    { duration }
  );
};

/* ─── wave ───────────────────────────────────────────────────────────────── */
/**
 * Animate a set of concentric arc paths, each with a `data-dir` attribute
 * (+1 / -1) that controls horizontal drift direction.
 *
 * @param {Element[]} els
 * @param {object}    [opts]
 * @param {number}    [opts.duration=770]
 * @param {number}    [opts.power=1]
 * @param {boolean}   [opts.loop=false]
 */
const wave = (els, opts = {}) => {
  const { duration = 770, power = 1, loop = false } = opts;
  const drift = 1.6 * power;
  els.forEach((el, i) => {
    const dir = Number(el.dataset.dir ?? 1);
    play(el, [
      { strokeDashoffset: 1, opacity: 0, transform: 'translateX(0px)' },
      { strokeDashoffset: 0, opacity: 1, transform: `translateX(${dir * 0.4 * power}px)`, offset: 0.35 },
      { strokeDashoffset: 0, opacity: 0, transform: `translateX(${dir * drift}px)` },
    ], { duration, delay: (i % 2) * 110, ...(loop ? { iterations: Infinity } : {}) });
  });
};

/* ─── puff ───────────────────────────────────────────────────────────────── */
/**
 * Dust particles that disperse sideways and up.
 * Each element needs a `data-dx` attribute.
 *
 * @param {Element[]} els
 * @param {object}    [opts]
 * @param {number}    [opts.duration=540]
 */
const puff = (els, opts = {}) => {
  const { duration = 540 } = opts;
  els.forEach((el, i) => {
    const dx = Number(el.dataset.dx || 0);
    play(el, [
      { opacity: 0, transform: 'translate(0px,0px) scale(.5)' },
      { opacity: 0.9, transform: `translate(${dx * 0.5}px,-1px) scale(1)`, offset: 0.3 },
      { opacity: 0, transform: `translate(${dx}px,-2.4px) scale(.6)` },
    ], { duration, delay: i * 30 });
  });
};


  // --- ELEMENT & REGISTRY ---
  /**
 * element.js — <live-icon name="…"> custom element
 *
 * Registers the `live-icon` custom element. It looks up the icon by name
 * from the global registry (populated by each icon module via `defineIcon`),
 * stamps the SVG into the button, applies the card HTML, and calls `mount`.
 *
 * Usage in HTML:
 *   <live-icon name="bell"></live-icon>
 *
 * The element also exposes a static `defineIcon` method so icon modules can
 * self-register:
 *   LiveIcon.defineIcon('bell', { svg, on, label, desc, keys, tag })
 */



const registry = new Map();

/**
 * Register an icon definition.
 * @param {string} name
 * @param {object} def
 * @param {string}   def.svg     – inner SVG markup (the paths, groups, etc.)
 * @param {Function} def.make    – factory(btn) → api object (same shape as engine expects)
 * @param {string}   [def.label] – aria-label for the button
 * @param {string}   [def.desc]  – paragraph text in the card body
 * @param {string}   [def.keys]  – keyboard hint line
 * @param {string}   [def.tag]   – small label shown top-right of card
 */
function defineIcon(name, def) {
  registry.set(name, def);
}

class LiveIconElement extends HTMLElement {
  connectedCallback() {
    const name = this.getAttribute('name');
    if (!name) { console.warn('<live-icon> missing name attribute'); return; }
    const def = registry.get(name);
    if (!def) { console.warn(`<live-icon>: no icon registered for "${name}"`); return; }

    this.dataset.icon = name;
    this.classList.add('card');

    this.innerHTML = `
      <div class="stage">
        <div class="pad">
          <div class="keyline" aria-hidden="true"></div>
          <button class="icon-btn" type="button"
            aria-label="${def.label ?? name + ' icon'}">
            <span class="mag">
              <svg class="ic" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" stroke-width="1.5"
                stroke-linecap="round" stroke-linejoin="round"
                aria-hidden="true" focusable="false">
                ${def.svg}
              </svg>
            </span>
          </button>
        </div>
      </div>
      <div class="body">
        <div class="head">
          <h2>${name.charAt(0).toUpperCase() + name.slice(1)}</h2>
          ${def.tag ? `<span class="tag">${def.tag}</span>` : ''}
        </div>
        ${def.desc  ? `<p class="desc">${def.desc}</p>`  : ''}
        ${def.keys  ? `<p class="keys">${def.keys}</p>`  : ''}
        <div class="events" role="group" aria-label="Fire an event on the ${name}"></div>
        <p class="readout"><span>Last event</span><code>waiting for input</code></p>
      </div>`;

    mount(this, def.make(this.querySelector('.icon-btn')));
  }
}

customElements.define('live-icon', LiveIconElement);


  // --- REGISTERED ICONS ---
  /**
 * icons/bell.js
 *
 * SVG geometry + motion config for the Bell icon.
 * The engine and presets are never modified here.
 * This is the only file the AI needs to read or write for a bell tweak.
 */




defineIcon('bell', {
  tag:   'notifications',
  label: 'Notification bell. Hover, click, double-click, hold or use the arrow keys.',
  desc:  'Rings on hover, raises a badge on click and mutes on double-click. Right-click shakes it, hold keeps it ringing, scroll rings it harder.',
  keys:  '← → swing · ↑ badge · ↓ clear · Esc reset',

  svg: `
    <path class="b-wave" data-dir="-1" d="M3.4 10.2c0-1.5.4-2.9 1.3-4"     pathLength="1"/>
    <path class="b-wave" data-dir="-1" d="M1.4 10.8c0-2.4.7-4.6 2.1-6.4"   pathLength="1"/>
    <path class="b-wave" data-dir="1"  d="M20.6 10.2c0-1.5-.4-2.9-1.3-4"   pathLength="1"/>
    <path class="b-wave" data-dir="1"  d="M22.6 10.8c0-2.4-.7-4.6-2.1-6.4" pathLength="1"/>
    <g class="b-swing">
      <path d="M12 2.4v1.7"/>
      <path d="M4.5 17.5c1.1-.9 1.6-2 1.6-3.4V10a5.9 5.9 0 0 1 11.8 0v4.1c0 1.4.5 2.5 1.6 3.4H4.5Z"/>
      <path class="b-glint" d="M8.5 9.6a3.5 3.5 0 0 1 2-3"/>
      <g class="b-clapper"><path d="M9.8 20.2a2.4 2.4 0 0 0 4.4 0"/></g>
    </g>
    <g class="b-badge">
      <circle class="b-ping" cx="18.4" cy="5" r="2.6"/>
      <circle class="b-dot"  cx="18.4" cy="5" r="2.6"/>
    </g>
    <path class="b-slash-halo" d="M4 3.6 20 20.6" pathLength="1"/>
    <path class="b-slash"      d="M4 3.6 20 20.6" pathLength="1"/>
  `,

  make(btn) {
    const q  = s => btn.querySelector(s);
    const qa = s => [...btn.querySelectorAll(s)];

    const swingEl  = q('.b-swing');
    const clapEl   = q('.b-clapper');
    const badgeEl  = q('.b-badge');
    const pingEl   = q('.b-ping');
    const waves    = qa('.b-wave');
    const has      = c => btn.classList.contains(c);

    /* Ring: swing + clapper counterpoint + waves */
    const ring = (power = 1, ms = 1100) => {
      swing(swingEl, { power, duration: ms });
      play(clapEl, osc('translateX', 'px', 1.6 * power, [-1, 0.9, -0.6, 0.4, -0.2, 0.1]),
        { duration: ms, delay: 70, easing: 'ease-in-out', smooth: true });
      if (power > 0.6) wave(waves, { duration: ms * 0.7, power });
    };

    /* Show / bump the badge dot + send a ping ring outward */
    const raise = () => {
      const had = has('is-alert');
      btn.classList.add('is-alert');
      if (had) play(badgeEl, [{ transform: 'scale(1)' }, { transform: 'scale(1.45)' }, { transform: 'scale(1)' }], { duration: 420 });
      pulse(pingEl, { scale: 3, duration: 760, delay: had ? 0 : 120 });
    };

    const loopers = [swingEl, clapEl, ...waves];

    return {
      enter()  { ring(has('is-muted') ? 0.3 : 0.8, 1000); },
      leave()  { loopers.forEach(e => { if (e.__a) e.__a.updatePlaybackRate(1.8); }); },

      click()  {
        const m = has('is-muted');
        ring(m ? 0.35 : 1.25, m ? 800 : 1300);
        if (!m) raise();
      },

      dbl() {
        const m = btn.classList.toggle('is-muted');
        if (m) {
          btn.classList.remove('is-alert');
          play(swingEl, osc('rotate', 'deg', 6, [-1]), { duration: 300, smooth: true });
        } else ring(1.1, 1000);
      },

      ctx()    { shake(swingEl, { power: 0.75 }); },

      hold() {
        swing(swingEl, { power: 1.17, duration: 520, loop: true });
        play(clapEl, osc('translateX', 'px', 1.8, [-1, 1]),
          { duration: 520, iterations: Infinity, easing: 'ease-in-out', delay: 70 });
        wave(waves, { loop: true, duration: 900 });
      },
      holdEnd() { loopers.forEach(e => finishLoop(e.__a)); },

      wheel(dy)  { ring(Math.min(1.2, 0.45 + Math.abs(dy) / 260), 800); },
      focus()    { ring(0.55, 800); },

      key(k) {
        if (k === 'ArrowUp')   { btn.classList.remove('is-muted'); raise(); ring(0.9, 900); }
        else if (k === 'ArrowDown') { btn.classList.remove('is-alert'); }
        else {
          const s = k === 'ArrowLeft' ? -1 : 1;
          play(swingEl, osc('rotate', 'deg', 18, [s, -s * 0.28]), { duration: 700, smooth: true });
        }
      },

      reset() { btn.classList.remove('is-alert', 'is-muted'); },
      idle()  { ring(0.4, 900); },
    };
  },
});


/**
 * icons/heart.js
 *
 * SVG geometry + motion config for the Heart icon.
 */




defineIcon('heart', {
  tag:   'reactions',
  label: 'Like heart. Click to like, double-click to love, right-click to break.',
  desc:  'Beats on hover, fills and bursts on click, goes all in on double-click. Right-click breaks it, hold keeps the pulse going.',
  keys:  '← → tilt · ↑ like · ↓ unlike · Esc reset',

  svg: `
    <g class="h-body">
      <path class="h-fill"  d="M12 20.5s-8-4.7-8-10.6A4.6 4.6 0 0 1 8.5 5.3c1.4 0 2.6.6 3.5 1.8.9-1.2 2.1-1.8 3.5-1.8A4.6 4.6 0 0 1 20 9.9c0 5.9-8 10.6-8 10.6Z"/>
      <path class="h-line"  d="M12 20.5s-8-4.7-8-10.6A4.6 4.6 0 0 1 8.5 5.3c1.4 0 2.6.6 3.5 1.8.9-1.2 2.1-1.8 3.5-1.8A4.6 4.6 0 0 1 20 9.9c0 5.9-8 10.6-8 10.6Z"/>
      <path class="h-shine" d="M7 9.6a2.4 2.4 0 0 1 1.6-2.2"/>
      <path class="h-ecg"   d="M7.2 12.2h2.3l1.2-2.4 1.9 4.6 1.3-2.2h1.9"     pathLength="1"/>
      <path class="h-crack" d="M12.2 7.2l-1.5 2.9 2.2 1.5-1.7 3.3"              pathLength="1"/>
    </g>
    <circle class="h-ring" cx="12" cy="12.5" r="8"/>
    <g class="h-sparks">
      <g transform="rotate(0   12 12.5)"><path class="h-spark" d="M12 1.4v2"/></g>
      <g transform="rotate(45  12 12.5)"><path class="h-spark" d="M12 1.4v2"/></g>
      <g transform="rotate(90  12 12.5)"><path class="h-spark" d="M12 1.4v2"/></g>
      <g transform="rotate(135 12 12.5)"><path class="h-spark" d="M12 1.4v2"/></g>
      <g transform="rotate(180 12 12.5)"><path class="h-spark" d="M12 1.4v2"/></g>
      <g transform="rotate(225 12 12.5)"><path class="h-spark" d="M12 1.4v2"/></g>
      <g transform="rotate(270 12 12.5)"><path class="h-spark" d="M12 1.4v2"/></g>
      <g transform="rotate(315 12 12.5)"><path class="h-spark" d="M12 1.4v2"/></g>
    </g>
    <g class="h-minis">
      <g transform="translate(12 6.2)">   <path class="h-mini" data-dx="0"   d="M0 2.2s-2.4-1.4-2.4-3.2a1.4 1.4 0 0 1 2.4-.9 1.4 1.4 0 0 1 2.4.9c0 1.8-2.4 3.2-2.4 3.2Z"/></g>
      <g transform="translate(6.6 8.4)">  <path class="h-mini" data-dx="-2.6" d="M0 2.2s-2.4-1.4-2.4-3.2a1.4 1.4 0 0 1 2.4-.9 1.4 1.4 0 0 1 2.4.9c0 1.8-2.4 3.2-2.4 3.2Z"/></g>
      <g transform="translate(17.4 8.4)"> <path class="h-mini" data-dx="2.6"  d="M0 2.2s-2.4-1.4-2.4-3.2a1.4 1.4 0 0 1 2.4-.9 1.4 1.4 0 0 1 2.4.9c0 1.8-2.4 3.2-2.4 3.2Z"/></g>
    </g>
  `,

  make(btn) {
    const q  = s => btn.querySelector(s);
    const qa = s => [...btn.querySelectorAll(s)];

    const bodyEl  = q('.h-body');
    const ecgEl   = q('.h-ecg');
    const ringEl  = q('.h-ring');
    const sparks  = qa('.h-spark');
    const minis   = qa('.h-mini');

    let healT = 0, ringT = 0;

    const setLiked = v => {
      btn.classList.toggle('is-liked', v);
      btn.setAttribute('aria-pressed', v ? 'true' : 'false');
    };

    return {
      enter()  { beat(bodyEl, { scale: 1.12, duration: 700 }); draw(ecgEl); },
      leave()  {},

      click() {
        const liked = !btn.classList.contains('is-liked');
        setLiked(liked);
        if (liked) {
          beat(bodyEl, { scale: 1.25, duration: 820 });
          burst(sparks);
          pulse(ringEl);
          rise(minis);
        } else {
          play(bodyEl, [
            { transform: 'scale(1)' },
            { transform: 'scale(.86)', offset: 0.4 },
            { transform: 'scale(1)' },
          ], { duration: 380, smooth: true });
        }
      },

      dbl() {
        setLiked(true);
        beat(bodyEl, { scale: 1.35, duration: 900 });
        burst(sparks);
        setTimeout(() => burst(sparks), 140);
        pulse(ringEl, { scale: 1.3 });
        setTimeout(() => pulse(ringEl, { scale: 1.6 }), 150);
        rise(minis);
      },

      ctx() {
        btn.classList.add('is-broken');
        play(bodyEl, osc('rotate', 'deg', 7, [-1, 0.85, -0.55]), { duration: 420, smooth: true });
        clearTimeout(healT);
        healT = setTimeout(() => { btn.classList.remove('is-broken'); beat(bodyEl, { scale: 1.1, duration: 600 }); }, 1500);
      },

      hold() {
        beat(bodyEl, { scale: 1.16, duration: 760, loop: true });
        pulse(ringEl);
        ringT = setInterval(() => pulse(ringEl), 760);
      },
      holdEnd() { finishLoop(bodyEl.__a); clearInterval(ringT); },

      wheel(dy)  { beat(bodyEl, { scale: 1.08 + Math.min(0.14, Math.abs(dy) / 900), duration: 520 }); },
      focus()    { beat(bodyEl, { scale: 1.1, duration: 700 }); draw(ecgEl); },

      key(k) {
        if (k === 'ArrowUp')        { setLiked(true);  beat(bodyEl, { scale: 1.25, duration: 820 }); burst(sparks); pulse(ringEl); }
        else if (k === 'ArrowDown') { setLiked(false); }
        else {
          const s = k === 'ArrowLeft' ? -1 : 1;
          play(bodyEl, osc('rotate', 'deg', 10, [s, -s * 0.4]), { duration: 520, smooth: true });
        }
      },

      reset() { setLiked(false); btn.classList.remove('is-broken'); },
      idle()  { beat(bodyEl, { scale: 1.1, duration: 800 }); },
    };
  },
});


/**
 * icons/download.js
 *
 * SVG geometry + motion config for the Download icon.
 * State machine: idle → busy → done → idle
 */




defineIcon('download', {
  tag:   'progress',
  label: 'Download. Click to start, double-click to finish, right-click to cancel.',
  desc:  'The arrow bobs on hover. Click runs the download, double-click skips to done, right-click cancels, hold downloads at full speed.',
  keys:  '↓ start · ↑ cancel · ← → wobble tray',

  svg: `
    <g class="d-tray">
      <path d="M3.5 15.5v3A2.5 2.5 0 0 0 6 21h12a2.5 2.5 0 0 0 2.5-2.5v-3"/>
      <path class="d-track" d="M7.5 17.9h9"/>
      <path class="d-bar"   d="M7.5 17.9h9" pathLength="1"/>
    </g>
    <g class="d-arrow">
      <path d="M12 3v11.2"/>
      <path d="M7.6 10.2l4.4 4.4 4.4-4.4"/>
      <path class="d-trail" d="M7.3  4.8v2.1"/>
      <path class="d-trail" d="M16.7 4.8v2.1"/>
    </g>
    <g class="d-done">
      <circle class="d-done-ring" cx="12" cy="9" r="6.4" pathLength="1" transform="rotate(-90 12 9)"/>
      <path   class="d-check"     d="M8.9 9.2l2.2 2.2 4-4.3"             pathLength="1"/>
    </g>
    <g class="d-dust">
      <circle class="d-puff" data-dx="-3"   cx="5.4"  cy="15.2" r=".6"/>
      <circle class="d-puff" data-dx="-1.6" cx="8"    cy="15.2" r=".5"/>
      <circle class="d-puff" data-dx="1.6"  cx="16"   cy="15.2" r=".5"/>
      <circle class="d-puff" data-dx="3"    cx="18.6" cy="15.2" r=".6"/>
    </g>
  `,

  make(btn) {
    const q  = s => btn.querySelector(s);
    const qa = s => [...btn.querySelectorAll(s)];

    const arrowEl  = q('.d-arrow');
    const trayEl   = q('.d-tray');
    const trails   = qa('.d-trail');
    const puffs    = qa('.d-puff');

    let st = 'idle', t1 = 0, t2 = 0, t3 = 0;
    const setState = s => { st = s; btn.dataset.state = s; };
    const clearT   = () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };

    const reset = () => { clearT(); setState('idle'); };

    const run = fast => {
      clearT();
      [arrowEl, ...trails].forEach(stopAnim);
      const go = () => {
        const d = fast ? 650 : 1700;
        btn.style.setProperty('--dl', d + 'ms');
        setState('busy');
        t3 = setTimeout(() => puff(puffs), 170);
        t1 = setTimeout(() => setState('done'), d + 300);
        t2 = setTimeout(reset, d + 300 + 2800);
      };
      if (st === 'idle') go();
      else { setState('idle'); t1 = setTimeout(go, 360); }
    };

    const bobOnce = () => {
      if (st !== 'idle') return;
      bob(arrowEl, { distance: 2.8, duration: 600 });
    };

    return {
      enter() {
        if (st !== 'idle') return;
        bob(arrowEl, { distance: 2.4, duration: 900, loop: true });
        trails.forEach((t, i) => play(t, [
          { opacity: 0, transform: 'translateY(-2px)' },
          { opacity: 0.9, transform: 'translateY(0px)',   offset: 0.3 },
          { opacity: 0, transform: 'translateY(3.2px)' },
        ], { duration: 900, iterations: Infinity, delay: i * 140, easing: 'ease-in' }));
      },

      leave() { [arrowEl, ...trails].forEach(e => finishLoop(e.__a)); },

      click() {
        if (st === 'busy') {
          play(arrowEl, [
            { transform: 'translateY(3.2px)' },
            { transform: 'translateY(4.4px)' },
            { transform: 'translateY(3.2px)' },
          ], { duration: 360 });
        } else run(false);
      },

      dbl() {
        clearT();
        [arrowEl, ...trails].forEach(stopAnim);
        setState('done');
        puff(puffs);
        t2 = setTimeout(reset, 2800);
      },

      ctx() {
        reset();
        [arrowEl, ...trails].forEach(stopAnim);
        play(trayEl, osc('rotate', 'deg', 4, [-1, 0.8, -0.5, 0.3]), { duration: 420 });
      },

      hold()     { run(true); },
      wheel()    { bobOnce(); },
      focus()    { bobOnce(); },

      key(k) {
        if (k === 'ArrowDown')      run(false);
        else if (k === 'ArrowUp')   reset();
        else play(trayEl, osc('rotate', 'deg', 5, [k === 'ArrowLeft' ? -1 : 1, -0.5]), { duration: 460 });
      },

      reset,
      idle() { bobOnce(); },
    };
  },
});


/**
 * icons/gear.js
 *
 * SVG geometry + motion config for the Gear icon.
 * Uses a requestAnimationFrame inertia loop — the only icon that does so.
 * The gearPath() helper generates the 8-tooth gear outline procedurally
 * so the AI never has to hand-craft it.
 */




/* ── Gear-tooth geometry helper (reusable for any n-tooth gear) ──────────── */
/**
 * Generate an SVG path string for a gear with `n` teeth.
 * @param {object} [opts]
 * @param {number} [opts.n=8]      – number of teeth
 * @param {number} [opts.rOut=9.4] – outer (tooth tip) radius
 * @param {number} [opts.rIn=7.3]  – inner (root) radius
 * @param {number} [opts.tip=8]    – half-angle of tooth tip, degrees
 * @param {number} [opts.root=13]  – half-angle of tooth root, degrees
 * @param {number} [opts.cx=12]    – centre x
 * @param {number} [opts.cy=12]    – centre y
 */
const gearPath = ({ n = 8, rOut = 9.4, rIn = 7.3, tip = 8, root = 13, cx = 12, cy = 12 } = {}) => {
  const P = (r, deg) => {
    const a = (deg - 90) * Math.PI / 180;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  };
  const f = v => v.toFixed(2);
  let d = '';
  for (let i = 0; i < n; i++) {
    const m    = i * 360 / n;
    const pts  = [[rIn, m - root], [rOut, m - tip], [rOut, m + tip], [rIn, m + root]].map(([r, a]) => P(r, a));
    d += i
      ? `A${rIn} ${rIn} 0 0 1 ${f(pts[0][0])} ${f(pts[0][1])}`
      : `M${f(pts[0][0])} ${f(pts[0][1])}`;
    d += ` L${f(pts[1][0])} ${f(pts[1][1])} L${f(pts[2][0])} ${f(pts[2][1])} L${f(pts[3][0])} ${f(pts[3][1])} `;
  }
  const first = P(rIn, -root);
  return d + `A${rIn} ${rIn} 0 0 1 ${f(first[0])} ${f(first[1])}Z`;
};

defineIcon('gear', {
  tag:   'settings',
  label: 'Settings gear. Hover to spin, click to kick, scroll to wind, double-click for turbo.',
  desc:  'Spins up on hover and coasts to a stop when you leave. Click kicks it, scroll winds it, right-click reverses it, double-click toggles turbo.',
  keys:  '← → spin · ↑ turbo · ↓ brake · Esc reset',

  /* The gear body path is filled in at runtime by connectedCallback (see below). */
  svg: `
    <g class="g-ticks">
      <path d="M12 .4v1.2"/>
      <path d="M12 .4v1.2" transform="rotate(90  12 12)"/>
      <path d="M12 .4v1.2" transform="rotate(180 12 12)"/>
      <path d="M12 .4v1.2" transform="rotate(270 12 12)"/>
    </g>
    <g class="g-rotor"><path class="g-gear" d=""/></g>
    <circle class="g-ring" cx="12" cy="12" r="5.2" pathLength="100"/>
    <circle class="g-hub"  cx="12" cy="12" r="2.8"/>
    <circle class="g-core" cx="12" cy="12" r=".95"/>
  `,

  make(btn) {
    /* Fill in the generated gear path (can't do it in static SVG string). */
    btn.querySelector('.g-gear').setAttribute('d', gearPath());

    const rotorEl = btn.querySelector('.g-rotor');
    const ringEl  = btn.querySelector('.g-ring');
    const ticksEl = btn.querySelector('.g-ticks');

    let angle = 0, vel = 0, target = 0, dir = 1;
    let turbo = false, holdT = 0, raf = 0, last = 0;
    let braking = false, holding = false;

    const render = () => {
      rotorEl.style.transform = `rotate(${angle}deg)`;
      ringEl.style.transform  = `rotate(${-angle * 1.6}deg)`;
    };

    const base = () => turbo
      ? 240 * dir
      : (btn.classList.contains('is-hover') ? 70 * dir : 0);

    const loop = t => {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      if (holding) { holdT += dt; target = dir * Math.min(720, 120 + holdT * 500); }
      const k = braking ? 14 : (target === 0 ? 1.6 : 4);
      vel += (target - vel) * (1 - Math.exp(-k * dt));
      angle += vel * dt;
      render();
      if (Math.abs(vel) < 0.4 && target === 0) { vel = 0; raf = 0; return; }
      raf = requestAnimationFrame(loop);
    };

    const kick = () => {
      if (reduce.matches) { angle += 45 * dir; render(); return; }
      if (!raf) { last = performance.now(); raf = requestAnimationFrame(loop); }
    };

    const tickPulse = () => play(ticksEl, [
      { opacity: 0, transform: 'scale(.92)' },
      { opacity: 1, transform: 'scale(1.06)', offset: 0.3 },
      { opacity: 0, transform: 'scale(1.12)' },
    ], { duration: 600 });

    const retarget = () => { target = braking ? 0 : base(); kick(); };

    return {
      enter()    { retarget(); },
      leave()    { braking = false; retarget(); },
      down()     { braking = true;  target = 0; kick(); },
      up()       { braking = false; retarget(); },

      click()    { vel += 480 * dir; kick(); tickPulse(); },

      dbl() {
        turbo = !turbo;
        btn.classList.toggle('is-turbo', turbo);
        vel += 300 * dir;
        retarget();
      },

      ctx()  { dir *= -1; vel = -vel * 0.6 + 360 * dir; retarget(); },

      hold()    { holding = true; holdT = 0; braking = false; kick(); },
      holdEnd() { holding = false; retarget(); },

      wheel(dy) { vel += Math.max(-900, Math.min(900, dy * 2.2)); kick(); },
      focus()   { vel += 140 * dir; kick(); tickPulse(); },

      key(k) {
        if (k === 'ArrowLeft')       vel -= 420;
        else if (k === 'ArrowRight') vel += 420;
        else if (k === 'ArrowUp')  { turbo = true;  btn.classList.add('is-turbo');    retarget(); }
        else                        { turbo = false; btn.classList.remove('is-turbo'); vel *= 0.2; retarget(); }
        kick();
      },

      reset() { turbo = false; dir = 1; btn.classList.remove('is-turbo'); retarget(); },
      idle()  { vel += 110 * dir; kick(); },
    };
  },
});


  // Expose global for non-module scripts
  if (typeof window !== 'undefined') {
    window.LiveIcons = { defineIcon, mount, play, osc, stopAnim, finishLoop };
  }
})();
