import { LightningElement, api } from 'lwc';
import { createGame, step, tickDelay, turn, withStatus, DIRECTIONS, STATUS } from 'snake/engine';

export const HIGH_SCORE_KEY = 'lwc_snake_highscore';
const SWIPE_THRESHOLD_PX = 24;

const MESSAGES = {
  [STATUS.READY]: { title: 'SNAKE', text: 'Press 5 to start', hint: 'Steer with 2 4 6 8 or swipe' },
  [STATUS.PAUSED]: { title: 'PAUSED', text: 'Press 5 to resume' },
  [STATUS.OVER]: { title: 'GAME OVER', text: 'Press 5 to play again' },
  [STATUS.WON]: { title: 'YOU WIN!', text: 'Press 5 to play again' }
};

const SELECT_LABELS = {
  [STATUS.READY]: 'Start',
  [STATUS.PLAYING]: 'Pause',
  [STATUS.PAUSED]: 'Resume',
  [STATUS.OVER]: 'Again',
  [STATUS.WON]: 'Again'
};

const cellStyle = ({ x, y }) => `grid-column: ${x + 1}; grid-row: ${y + 1};`;
const pad = (value) => String(value).padStart(4, '0');

function readHighScore() {
  try {
    return parseInt(localStorage.getItem(HIGH_SCORE_KEY), 10) || 0;
  } catch {
    return 0;
  }
}

function writeHighScore(value) {
  try {
    localStorage.setItem(HIGH_SCORE_KEY, String(value));
  } catch {
    // Storage can be unavailable (private mode, blocked site data) - the game works without it.
  }
}

/**
 * The LCD of the phone: owns the game loop, renders the engine state and
 * reacts to the abstract actions up/down/left/right/select/back.
 */
export default class Game extends LightningElement {
  state = createGame();
  highScore = 0;
  newHighScore = false;
  announcement = '';

  timer;
  pointerStart;
  handleVisibilityChange = () => {
    if (document.hidden && this.state.status === STATUS.PLAYING) {
      this.setState(withStatus(this.state, STATUS.PAUSED));
    }
  };

  connectedCallback() {
    this.highScore = readHighScore();
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
  }

  disconnectedCallback() {
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    clearTimeout(this.timer);
  }

  /** Entry point for all controls (phone keys, keyboard, swipes). */
  @api
  press(action) {
    if (DIRECTIONS[action]) {
      this.steer(action);
    } else if (action === 'select') {
      this.select();
    } else if (action === 'back') {
      this.back();
    }
  }

  steer(direction) {
    const { status } = this.state;
    if (status === STATUS.PLAYING) {
      this.state = turn(this.state, direction);
    } else if (status === STATUS.READY || status === STATUS.PAUSED) {
      this.setState(withStatus(turn(this.state, direction), STATUS.PLAYING));
    }
  }

  select() {
    switch (this.state.status) {
      case STATUS.READY:
      case STATUS.PAUSED:
        this.setState(withStatus(this.state, STATUS.PLAYING));
        break;
      case STATUS.PLAYING:
        this.setState(withStatus(this.state, STATUS.PAUSED));
        break;
      default:
        this.newHighScore = false;
        this.setState(withStatus(createGame(), STATUS.PLAYING));
    }
  }

  back() {
    const { status } = this.state;
    if (status === STATUS.PLAYING) {
      this.setState(withStatus(this.state, STATUS.PAUSED));
    } else if (status !== STATUS.READY) {
      this.newHighScore = false;
      this.setState(createGame());
    }
  }

  tick() {
    this.setState(step(this.state));
  }

  setState(next) {
    const previous = this.state;
    this.state = next;
    if (next.score > this.highScore) {
      this.highScore = next.score;
      this.newHighScore = true;
      writeHighScore(next.score);
    }
    if (next.status !== previous.status) {
      this.announce();
    }
    this.scheduleTick();
  }

  scheduleTick() {
    clearTimeout(this.timer);
    if (this.state.status === STATUS.PLAYING) {
      this.timer = setTimeout(() => this.tick(), tickDelay(this.state.speed));
    }
  }

  announce() {
    const { status, score } = this.state;
    const message = MESSAGES[status];
    this.announcement = message ? `${message.title}. Score ${score}. ${message.text}.` : 'Game running.';
  }

  handlePointerDown(event) {
    this.pointerStart = { x: event.clientX, y: event.clientY };
  }

  handlePointerUp(event) {
    if (!this.pointerStart) {
      return;
    }
    const dx = event.clientX - this.pointerStart.x;
    const dy = event.clientY - this.pointerStart.y;
    this.pointerStart = undefined;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_THRESHOLD_PX) {
      this.press('select');
    } else if (Math.abs(dx) > Math.abs(dy)) {
      this.press(dx > 0 ? 'right' : 'left');
    } else {
      this.press(dy > 0 ? 'down' : 'up');
    }
  }

  handlePointerCancel() {
    this.pointerStart = undefined;
  }

  get segments() {
    const { snake, direction } = this.state;
    return snake.map((segment, index) => ({
      key: `${segment.x}:${segment.y}`,
      className: index === 0 ? `cell snake head head-${direction}` : 'cell snake',
      style: cellStyle(segment)
    }));
  }

  get food() {
    const { food } = this.state;
    return food ? { style: cellStyle(food) } : null;
  }

  get message() {
    return MESSAGES[this.state.status];
  }

  get isGameOver() {
    return this.state.status === STATUS.OVER || this.state.status === STATUS.WON;
  }

  get lcdClass() {
    return `lcd lcd-${this.state.status}`;
  }

  get score() {
    return pad(this.state.score);
  }

  get highScoreLabel() {
    return pad(this.highScore);
  }

  get displaySpeed() {
    return this.state.speed.toFixed(1);
  }

  get selectLabel() {
    return SELECT_LABELS[this.state.status];
  }

  get backLabel() {
    return this.state.status === STATUS.READY ? '' : 'Back';
  }
}
