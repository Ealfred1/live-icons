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

export const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

const wait = ms => new Promise(r => setTimeout(r, ms));

/* ─── Low-level WAAPI helpers ────────────────────────────────────────────── */

/**
 * Play a WAAPI animation on `el`, cancelling any previous one.
 * Pass { smooth: true } to prepend the element's current computed transform
 * so the new animation starts exactly where it is rather than jumping.
 */
export const play = (el, frames, opts = {}) => {
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
export const stopAnim = el => {
  if (el && el.__a) { el.__a.cancel(); el.__a = null; }
};

/**
 * Advance an infinite-loop animation to the end of its current iteration
 * so it doesn't snap back to frame 0 when it stops.
 */
export const finishLoop = a => {
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
export const osc = (fn, unit, amp, keys) =>
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
export const mount = (card, api) => {
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
