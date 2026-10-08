/**
 * icons/heart.js
 *
 * SVG geometry + motion config for the Heart icon.
 */

import { defineIcon } from '../element.js';
import { beat, burst, rise, pulse, draw, play, osc, finishLoop } from '../presets.js';

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
