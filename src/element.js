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

import { mount } from './engine.js';

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
export function defineIcon(name, def) {
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
