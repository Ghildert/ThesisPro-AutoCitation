export const fields = ['year', 'title', 'journal_name', 'volume', 'issue', 'publisher', 'publisher_location', 'site_name', 'url', 'conference_name', 'conference_location', 'pages', 'doi_or_url'];
export const types = ['journal_article', 'book', 'website', 'conference_paper'];
const typeMap = { 'article-journal': 'journal_article', book: 'book', webpage: 'website', 'paper-conference': 'conference_paper' };
const risTypes = { JOUR: 'journal_article', BOOK: 'book', ELEC: 'website', WEB: 'website', CPAPER: 'conference_paper', CONF: 'conference_paper' };
const clean = value => String(value ?? '').trim();
const first = value => Array.isArray(value) ? value[0] : value;
function link(value) {
  const text = clean(value);
  if (!text) return '';
  if (/^(?:https?:\/\/)?(?:dx\.)?doi\.org\//i.test(text)) return 'https://doi.org/' + text.replace(/^(?:https?:\/\/)?(?:dx\.)?doi\.org\//i, '');
  if (/^(?:doi:\s*)?10\.\d{4,9}\//i.test(text)) return 'https://doi.org/' + text.replace(/^doi:\s*/i, '');
  if (!/^https?:\/\//i.test(text)) throw new Error('Links must be a DOI or an http(s) URL.');
  new URL(text);
  return text;
}
export function normalize(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Each reference must be an object.');
  const csl = Boolean(input.type && !input.reference_type);
  const reference_type = csl ? typeMap[input.type] : input.reference_type;
  if (!types.includes(reference_type)) throw new Error(`Unsupported reference type: ${input.type || input.reference_type || '(missing)'}. Use a journal article, book, webpage, or conference paper.`);
  const ref = Object.fromEntries(fields.map(key => [key, clean(input[key])]));
  ref.reference_type = reference_type;
  if (csl) {
    const date = input.issued?.['date-parts']?.[0]?.[0];
    ref.year = clean(date ?? input.issued?.literal ?? 'n.d.');
    ref.title = clean(first(input.title));
    const container = clean(first(input['container-title']));
    ref.journal_name = reference_type === 'journal_article' ? container : '';
    ref.site_name = reference_type === 'website' ? (container || clean(input.publisher) || ref.site_name) : '';
    ref.conference_name = reference_type === 'conference_paper' ? clean(input['event-title'] || container) : '';
    ref.publisher_location = clean(input['publisher-place']);
    ref.conference_location = clean(input['event-place']);
    ref.pages = clean(input.page);
    ref.url = clean(input.URL);
    ref.doi_or_url = clean(input.DOI || input.URL);
  }
  const authors = csl ? input.author : input.authors;
  if (!Array.isArray(authors)) throw new Error(`“${ref.title || 'Reference'}” needs an authors array.`);
  ref.authors = authors.map(author => ({
    last_name: clean(author.last_name ?? author.family ?? author.literal),
    first_name: clean(author.first_name ?? author.given) === '—' ? '' : clean(author.first_name ?? author.given)
  }));
  if (!ref.title || !ref.year || !ref.authors.length || ref.authors.some(a => !a.last_name)) throw new Error('Every reference needs a title, year (or n.d.), and at least one author with a last name or organization name.');
  if (ref.authors.length > 100) throw new Error('A reference can contain at most 100 authors.');
  ref.url = link(ref.url);
  ref.doi_or_url = link(ref.doi_or_url);
  return ref;
}
function parseRIS(source) {
  const records = [];
  let current = null;
  let previous = '';
  for (const line of source.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    if (!line.trim()) continue;
    const match = line.match(/^([A-Z0-9]{2})\s{2}-\s?(.*)$/);
    if (!match) {
      if (current && previous && /^\s+/.test(line)) current[previous][current[previous].length - 1] += ' ' + line.trim();
      else throw new Error('Invalid RIS line. Expected a two-letter tag followed by two spaces and a dash.');
      continue;
    }
    const [, tag, value] = match;
    if (tag === 'TY') {
      if (current) throw new Error('A RIS record is missing its ER end tag.');
      current = { TY: [value.trim()] };
    } else if (tag === 'ER') {
      if (!current) throw new Error('RIS end tag without a record.');
      records.push(current); current = null;
    } else {
      if (!current) throw new Error('RIS records must start with TY.');
      (current[tag] ??= []).push(value.trim());
    }
    previous = tag;
  }
  if (current) throw new Error('The last RIS record is missing its ER end tag.');
  return records.map(r => {
    const get = (...tags) => tags.map(tag => r[tag]?.[0]).find(Boolean) || '';
    const authorValues = r.AU || r.A1 || [];
    return normalize({
      reference_type: risTypes[get('TY')], title: get('TI', 'T1'), year: get('PY', 'Y1', 'DA').split(/[\/\-]/)[0] || 'n.d.',
      authors: authorValues.map(name => {
        const comma = name.indexOf(',');
        return comma < 0 ? { last_name: name, first_name: '' } : { last_name: name.slice(0, comma), first_name: name.slice(comma + 1) };
      }),
      journal_name: get('JO', 'JF', 'T2', 'JA'), volume: get('VL'), issue: get('IS'), pages: [get('SP'), get('EP')].filter(Boolean).join('–'),
      publisher: get('PB'), publisher_location: get('CY'), site_name: get('T2'), url: get('UR'),
      doi_or_url: get('DO', 'UR'), conference_name: get('T2', 'JO'), conference_location: get('CY')
    });
  });
}
export function parseCitations(source) {
  if (source.length > 2_000_000) throw new Error('Import is too large. Use a file under 2 MB.');
  const text = source.replace(/^\uFEFF/, '').trim();
  if (!text) throw new Error('Paste RIS or CSL-JSON, import a file, or add a manual entry.');
  let refs;
  if (/^[\[{]/.test(text)) {
    let data;
    try { data = JSON.parse(text); } catch { throw new Error('Invalid JSON. Check quotes, commas, and brackets.'); }
    refs = (Array.isArray(data) ? data : [data]).map(normalize);
  } else refs = parseRIS(text);
  if (!refs.length || refs.length > 100) throw new Error('Import between 1 and 100 references at a time.');
  return refs;
}
export function warnings(ref) {
  const issues = [];
  if (ref.authors.some(a => !a.first_name)) issues.push('Author has no given name. If this is an organization, check that the site accepts it.');
  if (!/^(\d{4}|n\.d\.)$/.test(ref.year)) issues.push('Check the publication year.');
  if (ref.reference_type === 'journal_article' && !ref.journal_name) issues.push('Journal name is missing.');
  if (ref.reference_type === 'book' && !ref.publisher) issues.push('Publisher is missing.');
  if (ref.reference_type === 'website' && !ref.url) issues.push('Webpage URL is missing.');
  if (ref.reference_type === 'conference_paper' && !ref.conference_name) issues.push('Conference name is missing.');
  if (ref.reference_type === 'conference_paper' && ref.doi_or_url) issues.push('This form has no conference DOI/URL field; that link will not be entered.');
  return issues;
}
