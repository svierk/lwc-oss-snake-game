/**
 * Pure game logic of Snake - no DOM, no timers, no LWC. Every function takes a
 * state object and returns a new one, so the rules can be tested in isolation
 * and the UI only has to render whatever state it is given.
 */

export const COLS = 20;
export const ROWS = 12;

export const STATUS = Object.freeze({
  READY: 'ready',
  PLAYING: 'playing',
  PAUSED: 'paused',
  OVER: 'over',
  WON: 'won'
});

export const DIRECTIONS = Object.freeze({
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 }
});

const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };
const INITIAL_LENGTH = 3;
const MAX_QUEUED_TURNS = 2;
const BASE_TICK_MS = 260;
const MIN_TICK_MS = 70;
const SPEED_STEP = 0.1;

const samePosition = (a, b) => a.x === b.x && a.y === b.y;

/**
 * Places food on a random free cell. Picking from the list of free cells keeps
 * the distribution uniform and terminates even on an almost full board.
 */
export function placeFood(snake, cols, rows, random = Math.random) {
  const occupied = new Set(snake.map(({ x, y }) => `${x}:${y}`));
  const free = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (!occupied.has(`${x}:${y}`)) {
        free.push({ x, y });
      }
    }
  }
  return free.length ? free[Math.floor(random() * free.length)] : null;
}

export function createGame({ cols = COLS, rows = ROWS, random = Math.random } = {}) {
  const y = Math.floor(rows / 2);
  const snake = [];
  for (let i = 0; i < INITIAL_LENGTH; i++) {
    snake.push({ x: INITIAL_LENGTH - 1 - i, y });
  }
  return {
    cols,
    rows,
    snake,
    direction: 'right',
    queue: [],
    food: placeFood(snake, cols, rows, random),
    score: 0,
    speed: 1,
    status: STATUS.READY
  };
}

/**
 * Queues a change of direction for the next ticks. Turning back onto the snake
 * itself is ignored, and up to two turns are buffered so quick inputs like
 * "up, left" within a single tick are not lost.
 */
export function turn(state, direction) {
  if (!DIRECTIONS[direction] || state.queue.length >= MAX_QUEUED_TURNS) {
    return state;
  }
  const last = state.queue.length ? state.queue[state.queue.length - 1] : state.direction;
  if (direction === last || direction === OPPOSITE[last]) {
    return state;
  }
  return { ...state, queue: [...state.queue, direction] };
}

/** Advances the game by one tick. Walls wrap around, the snake itself is deadly. */
export function step(state, random = Math.random) {
  if (state.status !== STATUS.PLAYING) {
    return state;
  }
  const [direction = state.direction, ...queue] = state.queue;
  const { x: dx, y: dy } = DIRECTIONS[direction];
  const { cols, rows, snake, food } = state;
  const head = {
    x: (snake[0].x + dx + cols) % cols,
    y: (snake[0].y + dy + rows) % rows
  };
  const eats = food !== null && samePosition(head, food);
  // The tail moves out of the way in the same tick, unless the snake grows.
  const body = eats ? snake : snake.slice(0, -1);

  if (body.some((segment) => samePosition(segment, head))) {
    return { ...state, direction, queue, status: STATUS.OVER };
  }

  const nextSnake = [head, ...body];
  if (!eats) {
    return { ...state, direction, queue, snake: nextSnake };
  }
  const nextFood = placeFood(nextSnake, cols, rows, random);
  return {
    ...state,
    direction,
    queue,
    snake: nextSnake,
    food: nextFood,
    score: state.score + 1,
    speed: Math.round((state.speed + SPEED_STEP) * 10) / 10,
    status: nextFood ? STATUS.PLAYING : STATUS.WON
  };
}

export function withStatus(state, status) {
  return { ...state, status };
}

/** Milliseconds between two ticks for the given speed factor. */
export function tickDelay(speed) {
  return Math.max(MIN_TICK_MS, Math.round(BASE_TICK_MS / speed));
}
