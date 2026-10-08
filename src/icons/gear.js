/**
 * icons/gear.js
 *
 * SVG geometry + motion config for the Gear icon.
 * Uses a requestAnimationFrame inertia loop — the only icon that does so.
 * The gearPath() helper generates the 8-tooth gear outline procedurally
 * so the AI never has to hand-craft it.
 */

import { defineIcon } from '../element.js';
import { play, reduce } from '../presets.js';

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
export const gearPath = ({ n = 8, rOut = 9.4, rIn = 7.3, tip = 8, root = 13, cx = 12, cy = 12 } = {}) => {
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
