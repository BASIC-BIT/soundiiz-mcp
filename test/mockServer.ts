import http from 'node:http';
import type { AddressInfo } from 'node:net';

export interface MockSync {
  id: number;
  type: string;
  title: string;
  source: { type: string; serviceName: string; id: string; url: string };
  destination: { type: string; serviceName: string; id: string; url: string };
  method: 'add' | 'replace';
  frequency: 'daily' | 'weekly' | 'monthly';
  lastExecutionDate: number | null;
  nextExecutionDate: number | null;
  scheduled: boolean;
  status: 'processing' | 'pending' | 'idle';
  lastExecutionResult?: {
    status: 'pending' | 'processing' | 'success' | 'error' | null;
    error: string | null;
    startDate: number | null;
    endDate: number | null;
    score: number | string | null;
    nbTrackSource: number | null;
    nbTrackDestination: number | null;
  } | null;
}

export interface MockSmartlink {
  id: number;
  type: string;
  subDomain: string | null;
  shortcode: string;
  category: 'playlist' | 'album' | 'track' | 'artist';
  fallback: string;
  title: string;
  artist: string;
  description: string | null;
  addedDate: number;
  updatedDate: number;
  links: { id: number; type: string; platform: string; url: string }[];
  status: 'draft' | 'published';
}

export interface MockState {
  authToken: string;
  syncs: MockSync[];
  smartlinks: MockSmartlink[];
  triggers: number[];
}

export interface MockServerHandle {
  url: string;
  state: MockState;
  close: () => Promise<void>;
}

const TOKEN = 'test-token-123';

function defaultState(): MockState {
  return {
    authToken: TOKEN,
    syncs: [
      {
        id: 1,
        type: 'sync',
        title: 'Daily Discover',
        source: {
          type: 'playlist',
          serviceName: 'spotify',
          id: 'sp1',
          url: 'https://open.spotify.com/playlist/sp1',
        },
        destination: {
          type: 'playlist',
          serviceName: 'deezer',
          id: 'dz1',
          url: 'https://www.deezer.com/playlist/dz1',
        },
        method: 'add',
        frequency: 'daily',
        lastExecutionDate: 1710000000,
        nextExecutionDate: Math.floor(Date.now() / 1000) + 3600,
        scheduled: true,
        status: 'idle',
        lastExecutionResult: {
          status: 'success',
          error: null,
          startDate: 1710000000,
          endDate: 1710000060,
          score: 98,
          nbTrackSource: 30,
          nbTrackDestination: 30,
        },
      },
      {
        id: 2,
        type: 'sync',
        title: 'Workout Mix',
        source: {
          type: 'playlist',
          serviceName: 'spotify',
          id: 'sp2',
          url: 'https://open.spotify.com/playlist/sp2',
        },
        destination: {
          type: 'playlist',
          serviceName: 'tidal',
          id: 'tl1',
          url: 'https://tidal.com/playlist/tl1',
        },
        method: 'replace',
        frequency: 'weekly',
        lastExecutionDate: 1710100000,
        nextExecutionDate: Math.floor(Date.now() / 1000) + 86_400 * 6,
        scheduled: true,
        status: 'idle',
        lastExecutionResult: {
          status: 'error',
          error: 'PLATFORM_DISCONNECTED',
          startDate: 1710100000,
          endDate: 1710100020,
          score: 'NO_CHANGES',
          nbTrackSource: 50,
          nbTrackDestination: null,
        },
      },
    ],
    smartlinks: [
      {
        id: 101,
        type: 'smartlink',
        subDomain: null,
        shortcode: 'abc123',
        category: 'playlist',
        fallback: 'https://open.spotify.com/playlist/sp1',
        title: 'My Top Playlist',
        artist: 'Curator',
        description: null,
        addedDate: 1710000000,
        updatedDate: 1710500000,
        links: [
          { id: 1, type: 'link', platform: 'spotify', url: 'https://open.spotify.com/playlist/sp1' },
          { id: 2, type: 'link', platform: 'deezer', url: 'https://www.deezer.com/playlist/dz1' },
        ],
        status: 'published',
      },
    ],
    triggers: [],
  };
}

function paginate<T>(items: T[], offset: number, limit: number) {
  const slice = items.slice(offset, offset + limit);
  // Real Soundiiz API returns offset/limit as strings; total as number. Match it.
  return { items: slice, offset: String(offset), limit: String(limit), total: items.length };
}

function readJsonBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      const text = Buffer.concat(chunks).toString('utf8');
      try {
        resolve(text ? JSON.parse(text) : null);
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });
    req.on('error', reject);
  });
}

function send(res: http.ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(body));
}

function authOk(req: http.IncomingMessage, state: MockState): boolean {
  const auth = req.headers.authorization ?? '';
  return auth === `Bearer ${state.authToken}`;
}

