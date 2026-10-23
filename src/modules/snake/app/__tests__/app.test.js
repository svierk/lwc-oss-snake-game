import { createElement } from 'lwc';
import App, { GAME_KEY, GAME_NAME } from 'snake/app';
import { connectToHost } from 'snake/embedding';

jest.mock('snake/embedding', () => ({ connectToHost: jest.fn(() => null) }));

function createApp() {
  const element = createElement('snake-app', { is: App });
  document.body.appendChild(element);
  const phone = element.shadowRoot.querySelector('snake-phone');
  const game = element.shadowRoot.querySelector('snake-game');
  return { element, phone, game };
}

const flush = () => Promise.resolve();
const keyDown = (key, options = {}) => {
  const event = new KeyboardEvent('keydown', { key, cancelable: true, ...options });
  window.dispatchEvent(event);
  return event;
};
const title = (game) => game.shadowRoot.querySelector('.message-title')?.textContent;

describe('snake-app', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('is accessible', async () => {
    // sa11y refuses to run with fake timers.
    jest.useRealTimers();
    const { element } = createApp();
    await flush();
    await expect(element).toBeAccessible();
  });

  it('puts the game into the phone', () => {
    const { phone, game } = createApp();
    expect(game.parentElement).toBe(phone);
  });

  it('maps keys of the phone to game actions', async () => {
    const { phone, game } = createApp();
    phone.dispatchEvent(new CustomEvent('phonekey', { detail: { key: '5' } }));
    await flush();
    expect(title(game)).toBeUndefined();
    phone.dispatchEvent(new CustomEvent('phonekey', { detail: { key: 'softRight' } }));
    await flush();
    expect(title(game)).toBe('PAUSED');
    phone.dispatchEvent(new CustomEvent('phonekey', { detail: { key: '1' } }));
    await flush();
    expect(title(game)).toBe('PAUSED');
  });

  it('maps the keyboard to phone keys and highlights them while held', async () => {
    const { phone, game } = createApp();
    const event = keyDown('Enter');
    await flush();
    expect(event.defaultPrevented).toBe(true);
    expect(phone.activeKey).toBe('select');
    expect(title(game)).toBeUndefined();

    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter' }));
    await flush();
    expect(phone.activeKey).toBeUndefined();

    keyDown('Escape');
    await flush();
    expect(phone.activeKey).toBe('softRight');
    expect(title(game)).toBe('PAUSED');
  });

  it('accepts upper case letters for WASD', async () => {
    const { phone } = createApp();
    keyDown('W');
    await flush();
    expect(phone.activeKey).toBe('up');
  });

  it('ignores held select keys so the game does not toggle repeatedly', async () => {
    const { game } = createApp();
    keyDown('Enter');
    keyDown('Enter', { repeat: true });
    await flush();
    expect(title(game)).toBeUndefined();
  });

  it('leaves unrelated keys and shortcuts to the browser', () => {
    createApp();
    expect(keyDown('Tab').defaultPrevented).toBe(false);
    expect(keyDown('r', { metaKey: true }).defaultPrevented).toBe(false);
  });

  it('stops listening to the keyboard when removed', async () => {
    const { element, phone } = createApp();
    document.body.removeChild(element);
    keyDown('ArrowUp');
    await flush();
    expect(phone.activeKey).toBeUndefined();
  });

  describe('standalone', () => {
    it('fills the viewport and keeps the end of a round to itself', () => {
      const { element, phone, game } = createApp();
      expect(connectToHost).toHaveBeenCalledWith({ target: element });
      expect(element.shadowRoot.querySelector('main').className).toBe('stage');
      expect(phone.className).toBe('');
      expect(() => game.dispatchEvent(new CustomEvent('gameover', { detail: { score: 1 } }))).not.toThrow();
    });
  });

  describe('embedded in a Salesforce page', () => {
    let host;

    beforeEach(() => {
      host = { dispatch: jest.fn(), dispose: jest.fn() };
      connectToHost.mockReturnValueOnce(host);
    });

    it('sizes the phone by the width of the frame', () => {
      const { element, phone } = createApp();
      expect(element.shadowRoot.querySelector('main').className).toBe('stage embedded');
      expect(phone.className).toBe('embedded');
    });

    it('sends the end of a round to the host, which saves the score', () => {
      const { game } = createApp();
      const detail = { score: 12, level: 3, durationSeconds: 41 };
      game.dispatchEvent(new CustomEvent('gameover', { detail }));
      expect(host.dispatch).toHaveBeenCalledWith('gameover', { gameKey: GAME_KEY, gameName: GAME_NAME, ...detail });
    });

    it('closes the session when removed', () => {
      const { element } = createApp();
      document.body.removeChild(element);
      expect(host.dispose).toHaveBeenCalled();
    });
  });
});
