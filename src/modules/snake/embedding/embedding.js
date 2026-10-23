/**
 * Guest side of the sf-embedding protocol, for a Salesforce page that frames
 * the game with <lightning-ui-embedding>. LWR cannot resolve the
 * @salesforce/platform-sdk package, so this is the package-free bridge:
 *
 *   1. The host appends `hostMetaData` ({ hostAppOrigin, instanceId }) to the URL.
 *   2. guest -> host  window message `sf-embedding/ready` (heartbeat)
 *   3. host -> guest  window message `sf-embedding.bootstrap` carrying a MessagePort
 *   4. JSON-RPC 2.0 over that port: host-initialized, embedding-initialized,
 *      the ui-state subscription (host props), custom events and resize hints.
 *
 * Spec: https://developer.salesforce.com/docs/platform/microfrontend/guide/package-free-bridge.html
 */

export const PROTOCOL_VERSION = '1.0.0';
export const EMBEDDING_INFO = Object.freeze({ name: 'lwc-oss-snake-game', version: '1.0.0' });

export const MESSAGES = Object.freeze({
  HEARTBEAT: 'sf-embedding/ready',
  BOOTSTRAP: 'sf-embedding.bootstrap',
  SHUTDOWN: 'sf-embedding/shutdown'
});

export const METHODS = Object.freeze({
  HOST_INITIALIZED: 'ui/notifications/host-initialized',
  EMBEDDING_INITIALIZED: 'ui/notifications/embedding-initialized',
  UI_STATE_SUBSCRIBE: 'ui/subscribe/ui-state',
  UI_STATE_CHANGED: 'ui/notifications/ui-state-changed',
  EVENTS_DISPATCH: 'ui/events/dispatch',
  RESIZE: 'ui/notifications/resize'
});

const PROTOCOL_NAME = 'sf-embedding';
const METHOD_NOT_FOUND = -32601;

/**
 * Parses the JSON-encoded `hostMetaData` query parameter. Returns null on any
 * malformed input, so a half-valid URL never starts a handshake.
 */
export function readHostMetaData(search) {
  let meta;
  try {
    meta = JSON.parse(new URLSearchParams(search).get('hostMetaData'));
  } catch {
    return null;
  }
  const { instanceId, hostAppOrigin } = meta ?? {};
  if (typeof instanceId !== 'string' || !instanceId || typeof hostAppOrigin !== 'string') {
    return null;
  }
  // hostAppOrigin is the postMessage target and the only trusted sender - it has to be a bare origin.
  try {
    return new URL(hostAppOrigin).origin === hostAppOrigin ? { instanceId, hostAppOrigin } : null;
  } catch {
    return null;
  }
}

function isBootstrapEnvelope(event, meta, win) {
  const { data } = event;
  return (
    data?.type === MESSAGES.BOOTSTRAP &&
    data.protocol === PROTOCOL_NAME &&
    data.instanceId === meta.instanceId &&
    event.origin === meta.hostAppOrigin &&
    event.source === win.parent &&
    event.ports?.length === 1
  );
}

function measureHeight(entry) {
  const box = Array.isArray(entry.borderBoxSize) ? entry.borderBoxSize[0] : entry.borderBoxSize;
  return Math.ceil(box?.blockSize ?? entry.contentRect.height);
}

/** One session with the host page. Created by `connectToHost`. */
class HostConnection {
  port = null;
  ready = false;
  nextId = 0;
  pending = new Map();
  queuedEvents = [];
  observer;
  lastHeight;

  constructor(win, meta, { target, onProps }) {
    this.win = win;
    this.meta = meta;
    this.target = target;
    this.onProps = onProps;
    // The listener has to be in place before the heartbeat - the host answers right away.
    win.addEventListener('message', this.handleWindowMessage);
    this.postToParent({ type: MESSAGES.HEARTBEAT, instanceId: meta.instanceId, protocolVersion: PROTOCOL_VERSION });
  }

  /** Sends a custom event to the host. Events raised before the handshake is done are sent once it is. */
  dispatch(eventType, detail) {
    const params = { eventType, detail, bubbles: true, composed: true };
    if (this.ready) {
      this.notify(METHODS.EVENTS_DISPATCH, params);
    } else {
      this.queuedEvents.push(params);
    }
  }

