const parts = {
  identity: {number:'01',body:'THE FACE',title:'Identity',description:'A stable way to know which person, AI agent, group, or mind is involved—and on whose behalf it acts.',question:'Can you trace an action to an actor and the authority behind it?'},
  attention: {number:'02',body:'THE EYES',title:'Perception & attention',description:'Signals arrive from people, tools, and the world. Attention chooses what deserves a response now.',question:'What enters this mind, and why does one signal take priority over another?'},
  context: {number:'03',body:'THE SENSE OF SITUATION',title:'Meaning & context',description:'Shared terms and task-specific context turn raw data into something participants can interpret together.',question:'Can agents tell a fact from an inference, a request, or an instruction?'},
  memory: {number:'04',body:'THE REMEMBERING MIND',title:'Memory',description:'A revisable record of events, knowledge, decisions, and relationships gives work continuity across sessions.',question:'What persists, who may retrieve it, and what may be forgotten?'},
  imagination: {number:'05',body:'THE MIND’S EYE',title:'Imagination & planning',description:'Agents can propose alternatives, simulate consequences, and compare possible paths before committing to one.',question:'Can the group see options and uncertainty before an irreversible move?'},
  purpose: {number:'06',body:'THE HEART',title:'Purpose & values',description:'A mind needs an explicit reason to exist: goals, priorities, and values that can guide tradeoffs.',question:'Whose purpose is being served, and who can change it?'},
  decision: {number:'07',body:'THE WILL',title:'Decision & authority',description:'A decision names who may choose, approve, refuse, or escalate an action. Human responsibility stays visible.',question:'What requires a person’s approval, and what authority was delegated?'},
  protocols: {number:'08',body:'THE SPINE',title:'Protocols & boundaries',description:'Rules make collaboration repeatable: roles, permissions, consent, handoffs, checks, and exit conditions.',question:'What must be true before an action is allowed?'},
  action: {number:'09',body:'THE HANDS',title:'Action & capabilities',description:'Agents use tools, skills, and other agents to change the world within the permissions they actually hold.',question:'What can this agent do, through which tool, and with what side effects?'},
  reflection: {number:'10',body:'THE LEARNING LOOP',title:'Reflection & learning',description:'The mind compares outcomes with expectations, records mistakes, and revises future behavior or rules.',question:'What changed because the last action succeeded or failed?'},
  provenance: {number:'11',body:'THE ACCOUNT',title:'Provenance & contribution',description:'A trace connects inputs, actions, outcomes, and contributors so decisions can be explained and value can be governed.',question:'Can a participant see how their contribution affected an outcome?'},
  resources: {number:'12',body:'THE PULSE',title:'Time & resources',description:'Work unfolds over time and consumes attention, compute, money, and other finite resources.',question:'When does work expire, and what limits keep it sustainable?'},
};

const order = Object.keys(parts);
let current = 'identity';

function selectPart(key) {
  const part = parts[key];
  if (!part) return;
  current = key;
  document.querySelector('#protocol-count').textContent = `${part.number} / 12`;
  document.querySelector('#protocol-body-name').textContent = part.body;
  document.querySelector('#protocol-title').textContent = part.title;
  document.querySelector('#protocol-description').textContent = part.description;
  document.querySelector('#protocol-question').textContent = part.question;
  document.querySelectorAll('[data-part]').forEach(element => {
    const active = element.dataset.part === key;
    element.classList.toggle('is-active', active);
    if (element.tagName === 'BUTTON') element.setAttribute('aria-pressed', String(active));
  });
  const hint = document.querySelector('.protocol-start');
  if (hint && key !== 'identity') hint.remove();
}

const step = delta => selectPart(order[(order.indexOf(current) + delta + order.length) % order.length]);
document.querySelector('#protocol-next')?.addEventListener('click', () => step(1));
document.querySelector('#protocol-prev')?.addEventListener('click', () => step(-1));

document.querySelectorAll('[data-part]').forEach(element => {
  element.addEventListener('click', () => selectPart(element.dataset.part));
  if (element.tagName.toLowerCase() === 'g') {
    element.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectPart(element.dataset.part); }
    });
  }
});
