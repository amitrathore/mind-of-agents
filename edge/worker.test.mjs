import assert from 'node:assert/strict';
import test from 'node:test';
import worker from './worker.mjs';

test('apex redirects to www without losing path or query', async () => {
  const response = await worker.fetch(new Request('https://mindofagents.com/read/identity/?ref=abc'));
  assert.equal(response.status, 301);
  assert.equal(response.headers.get('location'), 'https://www.mindofagents.com/read/identity/?ref=abc');
});

test('auth config returns to the MoA origin', async (t) => {
  const original = globalThis.fetch;
  globalThis.fetch = async (request) => {
    assert.equal(String(request), 'https://www.agentsofmind.com/auth.json');
    return Response.json({ app_name: 'Agents of Mind', auth_base_url: 'https://auth.example.test' });
  };
  t.after(() => { globalThis.fetch = original; });
  const response = await worker.fetch(new Request('https://www.mindofagents.com/auth.json'));
  const config = await response.json();
  assert.equal(config.success_url, 'https://www.mindofagents.com/auth/success');
  assert.equal(config.mom_base_url, 'https://www.mindofagents.com');
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('access-control-allow-origin'), '*');
});

test('referral touch uses the AoM game and returns its first-party visitor cookie', async (t) => {
  const original = globalThis.fetch;
  globalThis.fetch = async (request) => {
    assert.equal(request.url, 'https://www.agentsofmind.com/public/touch');
    assert.equal(request.method, 'POST');
    assert.equal(await request.text(), JSON.stringify({ token: 'ref-1', path: '/read/identity/' }));
    return new Response('{"ok":true}', { status: 200,
      headers: { 'Set-Cookie': 'ig_vid=visitor%3Aone; Path=/; Secure; HttpOnly; SameSite=Lax' } });
  };
  t.after(() => { globalThis.fetch = original; });
  const response = await worker.fetch(new Request('https://www.mindofagents.com/public/touch', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: 'ref-1', path: '/read/identity/' })
  }));
  assert.equal(response.status, 200);
  assert.match(response.headers.get('set-cookie'), /^ig_vid=/);
});

test('book content stays on the static origin', async (t) => {
  const original = globalThis.fetch;
  globalThis.fetch = async (request) => {
    assert.equal(request.url, 'https://www.mindofagents.com/read/identity/');
    assert.equal(request.headers.get('cookie'), null);
    assert.equal(request.headers.get('authorization'), null);
    return new Response('chapter');
  };
  t.after(() => { globalThis.fetch = original; });
  const response = await worker.fetch(new Request('https://www.mindofagents.com/read/identity/', {
    headers: { Cookie: 'ig_vid=visitor', Authorization: 'Bearer private-token' }
  }));
  assert.equal(await response.text(), 'chapter');
});

test('the PDF URL rejects visitors without a game sign-in', async (t) => {
  const original = globalThis.fetch;
  globalThis.fetch = () => { throw new Error('The origin should not be reached'); };
  t.after(() => { globalThis.fetch = original; });
  const response = await worker.fetch(new Request('https://www.mindofagents.com/downloads/mind-of-agents-current-edition.pdf'));
  assert.equal(response.status, 401);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
});

test('a signed-in reader receives the PDF without leaking their token to Pages', async (t) => {
  const original = globalThis.fetch;
  globalThis.fetch = async (request, options) => {
    if (String(request) === 'https://www.agentsofmind.com/session') {
      assert.equal(new Headers(options.headers).get('authorization'), 'Bearer reader-token');
      return Response.json({ authenticated: true });
    }
    assert.equal(request.url, 'https://www.mindofagents.com/downloads/mind-of-agents-current-edition.pdf');
    assert.equal(request.headers.get('authorization'), null);
    assert.equal(request.headers.get('cookie'), null);
    return new Response('pdf-bytes', { headers: { 'Content-Type': 'application/pdf' } });
  };
  t.after(() => { globalThis.fetch = original; });
  const response = await worker.fetch(new Request('https://www.mindofagents.com/downloads/mind-of-agents-current-edition.pdf', {
    headers: { Authorization: 'Bearer reader-token', Cookie: 'ig_vid=visitor' }
  }));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-disposition'), 'attachment; filename="mind-of-agents.pdf"');
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal(await response.text(), 'pdf-bytes');
});
