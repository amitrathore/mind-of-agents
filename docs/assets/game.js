/* Mind of Agents is a first-party UI for the existing Agents of Mind game. */
(() => {
  const TOKEN_KEY = 'aom.token';
  const RETURN_KEY = 'moa.game.return';
  const SEAT_KEY = 'moa.selected-seat';
  const BOOK_URL = '/downloads/mind-of-agents-current-edition.pdf';
  const state = { session: null, seats: [], program: null, config: null, error: '', busy: false };
  const path = location.pathname;
  const ref = new URLSearchParams(location.search).get('ref');
  const $ = (selector) => document.querySelector(selector);
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
  const token = () => localStorage.getItem(TOKEN_KEY);
  const headers = () => token() ? {
    Authorization: `Bearer ${token()}`,
    ...(localStorage.getItem(SEAT_KEY) ? { 'X-Selected-Seat': localStorage.getItem(SEAT_KEY) } : {})
  } : {};
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
      state.seats = [];
      if (state.session.authenticated && state.session.seatCount > 0) {
        const result = await json('/seats', { headers: headers() });
        state.seats = result.seats || [];
        if (!seat() && state.seats.length === 1) {
          localStorage.setItem(SEAT_KEY, state.seats[0].playerName);
          state.session = await json('/session', { headers: headers() });
        }
      }
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
    if (!seat() && state.session.seatCount > 0) {
      return state.seats.length
        ? `<p>You already have ${state.seats.length === 1 ? 'a handle' : 'handles'} in Agents of Mind. Choose one to share this page.</p>
          <div class="game-seat-list">${state.seats.map((item) => `<button class="game-seat" data-game="choose-seat" data-handle="${escapeHtml(item.playerName)}">@${escapeHtml(item.playerName)} <span aria-hidden="true">↗</span></button>`).join('')}</div>`
        : '<p>We found your existing profile, but could not load its handle. Try again.</p><button class="game-action" data-game="retry">Try again</button>';
    }
    if (!seat()) return `<p>Choose the public handle that will identify your contributions across Agents of Mind.</p>
      <form id="game-handle-form"><label for="game-handle">Your handle</label>
      <input id="game-handle" name="handle" maxlength="32" autocomplete="nickname" required placeholder="yourname">
      <button class="game-action" type="submit" ${state.busy ? 'disabled' : ''}>Claim handle</button></form>`;
    const switcher = state.seats.length > 1 ? '<button class="game-switch" data-game="switch-seat">Switch handle</button>' : '';
    if (!state.program || state.program.status !== 'active' || !state.program['ref-token']) {
      return `<p>You’re here as <strong>@${escapeHtml(seat().playerName)}</strong>. Activate Coselling to share this page with your own link.</p>
        <button class="game-action" data-game="activate" ${state.busy ? 'disabled' : ''}>Activate Coselling</button>${switcher}`;
    }
    return `<p>Share this page as <strong>@${escapeHtml(seat().playerName)}</strong>.</p>
      <label for="game-share-url">Your link</label><input id="game-share-url" value="${escapeHtml(pageUrl())}" readonly>
      <div class="game-actions"><button class="game-action" data-game="copy">Copy link</button>
      ${navigator.share ? '<button class="game-secondary" data-game="native-share">Share…</button>' : ''}</div>
      ${switcher}<p class="game-fine">${state.program['earnings-enabled']
        ? 'Qualifying purchases may earn a share under the current program terms. A click alone does not earn a commission.'
        : 'Referral attribution is active. Commissions begin when eligible checkout launches.'}</p>`;
  }

  function render() {
    const dialog = $('#game-dialog');
    if (!dialog) return;
    $('#game-dialog-content').innerHTML = content();
    const footerSeat = $('#game-footer-seat');
    if (footerSeat) {
      footerSeat.textContent = !state.session?.authenticated ? 'Player seat · Sign in ↗'
        : seat() ? `Player seat · @${seat().playerName}${state.seats.length > 1 ? ' ↔' : ''}`
          : state.session.seatCount > 0 ? 'Player seat · Choose handle ↗'
            : 'Player seat · Claim handle ↗';
    }
    renderDownload();
  }

  function renderDownload() {
    const gate = $('#download-gate');
    if (!gate) return;
    if (state.error) {
      gate.innerHTML = `<p class="game-error" role="alert">${escapeHtml(state.error)}</p><button class="button" data-download="retry">Try again</button>`;
    } else if (!state.session) {
      gate.innerHTML = '<p>Checking your sign-in…</p>';
    } else if (!state.session.authenticated) {
      gate.innerHTML = '<p>Sign in with Agents of Mind to download the complete PDF. The online chapters remain open to everyone.</p><button class="button" data-download="sign-in">Sign in to download ↗</button>';
    } else {
      gate.innerHTML = '<p>You’re signed in. The complete PDF is ready.</p><button class="button" data-download="book">Download the PDF ↗</button><p id="download-feedback" class="game-download-feedback" role="status"></p>';
    }
  }

  async function downloadBook() {
    const button = $('[data-download="book"]');
    const feedback = $('#download-feedback');
    if (!button || !feedback) return;
    button.disabled = true;
    feedback.textContent = 'Preparing your PDF…';
    try {
      const response = await fetch(BOOK_URL, {
        headers: { Authorization: `Bearer ${token()}` },
        cache: 'no-store'
      });
      if (response.status === 401) {
        localStorage.removeItem(TOKEN_KEY);
        await refresh();
        return;
      }
      if (!response.ok) throw new Error('The PDF is unavailable right now. Please try again.');
      const file = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = file;
      link.download = 'mind-of-agents.pdf';
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(file), 60000);
      feedback.textContent = 'Download started.';
    } catch (error) {
      feedback.textContent = error.message;
    } finally {
      button.disabled = false;
    }
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
      localStorage.setItem(SEAT_KEY, handle);
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

  async function chooseSeat(name) {
    if (!state.seats.some((item) => item.playerName === name)) return;
    localStorage.setItem(SEAT_KEY, name);
    await refresh();
    await claimVisitor();
  }

  function switchSeat() {
    localStorage.removeItem(SEAT_KEY);
    if (state.session) state.session.selectedSeat = null;
    state.program = null;
    render();
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

    const footer = $('.footer-bottom');
    if (footer) {
      const footerSeat = document.createElement('button');
      footerSeat.id = 'game-footer-seat';
      footerSeat.className = 'game-footer-seat';
      footerSeat.type = 'button';
      footerSeat.textContent = 'Player seat · Sign in ↗';
      footerSeat.addEventListener('click', () => {
        if (seat() && state.seats.length > 1) switchSeat();
        $('#game-dialog').showModal();
      });
      footer.append(footerSeat);
    }

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
      if (action === 'choose-seat') chooseSeat(event.target.closest('[data-handle]').dataset.handle);
      if (action === 'switch-seat') switchSeat();
      if (action === 'copy') copyLink();
      if (action === 'native-share' && navigator.share) navigator.share({ url: pageUrl(), title: document.title });
    });
    dialog.addEventListener('submit', (event) => {
      if (event.target.id === 'game-handle-form') claimHandle(event);
    });
    document.body.append(dialog);

    $('#download-gate')?.addEventListener('click', (event) => {
      const action = event.target.closest('[data-download]')?.dataset.download;
      if (action === 'retry') refresh();
      if (action === 'sign-in') beginSignIn();
      if (action === 'book') downloadBook();
    });
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
