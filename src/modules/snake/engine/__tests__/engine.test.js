import { COLS, ROWS, STATUS, createGame, placeFood, step, tickDelay, turn, withStatus } from 'snake/engine';

const playing = (overrides = {}) => ({ ...withStatus(createGame({ random: () => 0 }), STATUS.PLAYING), ...overrides });

describe('snake-engine', () => {
  describe('createGame', () => {
    it('creates a snake of three segments in the middle row heading right', () => {
      const state = createGame();
      expect(state.cols).toBe(COLS);
      expect(state.rows).toBe(ROWS);
      expect(state.snake).toEqual([
        { x: 2, y: 6 },
        { x: 1, y: 6 },
        { x: 0, y: 6 }
      ]);
      expect(state.direction).toBe('right');
      expect(state.status).toBe(STATUS.READY);
      expect(state.score).toBe(0);
      expect(state.speed).toBe(1);
    });

    it('never places the initial food on the snake', () => {
      const state = createGame({ cols: 4, rows: 1 });
      expect(state.food).toEqual({ x: 3, y: 0 });
    });
  });

  describe('placeFood', () => {
    it('can place food on every free cell including the last row and column', () => {
      expect(placeFood([], 3, 2, () => 0.99)).toEqual({ x: 2, y: 1 });
      expect(placeFood([], 3, 2, () => 0)).toEqual({ x: 0, y: 0 });
    });

    it('returns null when the board is full', () => {
      expect(placeFood([{ x: 0, y: 0 }], 1, 1)).toBeNull();
    });
  });

  describe('turn', () => {
    it('queues a valid turn', () => {
      expect(turn(playing(), 'up').queue).toEqual(['up']);
    });

    it('ignores reversing into the snake and repeating the current direction', () => {
      const state = playing();
      expect(turn(state, 'left')).toBe(state);
      expect(turn(state, 'right')).toBe(state);
    });

    it('validates a turn against the last queued direction', () => {
      const state = turn(playing(), 'up');
      expect(turn(state, 'down')).toBe(state);
      expect(turn(state, 'left').queue).toEqual(['up', 'left']);
    });

    it('buffers at most two turns and ignores unknown directions', () => {
      const state = turn(turn(playing(), 'up'), 'left');
      expect(turn(state, 'down')).toBe(state);
      expect(turn(playing(), 'sideways').queue).toEqual([]);
    });
  });

  describe('step', () => {
    it('does nothing unless the game is running', () => {
      const state = createGame();
      expect(step(state)).toBe(state);
    });

    it('moves the snake one cell in its direction', () => {
      const next = step(playing({ food: null }));
      expect(next.snake).toEqual([
        { x: 3, y: 6 },
        { x: 2, y: 6 },
        { x: 1, y: 6 }
      ]);
    });

    it('applies queued turns one per tick', () => {
      const state = turn(turn(playing({ food: null }), 'up'), 'left');
      const first = step(state);
      expect(first.direction).toBe('up');
      expect(first.snake[0]).toEqual({ x: 2, y: 5 });
      const second = step(first);
      expect(second.direction).toBe('left');
      expect(second.snake[0]).toEqual({ x: 1, y: 5 });
      expect(second.queue).toEqual([]);
    });

    it('wraps around the edges of the board', () => {
      const state = playing({ food: null, snake: [{ x: COLS - 1, y: 0 }], direction: 'right' });
      expect(step(state).snake[0]).toEqual({ x: 0, y: 0 });
      const up = playing({ food: null, snake: [{ x: 4, y: 0 }], direction: 'up' });
      expect(step(up).snake[0]).toEqual({ x: 4, y: ROWS - 1 });
    });

    it('grows, scores and speeds up when eating food', () => {
      const next = step(playing({ food: { x: 3, y: 6 } }), () => 0);
      expect(next.snake).toHaveLength(4);
      expect(next.score).toBe(1);
      expect(next.speed).toBe(1.1);
      expect(next.food).not.toBeNull();
      expect(next.snake).not.toContainEqual(next.food);
    });

    it('ends the game when the snake bites itself', () => {
      const snake = [
        { x: 2, y: 2 },
        { x: 3, y: 2 },
        { x: 3, y: 3 },
        { x: 2, y: 3 },
        { x: 1, y: 3 }
      ];
      const next = step(playing({ food: null, snake, direction: 'down' }));
      expect(next.status).toBe(STATUS.OVER);
      expect(next.snake).toBe(snake);
    });

    it('lets the head move into the cell the tail leaves in the same tick', () => {
      const snake = [
        { x: 1, y: 1 },
        { x: 2, y: 1 },
        { x: 2, y: 2 },
        { x: 1, y: 2 }
      ];
      const next = step(playing({ food: null, snake, direction: 'down' }));
      expect(next.status).toBe(STATUS.PLAYING);
      expect(next.snake[0]).toEqual({ x: 1, y: 2 });
    });

    it('is won when the snake fills the whole board', () => {
      const state = playing({
        cols: 3,
        rows: 1,
        snake: [
          { x: 1, y: 0 },
          { x: 0, y: 0 }
        ],
        food: { x: 2, y: 0 }
      });
      expect(step(state).status).toBe(STATUS.WON);
    });
  });

  describe('tickDelay', () => {
    it('gets shorter with speed but never below the minimum', () => {
      expect(tickDelay(1)).toBe(260);
      expect(tickDelay(2)).toBe(130);
      expect(tickDelay(100)).toBe(70);
    });
  });
});
