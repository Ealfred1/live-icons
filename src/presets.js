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

import { play, osc, stopAnim, finishLoop, reduce } from './engine.js';
export { play, osc, stopAnim, finishLoop, reduce };

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
export const swing = (el, opts = {}) => {
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
export const beat = (el, opts = {}) => {
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
export const bob = (el, opts = {}) => {
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
export const draw = (el, opts = {}) => {
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
export const pop = (el, opts = {}) => {
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
export const shake = (el, opts = {}) => {
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
export const burst = (els, opts = {}) => {
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
export const rise = (els, opts = {}) => {
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
export const pulse = (el, opts = {}) => {
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
export const wave = (els, opts = {}) => {
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
export const puff = (els, opts = {}) => {
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
