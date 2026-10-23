import { connectToHost, readHostMetaData, EMBEDDING_INFO, MESSAGES, METHODS, PROTOCOL_VERSION } from 'snake/embedding';

const HOST_ORIGIN = 'https://acme.my.salesforce.com';
const INSTANCE_ID = 'instance-1';
const META = { hostAppOrigin: HOST_ORIGIN, instanceId: INSTANCE_ID };

const searchFor = (meta) => `?hostMetaData=${encodeURIComponent(JSON.stringify(meta))}`;
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

/** A window framed by a host page: messages from the parent are dispatched on it. */
function createFramedWindow(search = searchFor(META)) {
  const win = new EventTarget();
  win.parent = { postMessage: jest.fn() };
  win.location = { search };
  return win;
}

class FakePort extends EventTarget {
  start = jest.fn();
  close = jest.fn();
  postMessage = jest.fn();

  /** Frames the guest has sent, in order. */
  get sent() {
    return this.postMessage.mock.calls.map(([frame]) => frame);
  }

  receive(data) {
    this.dispatchEvent(Object.assign(new CustomEvent('message'), { data }));
  }
}

const envelope = (overrides = {}) => ({
  type: MESSAGES.BOOTSTRAP,
  protocol: 'sf-embedding',
  instanceId: INSTANCE_ID,
  allowedOrigins: [HOST_ORIGIN],
  ...overrides
});

function sendBootstrap(win, { data = envelope(), origin = HOST_ORIGIN, source = win.parent, ports } = {}) {
  const port = new FakePort();
  win.dispatchEvent(Object.assign(new CustomEvent('message'), { data, origin, source, ports: ports ?? [port] }));
  return port;
}

const hostInitialized = (port) =>
  port.receive({
    jsonrpc: '2.0',
    method: METHODS.HOST_INITIALIZED,
    params: { instanceId: INSTANCE_ID, hostInfo: { name: 'host', version: '1' } }
  });

const uiState = (props) => ({ current: { props, styles: {} } });

/** Runs the handshake up to the ui-state subscription and answers it with `props`. */
async function connect({ onProps, target } = {}) {
  const win = createFramedWindow();
  const host = connectToHost({ win, onProps, target });
  const port = sendBootstrap(win);
  hostInitialized(port);
  const subscribe = port.sent.find((frame) => frame.method === METHODS.UI_STATE_SUBSCRIBE);
  port.receive({
    jsonrpc: '2.0',
    id: subscribe.id,
    result: { subscriptionId: 'sub-1', ...uiState({ game: 'snake' }) }
  });
  await flush();
  return { win, host, port };
}

