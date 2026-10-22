import { LightningElement, api } from 'lwc';

const NAV_KEYS = ['softLeft', 'softRight', 'call', 'end', 'up', 'down', 'left', 'right', 'select'];

const toKebabCase = (value) => value.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`);

const DIGIT_KEYS = [
  { id: '1', label: '1', letters: '.,?' },
  { id: '2', label: '2', letters: 'abc' },
  { id: '3', label: '3', letters: 'def' },
  { id: '4', label: '4', letters: 'ghi' },
  { id: '5', label: '5', letters: 'jkl' },
  { id: '6', label: '6', letters: 'mno' },
  { id: '7', label: '7', letters: 'pqrs' },
  { id: '8', label: '8', letters: 'tuv' },
  { id: '9', label: '9', letters: 'wxyz' },
  { id: '*', label: '*', letters: '+' },
  { id: '0', label: '0', letters: '␣' },
  { id: '#', label: '#', letters: '⇧' }
];

/**
 * The hardware of the retro phone: body, screen bezel and keys. It knows
 * nothing about Snake - the display is slotted in and every key press is
 * reported as a `phonekey` event with the id of the key.
 */
export default class Phone extends LightningElement {
  /** Id of a key to show as pressed, e.g. while the matching keyboard key is held. */
  @api activeKey;

  get keyClass() {
    return Object.fromEntries(NAV_KEYS.map((id) => [id, this.classFor(id, `key key-${toKebabCase(id)}`)]));
  }

  get digitKeys() {
    return DIGIT_KEYS.map((key) => ({ ...key, className: this.classFor(key.id, 'key key-digit') }));
  }

  classFor(id, base) {
    return id === this.activeKey ? `${base} pressed` : base;
  }

  // Keys react on pointerdown instead of click: it fires immediately, which
  // matters for a game, and it is not delayed by the double-tap detection.
  handlePointerDown(event) {
    event.preventDefault();
    this.emit(event.currentTarget.dataset.key);
  }

  // Clicks without a pointer (detail 0) come from the keyboard or assistive
  // technology - pointer clicks were already handled on pointerdown.
  handleClick(event) {
    if (event.detail === 0) {
      this.emit(event.currentTarget.dataset.key);
    }
  }

  emit(key) {
    this.dispatchEvent(new CustomEvent('phonekey', { detail: { key } }));
  }
}
