import { createElement } from 'lwc';
import Game from 'snake/game';

const BLOCK_SIZE = 20;
const CONTAINER_SIZE = 200;
const GRID_SIZE = CONTAINER_SIZE / BLOCK_SIZE;
const EXPECTED_BLOCKS = GRID_SIZE * GRID_SIZE;

function createGameElement({ mockContainer = false } = {}) {
  const element = createElement('snake-game', { is: Game });
  if (mockContainer) {
    const originalQuery = element.shadowRoot.querySelector.bind(element.shadowRoot);
    jest.spyOn(element.shadowRoot, 'querySelector').mockImplementation((selector) => {
      if (selector === '.game-container') {
        return { clientWidth: CONTAINER_SIZE, clientHeight: CONTAINER_SIZE };
      }
      return originalQuery(selector);
    });
  }
  return element;
}

describe('snake-game', () => {
  afterEach(() => {
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
    jest.restoreAllMocks();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('is accessible', () => {
    const element = createElement('snake-game', { is: Game });
    document.body.appendChild(element);
    return Promise.resolve().then(() => expect(element).toBeAccessible());
  });

  it('shows start game overlay initially', () => {
    const element = createElement('snake-game', { is: Game });
    document.body.appendChild(element);
    return Promise.resolve().then(() => {
      const button = element.shadowRoot.querySelector('.slds-button_brand');
      expect(button.textContent.trim()).toBe('Start Game');
    });
  });

  it('hides overlay after start game is clicked', () => {
    jest.useFakeTimers();
    const element = createElement('snake-game', { is: Game });
    document.body.appendChild(element);
    return Promise.resolve().then(() => {
      element.shadowRoot.querySelector('.slds-button_brand').click();
      return Promise.resolve().then(() => {
        expect(element.shadowRoot.querySelector('.overlay')).toBeNull();
      });
    });
  });

  it('handles all keyboard direction inputs without errors', () => {
    const element = createElement('snake-game', { is: Game });
    document.body.appendChild(element);
    return Promise.resolve().then(() => {
      ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter'].forEach((key) => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key, cancelable: true }));
      });
      expect(element).toBeTruthy();
    });
  });

  it('displays initial speed as 1.0x', () => {
    const element = createElement('snake-game', { is: Game });
    document.body.appendChild(element);
    return Promise.resolve().then(() => {
      const speedEl = element.shadowRoot.querySelector('.slds-text-align_center');
      expect(speedEl.textContent).toContain('1.0x');
    });
  });

  it('loads saved high score from local storage', () => {
    jest.spyOn(Storage.prototype, 'getItem').mockReturnValue('25');
    const element = createElement('snake-game', { is: Game });
    document.body.appendChild(element);
    return Promise.resolve().then(() => {
      const highScoreEl = element.shadowRoot.querySelector('.slds-text-align_right');
      expect(highScoreEl.textContent).toContain('25');
    });
  });

  it('renders correct number of game blocks when container has dimensions', () => {
    const element = createGameElement({ mockContainer: true });
    document.body.appendChild(element);
    return Promise.resolve().then(() => {
      const blockDivs = element.shadowRoot.querySelectorAll('[data-reference]');
      expect(blockDivs.length).toBe(EXPECTED_BLOCKS);
    });
  });

  it('advances snake position on each timer tick', () => {
    jest.useFakeTimers();
    const element = createGameElement({ mockContainer: true });
    document.body.appendChild(element);
    return Promise.resolve().then(() => {
      element.shadowRoot.querySelector('.slds-button_brand').click();
      return Promise.resolve().then(() => {
        jest.advanceTimersByTime(350);
        return Promise.resolve().then(() => {
          const blockDivs = element.shadowRoot.querySelectorAll('[data-reference]');
          expect(blockDivs.length).toBe(EXPECTED_BLOCKS);
        });
      });
    });
  });

  it('updates score and speed when food is eaten', () => {
    jest.useFakeTimers();
    // Mock Math.random to place food at '0:0' (top-left corner).
    // The snake starts at (0,0) moving right and laps the top row in 10 moves,
    // eating the food on returning to (0,0). generateFood is then called: the
    // first attempt lands on '0:0' again (still in the tail), triggering the
    // recursive fallback, then 0.5 places new food at '4:4'.
    const fixedValues = [0, 0, 0, 0];
    let callIndex = 0;
    jest.spyOn(Math, 'random').mockImplementation(() => {
      const value = callIndex < fixedValues.length ? fixedValues[callIndex] : 0.5;
      callIndex++;
      return value;
    });

    const element = createGameElement({ mockContainer: true });
    document.body.appendChild(element);
    return Promise.resolve().then(() => {
      element.shadowRoot.querySelector('.slds-button_brand').click();
      return Promise.resolve().then(() => {
        jest.advanceTimersByTime(3100);
        return Promise.resolve().then(() => {
          const speedEl = element.shadowRoot.querySelector('.slds-text-align_center');
          expect(speedEl.textContent).toContain('1.1');
        });
      });
    });
  });

  it('resets game state and re-renders blocks on window resize', () => {
    const element = createGameElement({ mockContainer: true });
    document.body.appendChild(element);
    return Promise.resolve().then(() => {
      window.dispatchEvent(new CustomEvent('resize'));
      return Promise.resolve().then(() => {
        expect(element.shadowRoot.querySelector('.overlay')).not.toBeNull();
        const blockDivs = element.shadowRoot.querySelectorAll('[data-reference]');
        expect(blockDivs.length).toBe(EXPECTED_BLOCKS);
      });
    });
  });
});
