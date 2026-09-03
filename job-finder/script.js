const profiles = [
  { id: 1, name: 'Maya Chen', title: 'VP of Engineering', company: 'Northstar Labs', function: 'Engineering', match: 96, lastSeen: 'Active today', tone: 'tone-a', tags: ['AI product', 'Platform'], status: 'uncontacted' },
  { id: 2, name: 'Ava Brooks', title: 'Head of Product', company: 'Asteria Health', function: 'Product', match: 91, lastSeen: 'Active 2h ago', tone: 'tone-b', tags: ['UX research', 'Healthtech'], status: 'replied' },
  { id: 3, name: 'Nolan Price', title: 'Director of Growth', company: 'Beacon Forge', function: 'Marketing', match: 88, lastSeen: 'Active this week', tone: 'tone-c', tags: ['Demand gen', 'Lifecycle'], status: 'uncontacted' },
  { id: 4, name: 'Elena Vargas', title: 'Design Director', company: 'Quanta Retail', function: 'Design', match: 86, lastSeen: 'Active yesterday', tone: 'tone-d', tags: ['Systems design', 'Brand'], status: 'uncontacted' },
  { id: 5, name: 'Samir Patel', title: 'Founding Recruiter', company: 'Velvet Grid', function: 'Sales', match: 93, lastSeen: 'Active now', tone: 'tone-e', tags: ['B2B sales', 'Enterprise'], status: 'uncontacted' },
  { id: 6, name: 'Jordan Lee', title: 'Principal ML Engineer', company: 'Signal Loop', function: 'Engineering', match: 90, lastSeen: 'Active 1d ago', tone: 'tone-f', tags: ['ML systems', 'MLOps'], status: 'replied' }
];

const templates = {
  warm: 'Hi {{firstName}},\n\nI came across your work at {{company}} and wanted to reach out. I am exploring my next opportunity in {{function}} and your team stood out for the kind of thoughtful work you are doing.\n\nWould you be open to a quick conversation about what you are building and where I might be able to contribute?\n\nBest,\nSushmit',
  role: 'Hi {{firstName}},\n\nI noticed {{company}} is growing its {{function}} team. I would love to learn more about the problems you are solving and whether my background could be a fit for the team.\n\nDo you have 15 minutes for a quick introduction next week?\n\nBest,\nSushmit',
  followup: 'Hi {{firstName}},\n\nJust bringing this back to the top of your inbox in case it got buried. I am still very interested in the work at {{company}} and would be glad to connect whenever timing is right.\n\nBest,\nSushmit'
};

const savedIds = JSON.parse(localStorage.getItem('hirelift-saved') || '[]');
const state = { selectedId: 1, query: '', filter: 'all', sort: 'match', saved: new Set(savedIds), sent: Number(localStorage.getItem('hirelift-sent') || 24) };
const $ = (selector) => document.querySelector(selector);
const elements = { list: $('#jobs-list'), search: $('#keyword-search'), sort: $('#sort-filter'), selected: $('#selected-contact'), message: $('#message-input'), template: $('#template-select'), chars: $('#character-count'), results: $('#results-count'), savedCount: $('#saved-count'), sentCount: $('#sent-count'), toast: $('#toast') };