describe('snake-embedding', () => {
  afterEach(() => {
    delete global.ResizeObserver;
  });

  describe('readHostMetaData', () => {
    it('reads the instance id and the origin of the host', () => {
      expect(readHostMetaData(searchFor(META))).toEqual(META);
    });

    it('rejects missing, malformed and incomplete metadata', () => {
      expect(readHostMetaData('')).toBeNull();
      expect(readHostMetaData('?hostMetaData=%7Bnope')).toBeNull();
      expect(readHostMetaData(searchFor({ hostAppOrigin: HOST_ORIGIN }))).toBeNull();
      expect(readHostMetaData(searchFor({ instanceId: INSTANCE_ID, hostAppOrigin: '' }))).toBeNull();
    });

    it('only accepts a bare origin for the host', () => {
      expect(readHostMetaData(searchFor({ ...META, hostAppOrigin: `${HOST_ORIGIN}/lightning` }))).toBeNull();
      expect(readHostMetaData(searchFor({ ...META, hostAppOrigin: 'not a url' }))).toBeNull();
    });
  });

  describe('connectToHost', () => {
    it('stays standalone when the page is not framed', () => {
      expect(connectToHost()).toBeNull();
      const win = createFramedWindow();
      win.parent = win;
      expect(connectToHost({ win })).toBeNull();
    });

    it('stays standalone when the frame has no host metadata', () => {
      const win = createFramedWindow('?game=snake');
      expect(connectToHost({ win })).toBeNull();
      expect(win.parent.postMessage).not.toHaveBeenCalled();
    });

    it('sends the heartbeat to the origin of the host only', () => {
      const win = createFramedWindow();
      connectToHost({ win });
      expect(win.parent.postMessage).toHaveBeenCalledWith(
        { type: MESSAGES.HEARTBEAT, instanceId: INSTANCE_ID, protocolVersion: PROTOCOL_VERSION },
        HOST_ORIGIN
      );
    });

    it.each([
      ['another origin', { origin: 'https://evil.example.com' }],
      ['another window', { source: {} }],
      ['another instance', { data: envelope({ instanceId: 'instance-2' }) }],
      ['another protocol', { data: envelope({ protocol: 'other' }) }],
      ['another message', { data: 'sf-embedding.bootstrap' }],
      ['no port', { ports: [] }],
      ['two ports', { ports: [new FakePort(), new FakePort()] }]
    ])('ignores a bootstrap envelope from %s', (name, overrides) => {
      const win = createFramedWindow();
      connectToHost({ win });
      const port = sendBootstrap(win, overrides);
      expect(port.start).not.toHaveBeenCalled();
    });

    it('starts the port of a valid envelope and waits for the host to initialize', () => {
      const win = createFramedWindow();
      connectToHost({ win });
      const port = sendBootstrap(win);
      expect(port.start).toHaveBeenCalled();
      expect(port.postMessage).not.toHaveBeenCalled();
    });

    it('shuts down when a second valid envelope arrives', () => {
      const win = createFramedWindow();
      connectToHost({ win });
      const first = sendBootstrap(win);
      const second = sendBootstrap(win);
      expect(win.parent.postMessage).toHaveBeenLastCalledWith(
        { type: MESSAGES.SHUTDOWN, reason: 'DUPLICATE_PORT_TRANSFER' },
        HOST_ORIGIN
      );
      expect(first.close).toHaveBeenCalled();
      expect(second.start).not.toHaveBeenCalled();
    });
  });

  describe('session', () => {
    it('answers host-initialized and subscribes to the props of the host', async () => {
      const onProps = jest.fn();
      const { port } = await connect({ onProps });
      const [initialized, subscribe] = port.sent;
      expect(initialized).toEqual({
        jsonrpc: '2.0',
        method: METHODS.EMBEDDING_INITIALIZED,
        params: { embeddingInfo: EMBEDDING_INFO }
      });
      expect(subscribe).toEqual({ jsonrpc: '2.0', id: 0, method: METHODS.UI_STATE_SUBSCRIBE, params: {} });
      expect(onProps).toHaveBeenCalledWith({ game: 'snake' });
    });

    it('initializes only once', async () => {
      const { port } = await connect();
      const count = port.postMessage.mock.calls.length;
      hostInitialized(port);
      expect(port.postMessage).toHaveBeenCalledTimes(count);
    });

    it('passes every props snapshot pushed by the host on', async () => {
      const onProps = jest.fn();
      const { port } = await connect({ onProps });
      port.receive({
        jsonrpc: '2.0',
        method: METHODS.UI_STATE_CHANGED,
        params: { subscriptionId: 'sub-1', ...uiState({ recordId: '001' }) }
      });
      expect(onProps).toHaveBeenLastCalledWith({ recordId: '001' });
    });

    it('keeps running when the subscription fails', async () => {
      const onProps = jest.fn();
      const win = createFramedWindow();
      const host = connectToHost({ win, onProps });
      const port = sendBootstrap(win);
      hostInitialized(port);
      port.receive({ jsonrpc: '2.0', id: 0, error: { code: -32012, message: 'not initialized' } });
      await flush();
      expect(onProps).not.toHaveBeenCalled();
      host.dispatch('gameover', { score: 1 });
      expect(port.sent.at(-1).method).toBe(METHODS.EVENTS_DISPATCH);
    });

    it('dispatches events to the host', async () => {
      const { host, port } = await connect();
      host.dispatch('gameover', { score: 7 });
      expect(port.sent.at(-1)).toEqual({
        jsonrpc: '2.0',
        method: METHODS.EVENTS_DISPATCH,
        params: { eventType: 'gameover', detail: { score: 7 }, bubbles: true, composed: true }
      });
    });

    it('holds events back until the host has initialized', () => {
      const win = createFramedWindow();
      const host = connectToHost({ win });
      host.dispatch('gameover', { score: 3 });
      const port = sendBootstrap(win);
      expect(port.postMessage).not.toHaveBeenCalled();
      hostInitialized(port);
      expect(port.sent.map((frame) => frame.method)).toEqual([
        METHODS.EMBEDDING_INITIALIZED,
        METHODS.EVENTS_DISPATCH,
        METHODS.UI_STATE_SUBSCRIBE
      ]);
    });

    it('rejects requests from the host it does not serve and ignores other messages', async () => {
      const { port } = await connect();
      const count = port.postMessage.mock.calls.length;
      port.receive('noise');
      port.receive({ jsonrpc: '2.0', id: 99, result: {} });
      port.receive({ jsonrpc: '2.0', method: 'ui/notifications/unknown' });
      expect(port.postMessage).toHaveBeenCalledTimes(count);
      port.receive({ jsonrpc: '2.0', id: 5, method: 'ui/get-something', _meta: { traceId: 't-1' } });
      expect(port.sent.at(-1)).toEqual({
        jsonrpc: '2.0',
        id: 5,
        error: { code: -32601, message: 'Method not found: ui/get-something' },
        _meta: { traceId: 't-1' }
      });
    });

    it('reports changes of the height of the target', async () => {
      const observe = jest.fn();
      const disconnect = jest.fn();
      let report;
      global.ResizeObserver = class {
        constructor(callback) {
          report = (height) => callback([{ borderBoxSize: [{ blockSize: height }], contentRect: { height } }]);
        }
        observe = observe;
        disconnect = disconnect;
      };
      const target = document.createElement('div');
      const { host, port } = await connect({ target });
      expect(observe).toHaveBeenCalledWith(target, { box: 'border-box' });

      report(640.2);
      report(641);
      const resizes = () => port.sent.filter((frame) => frame.method === METHODS.RESIZE).map((frame) => frame.params);
      expect(resizes()).toEqual([{ height: 641 }]);
      report(700);
      expect(resizes()).toEqual([{ height: 641 }, { height: 700 }]);

      host.dispose();
      expect(disconnect).toHaveBeenCalled();
    });

    it('closes the port and stops listening when disposed', async () => {
      const { win, host, port } = await connect();
      host.dispose();
      expect(port.close).toHaveBeenCalled();
      const next = sendBootstrap(win);
      expect(next.start).not.toHaveBeenCalled();
      host.dispatch('gameover', { score: 1 });
      expect(port.sent.at(-1).method).toBe(METHODS.UI_STATE_SUBSCRIBE);
    });

    it('fails pending requests when disposed', () => {
      const win = createFramedWindow();
      const host = connectToHost({ win });
      const port = sendBootstrap(win);
      const pending = host.request('ui/anything', {});
      host.dispose();
      expect(port.close).toHaveBeenCalled();
      return expect(pending).rejects.toThrow('sf-embedding session closed');
    });
  });
});
