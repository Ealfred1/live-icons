/**
 * icons/bell.js
 *
 * SVG geometry + motion config for the Bell icon.
 * The engine and presets are never modified here.
 * This is the only file the AI needs to read or write for a bell tweak.
 */

import { defineIcon } from '../element.js';
import { swing, shake, wave, pulse, play, osc, finishLoop } from '../presets.js';

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
