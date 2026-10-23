import { createElement } from 'lwc';
import Game, { HIGH_SCORE_KEY } from 'snake/game';

function createGame() {
  const element = createElement('snake-game', { is: Game });
  document.body.appendChild(element);
  return element;
}

const flush = () => Promise.resolve();
const query = (element, selector) => element.shadowRoot.querySelector(selector);
const text = (element, selector) => query(element, selector)?.textContent.trim();
const headStyle = (element) => query(element, '.head').getAttribute('style');
const tick = (count = 1) => {
  for (let i = 0; i < count; i++) {
    jest.advanceTimersToNextTimer();
  }
};

describe('snake-game', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    localStorage.clear();
  });

  afterEach(() => {
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
    jest.restoreAllMocks();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('is accessible', async () => {
    // sa11y refuses to run with fake timers.
    jest.useRealTimers();
    const element = createGame();
    await flush();
    await expect(element).toBeAccessible();
  });

  it('shows the start screen with a snake of three segments and food', async () => {
    const element = createGame();
    await flush();
    expect(text(element, '.message-title')).toBe('SNAKE');
    expect(text(element, '.soft-labels span')).toBe('Start');
    expect(element.shadowRoot.querySelectorAll('.snake')).toHaveLength(3);
    expect(query(element, '.food')).not.toBeNull();
    expect(text(element, '.score')).toBe('0000');
    expect(text(element, '.speed')).toBe('x1.0');
  });

  it('starts on select and moves the snake on every tick', async () => {
    const element = createGame();
    element.press('select');
    await flush();
    expect(query(element, '.message')).toBeNull();
    expect(headStyle(element)).toContain('grid-column: 3');
    tick();
    await flush();
    expect(headStyle(element)).toContain('grid-column: 4');
  });

  it('starts when a direction is pressed on the start screen', async () => {
    const element = createGame();
    element.press('up');
    await flush();
    expect(query(element, '.message')).toBeNull();
    tick();
    await flush();
    expect(query(element, '.head').className).toContain('head-up');
  });

  it('pauses and resumes', async () => {
    const element = createGame();
    element.press('select');
    element.press('select');
    await flush();
    expect(text(element, '.message-title')).toBe('PAUSED');
    jest.advanceTimersByTime(1000);
    await flush();
    expect(headStyle(element)).toContain('grid-column: 3');
    element.press('select');
    await flush();
    expect(query(element, '.message')).toBeNull();
  });

  it('pauses on back while playing and returns to the start screen on a second back', async () => {
    const element = createGame();
    element.press('select');
    element.press('back');
    await flush();
    expect(text(element, '.message-title')).toBe('PAUSED');
    element.press('back');
    await flush();
    expect(text(element, '.message-title')).toBe('SNAKE');
  });

  it('pauses when the page is hidden', async () => {
    const element = createGame();
    element.press('select');
    jest.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    document.dispatchEvent(new CustomEvent('visibilitychange'));
    await flush();
    expect(text(element, '.message-title')).toBe('PAUSED');
  });

  it('scores, saves the high score and ends the game when the snake bites itself', async () => {
    // Food always lands on the first free cell: (0,0) at the start, then (3,0).
    jest.spyOn(Math, 'random').mockReturnValue(0);
    const element = createGame();
    element.press('select');
    element.press('up');
    tick(6);
    element.press('left');
    tick(2);
    await flush();
    expect(text(element, '.score')).toBe('0001');
    expect(text(element, '.speed')).toBe('x1.1');
    expect(localStorage.getItem(HIGH_SCORE_KEY)).toBe('1');

    element.press('down');
    tick();
    element.press('right');
    tick(3);
    element.press('up');
    tick();
    element.press('left');
    tick();
    element.press('down');
    tick();
    await flush();
    expect(text(element, '.message-title')).toBe('GAME OVER');
    expect(text(element, '.message-score')).toContain('Score 2');
    expect(text(element, '.message-score')).toContain('New record!');
    expect(text(element, '.soft-labels span')).toBe('Again');

    element.press('select');
    await flush();
    expect(query(element, '.message')).toBeNull();
    expect(text(element, '.score')).toBe('0000');
    expect(text(element, '.high-score')).toBe('HI 0002');
  });

  describe('end of a round', () => {
    // The moves of the high score test: two pieces of food, then the snake bites itself.
    // 8 ticks at x1.0 (260ms), 5 at x1.1 (236ms) and 2 at x1.2 (217ms) - 3.7 seconds of play.
    const playRound = (element) => {
      element.press('up');
      tick(6);
      element.press('left');
      tick(2);
      element.press('down');
      tick();
      element.press('right');
      tick(3);
      element.press('up');
      tick();
      element.press('left');
      tick();
      element.press('down');
      tick();
    };

    function createListenedGame() {
      jest.spyOn(Math, 'random').mockReturnValue(0);
      const element = createGame();
      const handler = jest.fn();
      element.addEventListener('gameover', handler);
      return { element, handler };
    }

    it('reports score, level and the time played without pauses', async () => {
      const { element, handler } = createListenedGame();
      element.press('select');
      element.press('select');
      jest.advanceTimersByTime(60000);
      element.press('select');
      playRound(element);
      await flush();
      expect(text(element, '.message-title')).toBe('GAME OVER');
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler.mock.calls[0][0].detail).toEqual({ score: 2, level: 1, durationSeconds: 4 });
    });

    it('counts the time of the next round from zero', () => {
      const { element, handler } = createListenedGame();
      element.press('select');
      playRound(element);
      element.press('select');
      playRound(element);
      expect(handler).toHaveBeenCalledTimes(2);
      expect(handler.mock.calls[1][0].detail.durationSeconds).toBe(4);
    });

    it('does not report a round that is left before it is over', () => {
      const { element, handler } = createListenedGame();
      element.press('select');
      tick(3);
      element.press('back');
      element.press('back');
      expect(handler).not.toHaveBeenCalled();
    });
  });

  it('loads the saved high score', async () => {
    localStorage.setItem(HIGH_SCORE_KEY, '25');
    const element = createGame();
    await flush();
    expect(text(element, '.high-score')).toBe('HI 0025');
  });

  it('works without local storage', async () => {
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const element = createGame();
    await flush();
    expect(text(element, '.high-score')).toBe('HI 0000');
  });

  it('steers with swipes and toggles pause with a tap on the screen', async () => {
    const element = createGame();
    const field = query(element, '.field');
    const swipe = (from, to) => {
      field.dispatchEvent(Object.assign(new CustomEvent('pointerdown'), { clientX: from[0], clientY: from[1] }));
      field.dispatchEvent(Object.assign(new CustomEvent('pointerup'), { clientX: to[0], clientY: to[1] }));
    };
    swipe([0, 0], [5, 5]);
    await flush();
    expect(query(element, '.message')).toBeNull();
    swipe([0, 0], [0, -50]);
    tick();
    await flush();
    expect(query(element, '.head').className).toContain('head-up');
    swipe([0, 0], [-50, 10]);
    tick();
    await flush();
    expect(query(element, '.head').className).toContain('head-left');
  });

  it('ignores unknown actions', async () => {
    const element = createGame();
    element.press('fly');
    await flush();
    expect(text(element, '.message-title')).toBe('SNAKE');
  });
});