  dispose() {
    this.win.removeEventListener('message', this.handleWindowMessage);
    this.observer?.disconnect();
    if (this.port) {
      this.port.removeEventListener('message', this.handlePortMessage);
      this.port.close();
    }
    this.pending.forEach(({ reject }) => reject(new Error('sf-embedding session closed')));
    this.pending.clear();
    this.port = null;
    this.ready = false;
  }

  handleWindowMessage = (event) => {
    if (!isBootstrapEnvelope(event, this.meta, this.win)) {
      return;
    }
    if (this.port) {
      // A second valid envelope: there is no telling which port is genuine, so fail closed.
      this.postToParent({ type: MESSAGES.SHUTDOWN, reason: 'DUPLICATE_PORT_TRANSFER' });
      this.dispose();
      return;
    }
    [this.port] = event.ports;
    this.port.addEventListener('message', this.handlePortMessage);
    this.port.start();
  };

  handlePortMessage = ({ data }) => {
    if (data?.jsonrpc !== '2.0') {
      return;
    }
    if (data.method === undefined) {
      this.settle(data);
    } else if (data.id !== undefined) {
      // The game serves no requests of its own.
      const error = { code: METHOD_NOT_FOUND, message: `Method not found: ${data.method}` };
      this.post({ jsonrpc: '2.0', id: data.id, error, ...(data._meta && { _meta: data._meta }) });
    } else if (data.method === METHODS.HOST_INITIALIZED) {
      this.initialize();
    } else if (data.method === METHODS.UI_STATE_CHANGED) {
      this.receiveUiState(data.params?.current);
    }
  };

  async initialize() {
    if (this.ready) {
      return;
    }
    this.ready = true;
    this.notify(METHODS.EMBEDDING_INITIALIZED, { embeddingInfo: EMBEDDING_INFO });
    this.queuedEvents.splice(0).forEach((params) => this.notify(METHODS.EVENTS_DISPATCH, params));
    this.observeSize();
    try {
      const { current } = await this.request(METHODS.UI_STATE_SUBSCRIBE, {});
      this.receiveUiState(current);
    } catch {
      // Best effort: without host props the game runs as it does standalone.
    }
  }

  receiveUiState(current) {
    if (current?.props && this.onProps) {
      this.onProps(current.props);
    }
  }

  /** Reports the height of the target element, so the host can size the frame to the game. */
  observeSize() {
    if (!this.target || typeof ResizeObserver === 'undefined') {
      return;
    }
    this.observer = new ResizeObserver(([entry]) => {
      const height = measureHeight(entry);
      if (height !== this.lastHeight) {
        this.lastHeight = height;
        this.notify(METHODS.RESIZE, { height });
      }
    });
    this.observer.observe(this.target, { box: 'border-box' });
  }

  request(method, params) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.post({ jsonrpc: '2.0', id, method, params });
    });
  }

  settle({ id, result, error }) {
    const request = this.pending.get(id);
    if (!request) {
      return;
    }
    this.pending.delete(id);
    if (error) {
      request.reject(Object.assign(new Error(error.message ?? `JSON-RPC error ${error.code}`), { code: error.code }));
    } else {
      request.resolve(result);
    }
  }

  notify(method, params) {
    this.post({ jsonrpc: '2.0', method, params });
  }

  post(frame) {
    try {
      this.port?.postMessage(frame);
    } catch {
      // A closed port drops the message - the host has gone away.
    }
  }

  postToParent(message) {
    try {
      this.win.parent.postMessage(message, this.meta.hostAppOrigin);
    } catch {
      // The parent may already be gone.
    }
  }
}

/**
 * Starts the handshake when the page is framed by a Salesforce host, otherwise
 * returns null and the game runs standalone.
 *
 * @param {object} [options]
 * @param {Element} [options.target] element whose height is reported to the host
 * @param {(props: object) => void} [options.onProps] called with every props snapshot of the host
 * @param {Window} [options.win] the window to connect (for tests)
 */
export function connectToHost({ target, onProps, win = window } = {}) {
  const meta = win.parent && win.parent !== win ? readHostMetaData(win.location.search) : null;
  return meta ? new HostConnection(win, meta, { target, onProps }) : null;
}
