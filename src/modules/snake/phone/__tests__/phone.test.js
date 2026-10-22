import { createElement } from 'lwc';
import Phone from 'snake/phone';

function createPhone() {
  const element = createElement('snake-phone', { is: Phone });
  const handler = jest.fn();
  element.addEventListener('phonekey', handler);
  document.body.appendChild(element);
  return { element, handler };
}

const flush = () => Promise.resolve();
const key = (element, id) => element.shadowRoot.querySelector(`[data-key="${id}"]`);
const pressedKeys = (handler) => handler.mock.calls.map(([event]) => event.detail.key);

describe('snake-phone', () => {
  afterEach(() => {
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
  });

  it('is accessible', async () => {
    const { element } = createPhone();
    await flush();
    await expect(element).toBeAccessible();
  });

  it('renders the navigation keys and a 12 key number pad', () => {
    const { element } = createPhone();
    ['softLeft', 'softRight', 'call', 'end', 'up', 'down', 'left', 'right', 'select'].forEach((id) => {
      expect(key(element, id)).not.toBeNull();
    });
    const digits = [...element.shadowRoot.querySelectorAll('.keypad .digit')].map((el) => el.textContent);
    expect(digits).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#']);
  });

  it('reports a key on pointerdown', () => {
    const { element, handler } = createPhone();
    key(element, 'up').dispatchEvent(new CustomEvent('pointerdown', { cancelable: true }));
    key(element, '5').dispatchEvent(new CustomEvent('pointerdown', { cancelable: true }));
    expect(pressedKeys(handler)).toEqual(['up', '5']);
  });

  it('reports keyboard activated clicks but not pointer clicks', () => {
    const { element, handler } = createPhone();
    key(element, 'select').click();
    key(element, 'end').dispatchEvent(new MouseEvent('click', { detail: 1 }));
    expect(pressedKeys(handler)).toEqual(['select']);
  });

  it('highlights the active key', async () => {
    const { element } = createPhone();
    element.activeKey = 'left';
    await flush();
    expect(key(element, 'left').classList).toContain('pressed');
    expect(key(element, 'right').classList).not.toContain('pressed');
    element.activeKey = '8';
    await flush();
    expect(key(element, '8').classList).toContain('pressed');
    expect(key(element, 'left').classList).not.toContain('pressed');
  });

  it('renders slotted content as the display', async () => {
    const { element } = createPhone();
    await flush();
    expect(element.shadowRoot.querySelector('.screen slot')).not.toBeNull();
  });
});
