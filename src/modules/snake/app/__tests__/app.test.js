import { createElement } from 'lwc';
import App from 'snake/app';

describe('snake-app', () => {
  afterEach(() => {
    // The jsdom instance is shared across test cases in a single file so reset the DOM
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
  });

  it('is accessible', () => {
    const element = createElement('snake-app', {
      is: App
    });
    document.body.appendChild(element);

    return Promise.resolve().then(() => expect(element).toBeAccessible());
  });
});