function handleSyncsRoutes(
  url: URL,
  req: http.IncomingMessage,
  res: http.ServerResponse,
  state: MockState
): boolean {
  if (url.pathname === '/v1/me/syncs' && req.method === 'GET') {
    const offset = Number(url.searchParams.get('offset') ?? 0);
    const limit = Number(url.searchParams.get('limit') ?? 50);
    send(res, 200, { data: paginate(state.syncs, offset, limit) });
    return true;
  }
  const detailMatch = /^\/v1\/me\/syncs\/(\d+)$/.exec(url.pathname);
  if (detailMatch) {
    const id = Number(detailMatch[1]);
    const sync = state.syncs.find((s) => s.id === id);
    if (!sync) {
      send(res, 404, { data: { status: 'error', message: 'SYNC_NOT_FOUND' } });
      return true;
    }
    if (req.method === 'GET') {
      send(res, 200, { data: sync });
      return true;
    }
    if (req.method === 'DELETE') {
      state.syncs = state.syncs.filter((s) => s.id !== id);
      send(res, 200, { data: { status: 'accepted', message: 'SYNC_DELETED' } });
      return true;
    }
  }
  const triggerMatch = /^\/v1\/me\/syncs\/(\d+)\/trigger$/.exec(url.pathname);
  if (triggerMatch && req.method === 'POST') {
    const id = Number(triggerMatch[1]);
    const sync = state.syncs.find((s) => s.id === id);
    if (!sync) {
      send(res, 404, { data: { status: 'error', message: 'SYNC_NOT_FOUND' } });
      return true;
    }
    state.triggers.push(id);
    send(res, 202, { data: { status: 'accepted', message: 'SYNC_EXECUTION_ACCEPTED' } });
    return true;
  }
  return false;
}

function handleSmartlinksRoutes(
  url: URL,
  req: http.IncomingMessage,
  res: http.ServerResponse,
  state: MockState
): boolean {
  if (url.pathname === '/v1/me/smartlinks' && req.method === 'GET') {
    const offset = Number(url.searchParams.get('offset') ?? 0);
    const limit = Number(url.searchParams.get('limit') ?? 50);
    send(res, 200, { data: paginate(state.smartlinks, offset, limit) });
    return true;
  }
  const detailMatch = /^\/v1\/me\/smartlinks\/(\d+)$/.exec(url.pathname);
  if (detailMatch) {
    const id = Number(detailMatch[1]);
    const link = state.smartlinks.find((s) => s.id === id);
    if (!link) {
      send(res, 404, { data: { status: 'error', message: 'SMARTLINK_NOT_FOUND' } });
      return true;
    }
    if (req.method === 'GET') {
      send(res, 200, { data: link });
      return true;
    }
    if (req.method === 'DELETE') {
      state.smartlinks = state.smartlinks.filter((s) => s.id !== id);
      send(res, 200, { data: { status: 'accepted', message: 'SMARTLINK_DELETED' } });
      return true;
    }
  }
  return false;
}

export async function startMockServer(seed?: Partial<MockState>): Promise<MockServerHandle> {
  const state: MockState = { ...defaultState(), ...seed };
  if (!seed?.authToken) state.authToken = TOKEN;

  const server = http.createServer((req, res) => {
    void (async () => {
      try {
        const url = new URL(req.url ?? '/', 'http://mock');
        if (!authOk(req, state)) {
          send(res, 401, { data: { status: 'error', message: 'UNAUTHORIZED' } });
          return;
        }
        if (url.pathname === '/v1/me' && req.method === 'GET') {
          send(res, 200, { data: { id: 123, username: 'tester', email: 'tester@example.com' } });
          return;
        }
        if (handleSyncsRoutes(url, req, res, state)) return;
        if (handleSmartlinksRoutes(url, req, res, state)) return;
        await readJsonBody(req).catch(() => null);
        send(res, 404, { data: { status: 'error', message: 'NOT_FOUND' } });
      } catch (err) {
        send(res, 500, { data: { status: 'error', message: (err as Error).message } });
      }
    })();
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address() as AddressInfo;
  const url = `http://127.0.0.1:${addr.port}`;

  return {
    url,
    state,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((err) =>
          err ? reject(err instanceof Error ? err : new Error(String(err))) : resolve()
        );
      }),
  };
}

export function setupMockEnv(handle: MockServerHandle): void {
  process.env.SOUNDIIZ_MCP_API_BASE = handle.url;
  process.env.SOUNDIIZ_API_KEY = handle.state.authToken;
}

export function clearMockEnv(): void {
  delete process.env.SOUNDIIZ_MCP_API_BASE;
  delete process.env.SOUNDIIZ_API_KEY;
}
