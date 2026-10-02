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
  form.addEventListener('change', update);
  update();
})();
