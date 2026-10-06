(() => {
  const form = document.querySelector('#mind-check');
  if (!form) return;
  const steps = [...document.querySelectorAll('.progress span')];
  const title = document.querySelector('#result-title');
  const text = document.querySelector('#result-text');
  const advice = {
    identity: ['Make agency visible.', 'Name each actor and record whose authority they use.'],
    context: ['Make context recoverable.', 'Record the facts and constraints available when a decision was made.'],
    purpose: ['State the shared purpose.', 'Write down the goal clearly enough to settle a difficult tradeoff.'],
    protocol: ['Make the rules inspectable.', 'Show who can decide, challenge, or stop an action.'],
    memory: ['Give outcomes a place to live.', 'Keep a record of what happened and what should change next time.']
  };
  function update() {
    const checked = [...form.querySelectorAll('input:checked')];
    const count = checked.length;
    steps.forEach((step, index) => step.classList.toggle('active', index < count));
    const next = [...form.querySelectorAll('input')].find(input => !input.checked);
    if (next) {
      [title.textContent, text.textContent] = advice[next.name];
    } else {
      title.textContent = 'Now test a difficult decision.';
      text.textContent = 'Your group can answer the foundational questions. Test the design with conflict, incomplete information, and a participant who wants to leave.';
    }
  }
  const labels = { identity: 'Identity', context: 'Context', purpose: 'Purpose', protocol: 'Protocol', memory: 'Memory' };
  const inputs = [...form.querySelectorAll('input')];
  const share = document.querySelector('.share');
  const summaryEl = document.querySelector('#share-summary');
  const status = document.querySelector('#share-status');
  const code = () => inputs.map(input => (input.checked ? '1' : '0')).join('');
  const link = () => `${location.origin}${location.pathname}#a=${code()}`;
  function summary() {
    const lines = inputs.map(input => `${input.checked ? '✓' : '○'} ${labels[input.name]}`);
    const count = inputs.filter(input => input.checked).length;
    return `Mind check: my group can answer ${count} of 5 questions about a recent decision.\n${lines.join('  ')}\n${link()}`;
  }
  function refreshShare() {
    const any = inputs.some(input => input.checked);
    share.hidden = !any;
    if (!any) {
      history.replaceState(null, '', location.pathname + location.search);
      return;
    }
    summaryEl.textContent = summary();
    history.replaceState(null, '', `#a=${code()}`);
  }
  async function copy(text, done) {
    try {
      await navigator.clipboard.writeText(text);
      status.textContent = done;
    } catch {
      status.textContent = 'Copy failed. Select the text above instead.';
    }
    setTimeout(() => { status.textContent = ''; }, 3000);
  }
  document.querySelector('#copy-summary').addEventListener('click', () => copy(summary(), 'Summary copied.'));
  document.querySelector('#copy-link').addEventListener('click', () => copy(link(), 'Link copied.'));
  const saved = /^#a=([01]{5})$/.exec(location.hash);
  if (saved) inputs.forEach((input, i) => { input.checked = saved[1][i] === '1'; });
  form.addEventListener('change', () => { update(); refreshShare(); });
  update();
  refreshShare();
})();