function initials(name) { return name.split(' ').map((part) => part[0]).join(''); }
function selectedProfile() { return profiles.find((profile) => profile.id === state.selectedId) || profiles[0]; }
function personalize(message, profile = selectedProfile()) { return message.replaceAll('{{firstName}}', profile.name.split(' ')[0]).replaceAll('{{company}}', profile.company).replaceAll('{{function}}', profile.function.toLowerCase()); }
function filteredProfiles() {
  const query = state.query.toLowerCase();
  const list = profiles.filter((profile) => {
    const matchesQuery = !query || `${profile.name} ${profile.title} ${profile.company} ${profile.function} ${profile.tags.join(' ')}`.toLowerCase().includes(query);
    const matchesFilter = state.filter === 'all' || (state.filter === 'saved' ? state.saved.has(profile.id) : profile.status === state.filter);
    return matchesQuery && matchesFilter;
  });
  return list.sort((a, b) => state.sort === 'response' ? a.match - b.match : state.sort === 'recent' ? a.lastSeen.localeCompare(b.lastSeen) : b.match - a.match);
}
function renderList() {
  const list = filteredProfiles();
  elements.results.textContent = `${list.length} ${list.length === 1 ? 'contact' : 'contacts'}`;
  elements.savedCount.textContent = state.saved.size;
  elements.list.innerHTML = list.length ? list.map((profile) => `<article class="contact-row ${profile.id === state.selectedId ? 'selected' : ''}" data-id="${profile.id}"><input class="contact-check" type="checkbox" aria-label="Select ${profile.name}" data-check-id="${profile.id}" /><span class="contact-avatar ${profile.tone}">${initials(profile.name)}</span><div class="contact-main"><div class="contact-name">${profile.name}</div><div class="contact-role">${profile.title} · ${profile.company}</div><div class="contact-tags">${profile.tags.map((tag) => `<span class="mini-tag">${tag}</span>`).join('')}</div></div><div class="contact-status"><span class="match">${profile.match}% match</span><span class="last-seen">${profile.lastSeen}</span></div><div class="row-actions"><button type="button" class="save-contact ${state.saved.has(profile.id) ? 'saved' : ''}" data-save-id="${profile.id}" aria-label="Save ${profile.name}">${state.saved.has(profile.id) ? '★' : '☆'}</button><button type="button" class="more-contact" aria-label="More actions">•••</button></div></article>`).join('') : '<div class="empty-state">No contacts match your current view.</div>';
  elements.list.querySelectorAll('.contact-row').forEach((row) => row.addEventListener('click', (event) => { if (event.target.closest('button, input')) return; state.selectedId = Number(row.dataset.id); renderList(); renderComposer(); }));
  elements.list.querySelectorAll('[data-save-id]').forEach((button) => button.addEventListener('click', (event) => { event.stopPropagation(); toggleSaved(Number(button.dataset.saveId)); }));
}
function renderComposer() { const profile = selectedProfile(); elements.selected.innerHTML = `<span class="contact-avatar ${profile.tone}">${initials(profile.name)}</span><span><b>${profile.name}</b><small>${profile.title} at ${profile.company}</small></span><span class="recipient-label">To</span>`; elements.message.value = personalize(templates[elements.template.value], profile); updateCharacterCount(); }
function toggleSaved(id) { state.saved.has(id) ? state.saved.delete(id) : state.saved.add(id); localStorage.setItem('hirelift-saved', JSON.stringify([...state.saved])); renderList(); showToast(state.saved.has(id) ? 'Contact saved to your list' : 'Contact removed from saved'); }
function updateCharacterCount() { elements.chars.textContent = `${elements.message.value.length} characters`; }
function showToast(message) { elements.toast.textContent = message; elements.toast.classList.add('show'); clearTimeout(showToast.timer); showToast.timer = setTimeout(() => elements.toast.classList.remove('show'), 2800); }
function insertToken(token) { const start = elements.message.selectionStart; elements.message.value = `${elements.message.value.slice(0, start)}${token}${elements.message.value.slice(elements.message.selectionEnd)}`; elements.message.focus(); elements.message.selectionStart = elements.message.selectionEnd = start + token.length; updateCharacterCount(); }

elements.search.addEventListener('input', (event) => { state.query = event.target.value.trim(); renderList(); });
elements.sort.addEventListener('change', (event) => { state.sort = event.target.value; renderList(); });
elements.template.addEventListener('change', renderComposer);
elements.message.addEventListener('input', updateCharacterCount);
$('#first-name-button').addEventListener('click', () => insertToken('{{firstName}}'));
$('#company-button').addEventListener('click', () => insertToken('{{company}}'));
document.querySelectorAll('.tab').forEach((tab) => tab.addEventListener('click', () => { document.querySelectorAll('.tab').forEach((item) => item.classList.remove('active')); tab.classList.add('active'); state.filter = tab.dataset.filter; renderList(); }));
document.querySelectorAll('.nav-item').forEach((item) => item.addEventListener('click', () => { document.querySelectorAll('.nav-item').forEach((nav) => nav.classList.remove('active')); item.classList.add('active'); const view = item.dataset.view; $('#view-heading').textContent = view === 'Inbox' ? 'Contacts' : view; showToast(`${view} view selected`); }));
$('#reset-filters').addEventListener('click', () => { state.query = ''; state.filter = 'all'; elements.search.value = ''; document.querySelectorAll('.tab').forEach((tab) => tab.classList.toggle('active', tab.dataset.filter === 'all')); renderList(); });
$('#select-all').addEventListener('change', (event) => document.querySelectorAll('.contact-check').forEach((check) => { check.checked = event.target.checked; }));
async function persistMessage(status) {
  if (!database) return;
  const { data: { user } } = await database.auth.getUser();
  if (!user) return;
  await database.from('messages').insert({ user_id: user.id, contact_id: selectedProfile().id, body: elements.message.value, status });
}

