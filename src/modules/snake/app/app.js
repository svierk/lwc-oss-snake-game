import { LightningElement } from 'lwc';
import { connectToHost } from 'snake/embedding';

/** Identify the game in the `gameover` event sent to a Salesforce host page. */
export const GAME_KEY = 'snake';
export const GAME_NAME = 'Snake';

/** What each key of the phone does in the game - like on the original, 2/4/6/8 steer and 5 selects. */
export const KEY_ACTIONS = {
  up: 'up',
  2: 'up',
  down: 'down',
  8: 'down',
  left: 'left',
  4: 'left',
  right: 'right',
  6: 'right',
  select: 'select',
  5: 'select',
  call: 'select',
  softLeft: 'select',
  end: 'back',
  softRight: 'back'
};

/** Which phone key a key of the physical keyboard presses. */
export const KEYBOARD_KEYS = {
  ArrowUp: 'up',
  w: 'up',
  ArrowDown: 'down',
  s: 'down',
  ArrowLeft: 'left',
  a: 'left',
  ArrowRight: 'right',
  d: 'right',
  Enter: 'select',
  ' ': 'select',
  p: 'softLeft',
  Escape: 'softRight',
  Backspace: 'end',
  '*': '*',
  '#': '#',
  ...Object.fromEntries('0123456789'.split('').map((digit) => [digit, digit]))
};

const NON_REPEATING_ACTIONS = new Set(['select', 'back']);

export default class App extends LightningElement {
  activeKey;
  /** Session with a Salesforce page that frames the game; null when it runs standalone. */
  host = null;

  handleKeyDown = (event) => {
    const key = this.phoneKeyFor(event);
    if (!key) {
      return;
    }
    event.preventDefault();
    this.activeKey = key;
    if (!(event.repeat && NON_REPEATING_ACTIONS.has(KEY_ACTIONS[key]))) {
      this.pressKey(key);
    }
  };

  handleKeyUp = () => {
    this.activeKey = undefined;
  };

  connectedCallback() {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.handleKeyUp);
    this.host = connectToHost({ target: this.template.host });
  }

  disconnectedCallback() {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.handleKeyUp);
    this.host?.dispose();
    this.host = null;
  }

  /** Embedded, the phone is sized by the width of the frame and the frame by the phone. */
  get embedded() {
    return Boolean(this.host);
  }

  get stageClass() {
    return this.embedded ? 'stage embedded' : 'stage';
  }

  get phoneClass() {
    return this.embedded ? 'embedded' : '';
  }

  phoneKeyFor(event) {
    if (event.ctrlKey || event.metaKey || event.altKey) {
      return undefined;
    }
    // A focused phone key is activated by Enter/Space on its own (as a click).
    const fromButton = event.composedPath().some((node) => node.tagName === 'BUTTON');
    if (fromButton && (event.key === 'Enter' || event.key === ' ')) {
      return undefined;
    }
    const name = event.key ?? '';
    return KEYBOARD_KEYS[name] ?? KEYBOARD_KEYS[name.toLowerCase()];
  }

  handlePhoneKey(event) {
    this.pressKey(event.detail.key);
  }

  /** The host saves the score - the game itself has no Salesforce session. */
  handleGameOver(event) {
    this.host?.dispatch('gameover', { gameKey: GAME_KEY, gameName: GAME_NAME, ...event.detail });
  }

  pressKey(key) {
    const action = KEY_ACTIONS[key];
    if (action) {
      this.refs.game.press(action);
    }
  }
}
