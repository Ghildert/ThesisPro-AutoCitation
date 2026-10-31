import { parseCitations, normalize, warnings } from './citations.js';
const $ = id => document.getElementById(id);
let queue = [];
let tabId;
let ready = false;
let working = false;
const labels = { journal_name: 'Journal name', volume: 'Volume', issue: 'Issue', pages: 'Pages', doi_or_url: 'DOI or URL', publisher: 'Publisher', publisher_location: 'Publisher location (APA 6)', site_name: 'Site name', url: 'URL', conference_name: 'Conference name', conference_location: 'Conference location' };
const typeFields = { journal_article: ['journal_name', 'volume', 'issue', 'pages', 'doi_or_url'], book: ['publisher', 'publisher_location', 'doi_or_url'], website: ['site_name', 'url'], conference_paper: ['conference_name', 'conference_location', 'pages'] };
function status(message, error = false) {
  $('status').textContent = message;
  $('status').classList.toggle('error', error);
  if (error) {
    $('error-message').textContent = message;
    if (!$('error-dialog').open) $('error-dialog').showModal();
  }
}
function render() {
  $('queue').replaceChildren();
  $('count').textContent = queue.length;
  for (const [index, ref] of queue.entries()) {
    const li = document.createElement('li');
    const remove = document.createElement('button'); remove.className = 'link'; remove.textContent = 'Remove'; remove.ariaLabel = `Remove ${ref.title}`;
    remove.addEventListener('click', () => { queue.splice(index, 1); render(); });
    const title = document.createElement('strong'); title.textContent = `${index + 1}. ${ref.title}`;
    li.append(remove, title);
    const details = document.createElement('p'); details.textContent = `${ref.authors.map(a => [a.last_name, a.first_name].filter(Boolean).join(', ')).join('; ')} · ${ref.year} · ${ref.reference_type.replaceAll('_', ' ')}`; li.append(details);
    const metadata = document.createElement('p'); metadata.textContent = typeFields[ref.reference_type].map(key => ref[key] && `${labels[key]}: ${ref[key]}`).filter(Boolean).join(' · '); li.append(metadata);
    for (const warning of warnings(ref)) { const note = document.createElement('p'); note.className = 'warning'; note.textContent = warning; li.append(note); }
    $('queue').append(li);
  }
  $('fill').disabled = !ready || !queue.length || working;
}
async function callPage(method, payload) {
  const results = await chrome.scripting.executeScript({ target: { tabId }, func: async (method, payload) => {
    try { return { data: await globalThis.ThesisProCitationAssistant[method](payload) }; }
    catch (error) { return { error: error.message }; }
  }, args: [method, payload ?? null] });
  const result = results[0]?.result;
  if (!result) throw new Error('The page did not respond. Reopen the extension on the proposal page.');
  if (result.error) throw new Error(result.error);
  return result.data;
}
async function connect() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true }); tabId = tab?.id;
    if (!tabId) throw new Error('Open your proposal edit page first.');
    await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
    const result = await callPage('inspect');
    $('destination').textContent = `Connected · ${result.count} existing reference row(s)\n${result.references.slice(0, 5).map(ref => `${ref.number}. ${ref.title}`).join('\n')}${result.count > 5 ? '\n…' : ''}`;
    ready = true;
  } catch (error) {
    $('destination').textContent = `${error.message}\nFor a local HTML file, enable “Allow access to file URLs” in the extension's Chrome details. Imports can still be reviewed here.`;
  }
  render();
}
for (const name of ['import', 'manual']) $(name + '-tab').addEventListener('click', () => {
  for (const option of ['import', 'manual']) { $(option + '-panel').hidden = option !== name; $(option + '-tab').classList.toggle('selected', option === name); $(option + '-tab').setAttribute('aria-pressed', String(option === name)); }
});
function manualFields() {
  $('manual-fields').replaceChildren();
  for (const key of typeFields[$('reference_type').value]) {
    const label = document.createElement('label'); label.htmlFor = key; label.textContent = labels[key];
    const input = document.createElement('input'); input.name = key; input.id = key;
    $('manual-fields').append(label, input);
  }
}
$('reference_type').addEventListener('change', manualFields); manualFields();
$('manual-form').addEventListener('submit', event => {
  event.preventDefault();
  try {
    if (queue.length >= 100) throw new Error('The review queue is limited to 100 references.');
    const data = Object.fromEntries(new FormData(event.target));
    data.authors = data.authors.split(/\r?\n/).filter(line => line.trim()).map(line => { const comma = line.indexOf(','); return { last_name: comma < 0 ? line : line.slice(0, comma), first_name: comma < 0 ? '' : line.slice(comma + 1) }; });
    queue.push(normalize(data)); render(); status('Added to review queue.');
  } catch (error) { status(error.message, true); }
});
$('review').addEventListener('click', () => {
  try { const refs = parseCitations($('source').value); queue = refs; render(); status(`Reviewed ${queue.length} reference(s). This import replaces the previous review queue. Check the details below.`); }
  catch (error) { status(error.message, true); }
});
$('file').addEventListener('change', async () => {
  try { const file = $('file').files[0]; if (!file) return; if (file.size > 2_000_000) throw new Error('Choose a file under 2 MB.'); $('source').value = await file.text(); status('File loaded. Click Review import.'); }
  catch (error) { status(error.message, true); }
});
$('example').addEventListener('click', () => {
  $('source').value = 'TY  - JOUR\nAU  - Dela Cruz, Maria\nPY  - 2026\nTI  - Example reference for testing only\nJO  - Sample Journal\nVL  - 1\nIS  - 2\nSP  - 10\nEP  - 18\nER  -';
  status('Fictional example loaded. Click Review import.');
});
$('clear').addEventListener('click', () => { queue = []; render(); status('Review queue cleared.'); });
$('mode').addEventListener('change', () => { $('existing-options').hidden = $('mode').value !== 'existing'; });
$('fill').addEventListener('click', async () => {
  working = true;
  const controls = [...document.querySelectorAll('input, select, textarea, button')];
  const states = controls.map(control => control.disabled);
  controls.forEach(control => { control.disabled = true; });
  status('Filling the citation form… Keep this popup open until the result appears.');
  try {
    const result = await callPage('fill', { references: queue, mode: $('mode').value, start: Number($('start').value), overwrite: $('overwrite').checked, style: $('style').value });
    status(result.message, !result.ok || Boolean(result.warning));
    // Clear successful batches so a second click cannot accidentally append duplicates.
    if (result.ok) queue = [];
  } catch (error) { status(error.message, true); }
  finally { controls.forEach((control, index) => { control.disabled = states[index]; }); working = false; render(); }
});
connect();