$('#send-button').addEventListener('click', async () => { if (!elements.message.value.trim()) return showToast('Add a message before sending'); state.sent += 1; localStorage.setItem('hirelift-sent', state.sent); elements.sentCount.textContent = state.sent; await persistMessage('sent'); showToast(`Message sent to ${selectedProfile().name}`); });
$('#schedule-button').addEventListener('click', async () => { await persistMessage('scheduled'); showToast(`Message scheduled for ${selectedProfile().name}`); });
$('#new-contact-button').addEventListener('click', () => showToast('Contact import is ready for your next connection'));
$('.close-button').addEventListener('click', () => { $('.composer-panel').classList.toggle('composer-collapsed'); showToast('Composer toggled'); });
$('.filter-button').addEventListener('click', () => showToast('All contacts are currently visible'));
elements.sentCount.textContent = state.sent;
renderList();
renderComposer();

const config = window.HIRELIFT_CONFIG || {};
const database = config.supabaseUrl && config.supabaseAnonKey && window.supabase
  ? window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey)
  : null;
const authScreen = $('#auth-screen');
const appShell = $('.app-shell');
const authMessage = $('#auth-message');

function enterWorkspace(user = { email: 'demo@hirelift.app' }) {
  localStorage.setItem('hirelift-session', JSON.stringify({ email: user.email }));
  authScreen.classList.add('hidden');
  appShell.classList.add('visible');
}

function showAuthMessage(message) { authMessage.textContent = message; }

$('#login-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const email = $('#login-email').value.trim();
  const password = $('#login-password').value;
  if (!database) {
    showAuthMessage('Database is not configured yet. Use the demo workspace below or add Supabase credentials to config.js.');
    return;
  }
  const { data, error } = await database.auth.signInWithPassword({ email, password });
  if (error) return showAuthMessage(error.message);
  enterWorkspace(data.user);
});

$('#signup-button').addEventListener('click', async () => {
  if (!database) return showAuthMessage('Add your Supabase URL and anon key to config.js to enable account creation.');
  const email = $('#login-email').value.trim();
  const password = $('#login-password').value;
  if (!email || password.length < 6) return showAuthMessage('Enter an email and a password with at least 6 characters.');
  const { error } = await database.auth.signUp({ email, password });
  showAuthMessage(error ? error.message : 'Check your email to confirm your new account.');
});

$('#demo-login').addEventListener('click', () => enterWorkspace());
$('#forgot-password').addEventListener('click', async (event) => {
  event.preventDefault();
  if (!database) return showAuthMessage('Password reset becomes available after Supabase is configured.');
  const email = $('#login-email').value.trim();
  if (!email) return showAuthMessage('Enter your email address first.');
  const { error } = await database.auth.resetPasswordForEmail(email);
  showAuthMessage(error ? error.message : 'Password reset instructions sent.');
});

$('#linkedin-button').addEventListener('click', () => { $('#linkedin-modal').hidden = false; });
$('#linkedin-oauth').addEventListener('click', () => {
  if (!config.linkedInClientId) return showToast('Add your LinkedIn Client ID to config.js to enable OAuth');
  const redirectUri = `${window.location.origin}/linkedin-callback`;
  const params = new URLSearchParams({ response_type: 'code', client_id: config.linkedInClientId, redirect_uri: redirectUri, scope: 'openid profile email' });
  window.location.href = `https://www.linkedin.com/oauth/v2/authorization?${params}`;
});
$('#linkedin-close').addEventListener('click', () => { $('#linkedin-modal').hidden = true; });
$('#linkedin-modal').addEventListener('click', (event) => { if (event.target.id === 'linkedin-modal') event.currentTarget.hidden = true; });

if (database) {
  database.auth.getSession().then(({ data }) => { if (data.session) enterWorkspace(data.session.user); });
}

if (!localStorage.getItem('hirelift-session')) {
  authScreen.classList.remove('hidden');
} else {
  enterWorkspace(JSON.parse(localStorage.getItem('hirelift-session')));
}
