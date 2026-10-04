// Mind of Agents is a second first-party surface of the existing Agents of Mind game.
// Static content remains on GitHub Pages. These routes share AoM's MoM game.
const SITE = 'https://www.mindofagents.com';
const GAME = 'https://www.agentsofmind.com';
const BOOK_PATH = '/downloads/mind-of-agents-current-edition.pdf';
const GAME_PATHS = new Set([
  '/session', '/seats', '/join/claim', '/events', '/public/touch',
  '/coseller/claim-visitor', '/api/coseller/activate', '/api/coseller/program',
  '/auth/login'
]);

function redirectHome(url) {
  const target = new URL('/', SITE);
  target.search = url.search;
  return new Response(null, {
    status: 302,
    headers: { Location: target.toString(), 'Cache-Control': 'no-store' }
  });
}

async function authConfig() {
  const upstream = await fetch(`${GAME}/auth.json`, { headers: { Accept: 'application/json' } });
  if (!upstream.ok) return new Response('Authentication is unavailable.', { status: 502 });
  const config = await upstream.json();
  Object.assign(config, {
    app_name: 'Mind of Agents',
    mom_base_url: SITE,
    app_base_url: SITE,
    redirect_uri: `${SITE}/auth/callback`,
    success_url: `${SITE}/auth/success`,
    failure_url: `${SITE}/auth/failure`,
    logout_url: SITE
  });
  return Response.json(config, { headers: {
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*'
  } });
}

async function proxyGame(request, url) {
  const target = new URL(url.pathname + url.search, GAME);
  const upstream = await fetch(new Request(target, request), { redirect: 'manual' });
  const headers = new Headers(upstream.headers);
  headers.set('Cache-Control', 'no-store');
  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers
  });
}

async function downloadBook(request) {
  const noStore = { 'Cache-Control': 'private, no-store' };
  if (request.method !== 'GET') return new Response('Method not allowed', { status: 405, headers: noStore });
  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return Response.json({ error: 'sign-in-required' }, { status: 401, headers: noStore });
  }
  const verified = await fetch(`${GAME}/session`, {
    headers: { Authorization: authorization, Accept: 'application/json' },
    cache: 'no-store'
  });
  if (!verified.ok || !(await verified.json()).authenticated) {
    return Response.json({ error: 'sign-in-required' }, { status: 401, headers: noStore });
  }
  const headers = new Headers(request.headers);
  headers.delete('Authorization');
  headers.delete('Cookie');
  const origin = await fetch(new Request(request, { headers, cache: 'no-store' }));
  if (!origin.ok) return new Response('Book download is unavailable.', { status: 502, headers: noStore });
  const responseHeaders = new Headers(origin.headers);
  responseHeaders.set('Cache-Control', 'private, no-store');
  responseHeaders.set('Content-Type', 'application/pdf');
  responseHeaders.set('Content-Disposition', 'attachment; filename="mind-of-agents.pdf"');
  return new Response(origin.body, { status: 200, headers: responseHeaders });
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.hostname === 'mindofagents.com') {
      url.hostname = 'www.mindofagents.com';
      return Response.redirect(url.toString(), 301);
    }
    if (url.hostname !== 'www.mindofagents.com') {
      return new Response('Unknown host', { status: 404 });
    }
    if (url.pathname === '/auth.json') return authConfig();
    if (['/auth/callback', '/auth/success', '/auth/failure'].includes(url.pathname)) {
      return redirectHome(url);
    }
    if (url.pathname === '/game/health') {
      return proxyGame(request, new URL('/health', SITE));
    }
    if (GAME_PATHS.has(url.pathname)) return proxyGame(request, url);
    if (url.pathname === BOOK_PATH) return downloadBook(request);
    // Static pages do not need game credentials or the visitor cookie at the origin.
    const headers = new Headers(request.headers);
    headers.delete('Cookie');
    headers.delete('Authorization');
    return fetch(new Request(request, { headers }));
  }
};
