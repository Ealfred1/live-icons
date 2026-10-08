/**
 * icons/download.js
 *
 * SVG geometry + motion config for the Download icon.
 * State machine: idle → busy → done → idle
 */

import { defineIcon } from '../element.js';
import { bob, puff, play, osc, stopAnim, finishLoop } from '../presets.js';

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
