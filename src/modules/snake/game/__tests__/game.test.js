import { createElement } from 'lwc';
import Game from 'snake/game';

describe('snake-game', () => {
  afterEach(() => {
    // The jsdom instance is shared across test cases in a single file so reset the DOM
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
  });

  it('is accessible', () => {
    const element = createElement('snake-game', {
      is: Game
    });
    document.body.appendChild(element);

    return Promise.resolve().then(() => expect(element).toBeAccessible());
  });
});
