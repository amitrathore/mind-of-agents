// Mind of Agents is a second first-party surface of the existing Agents of Mind game.
// Static content remains on GitHub Pages. These routes share AoM's MoM game.
const SITE = 'https://www.mindofagents.com';
const GAME = 'https://www.agentsofmind.com';
const GAME_PATHS = new Set([
  '/session', '/seats', '/join/claim', '/events', '/public/touch',
  '/coseller/claim-visitor', '/api/coseller/activate', '/api/coseller/program',
  '/auth/login'
]);

function redirectHome(url) {
  const target = new URL('/', SITE);
  target.search = url.search;
  return Response.redirect(target.toString(), 302);
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
  return Response.json(config, { headers: { 'Cache-Control': 'no-store' } });
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
    // Route workers' fetch(request) continues to the configured origin.
    return fetch(request);
  }
};
