/* Mind of Agents is a first-party UI for the existing Agents of Mind game. */
(() => {
  const TOKEN_KEY = 'aom.token';
  const RETURN_KEY = 'moa.game.return';
  const state = { session: null, program: null, config: null, error: '', busy: false };
  const path = location.pathname;
  const ref = new URLSearchParams(location.search).get('ref');
  const $ = (selector) => document.querySelector(selector);
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
  const token = () => localStorage.getItem(TOKEN_KEY);
  const headers = () => token() ? { Authorization: `Bearer ${token()}` } : {};
  const seat = () => state.session?.selectedSeat;
  const roles = () => seat()?.playerRoles || (seat()?.playerRole ? [seat().playerRole] : []);

  async function json(url, options = {}) {
    const response = await fetch(url, { credentials: 'include', cache: 'no-store', ...options });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body.error) {
      throw new Error(body?.error?.message || body?.message ||
        (typeof body.error === 'string' ? body.error : `Request failed (${response.status})`));
    }
    return body;
  }

  function captureSignIn() {
    const url = new URL(location.href);
    const value = url.searchParams.get('token');
    if (!value) return;
    localStorage.setItem(TOKEN_KEY, value);
    url.searchParams.delete('token');
    url.searchParams.delete('provider');
    history.replaceState({}, '', url.pathname + url.search + url.hash);
    const target = sessionStorage.getItem(RETURN_KEY);
    sessionStorage.removeItem(RETURN_KEY);
    if (target && target.startsWith('/') && !target.startsWith('//') && target !== location.pathname) {
      location.replace(target);
      return true;
    }
    return false;
  }

  async function recordTouch() {
    if (!ref) return;
    try {
      if (seat()) {
        await json('/events', {
          method: 'POST', headers: { 'Content-Type': 'application/json', ...headers() },
          body: JSON.stringify({ 'event/type': 'coseller/record-touch',
            'event/data': { token: ref, path } })
        });
      } else {
        await json('/public/touch', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: ref, path })
        });
      }
    } catch (_) { /* A failed attribution request must not block reading. */ }
  }

  async function claimVisitor() {
    if (!seat()) return;
    try { await json('/coseller/claim-visitor', { method: 'POST', headers: headers() }); }
    catch (_) { /* A visitor may already belong to another seat. */ }
  }

  async function refresh() {
    state.error = '';
    try {
      [state.session, state.config] = await Promise.all([
        json('/session', { headers: headers() }),
        json('/auth.json')
      ]);
      state.program = null;
      if (seat() && roles().includes('coseller')) {
        state.program = await json('/api/coseller/program', { headers: headers() });
      }
    } catch (error) { state.error = error.message; }
    render();
  }

  function pageUrl() {
    const url = new URL(path, location.origin);
    url.searchParams.set('ref', state.program['ref-token']);
    return url.toString();
  }

  function beginSignIn() {
    const base = state.config?.auth_base_url;
    if (!base) { state.error = 'Sign-in is unavailable right now.'; render(); return; }
    sessionStorage.setItem(RETURN_KEY, location.pathname + location.search + location.hash);
    location.href = `${base.replace(/\/$/, '')}/?config=${encodeURIComponent(location.origin + '/auth.json')}`;
  }

  function content() {
    if (state.error) return `<p class="game-error" role="alert">${escapeHtml(state.error)}</p><button class="game-action" data-game="retry">Try again</button>`;
    if (!state.session) return '<p>Connecting to Agents of Mind…</p>';
    if (!state.session.authenticated) return `<p>Sign in with Agents of Mind to create a personal link to this page.</p>
      <button class="game-action" data-game="sign-in">Sign in to share</button>`;
    if (!seat()) return `<p>Choose the public handle that will identify your contributions across Agents of Mind.</p>
      <form id="game-handle-form"><label for="game-handle">Your handle</label>
      <input id="game-handle" name="handle" maxlength="32" autocomplete="nickname" required placeholder="yourname">
      <button class="game-action" type="submit" ${state.busy ? 'disabled' : ''}>Claim handle</button></form>`;
    if (!state.program || state.program.status !== 'active' || !state.program['ref-token']) {
      return `<p>You’re here as <strong>@${escapeHtml(seat().playerName)}</strong>. Activate Coselling to share this page with your own link.</p>
        <button class="game-action" data-game="activate" ${state.busy ? 'disabled' : ''}>Activate Coselling</button>`;
    }
    return `<p>Share this page as <strong>@${escapeHtml(seat().playerName)}</strong>.</p>
      <label for="game-share-url">Your link</label><input id="game-share-url" value="${escapeHtml(pageUrl())}" readonly>
      <div class="game-actions"><button class="game-action" data-game="copy">Copy link</button>
      ${navigator.share ? '<button class="game-secondary" data-game="native-share">Share…</button>' : ''}</div>
      <p class="game-fine">${state.program['earnings-enabled']
        ? 'Qualifying purchases may earn a share under the current program terms. A click alone does not earn a commission.'
        : 'Referral attribution is active. Commissions begin when eligible checkout launches.'}</p>`;
  }

  function render() {
    const dialog = $('#game-dialog');
    if (!dialog) return;
    $('#game-dialog-content').innerHTML = content();
  }

  async function activate() {
    state.busy = true; render();
    try {
      await json('/api/coseller/activate', { method: 'POST', headers: headers() });
      await refresh();
    } catch (error) { state.error = error.message; render(); }
    finally { state.busy = false; }
  }

  async function claimHandle(event) {
    event.preventDefault();
    const handle = new FormData(event.currentTarget).get('handle')?.toString().trim();
    if (!handle) return;
    state.busy = true; render();
    try {
      await json('/join/claim', { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers() },
        body: JSON.stringify({ 'player-name': handle, roles: ['audience'] }) });
      await refresh();
      await claimVisitor();
    } catch (error) { state.error = error.message; render(); }
    finally { state.busy = false; }
  }

  async function copyLink() {
    const field = $('#game-share-url');
    if (!field) return;
    try { await navigator.clipboard.writeText(field.value); $('#game-feedback').textContent = 'Link copied.'; }
    catch (_) { field.select(); $('#game-feedback').textContent = 'Select and copy your link.'; }
  }

  function mount() {
    const header = $('.header-inner');
    if (!header) return;
    const button = document.createElement('button');
    button.className = 'game-trigger';
    button.type = 'button';
    button.textContent = 'Share & earn ↗';
    button.addEventListener('click', () => $('#game-dialog').showModal());
    header.append(button);

    const dialog = document.createElement('dialog');
    dialog.id = 'game-dialog';
    dialog.className = 'game-dialog';
    dialog.innerHTML = `<div class="game-dialog-head"><span>Agents of Mind × Mind of Agents</span>
      <button type="button" data-game="close" aria-label="Close">×</button></div>
      <h2>Share this idea.</h2><div id="game-dialog-content"><p>Connecting to Agents of Mind…</p></div>
      <p id="game-feedback" class="game-feedback" role="status"></p>
      <p class="game-note">Your link records a qualifying visit in the Agents of Mind game. Reading is always open.</p>`;
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) dialog.close();
      const action = event.target.closest('[data-game]')?.dataset.game;
      if (action === 'close') dialog.close();
      if (action === 'retry') refresh();
      if (action === 'sign-in') beginSignIn();
      if (action === 'activate') activate();
      if (action === 'copy') copyLink();
      if (action === 'native-share' && navigator.share) navigator.share({ url: pageUrl(), title: document.title });
    });
    dialog.addEventListener('submit', (event) => {
      if (event.target.id === 'game-handle-form') claimHandle(event);
    });
    document.body.append(dialog);
  }

  async function boot() {
    if (captureSignIn()) return;
    mount();
    await refresh();
    await recordTouch();
    await claimVisitor();
  }
  boot();
})();
