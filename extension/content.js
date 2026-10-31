/* Runs only after the user invokes the extension. No site APIs or form submission. */
globalThis.ThesisProCitationAssistant ||= (() => {
  const selector = '#reference-blocks';
  const blocks = () => [...document.querySelectorAll(`${selector} [data-reference-block]`)];
  const field = (block, name) => block.querySelector(`[name$="-${name}"]`);
  const occupied = block => [...block.querySelectorAll('input')].some(input => input.value.trim());
  function setValue(input, value) {
    if (!input || input.disabled || input.readOnly) throw new Error('A citation field is missing or locked. Refresh the page and try again.');
    const prototype = input.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }
  async function clickAndWait(button, check, description) {
    if (!button || button.disabled) throw new Error(`${description} is unavailable on this page.`);
    button.click();
    const deadline = Date.now() + 1800;
    while (Date.now() < deadline) {
      if (check()) return;
      await new Promise(resolve => setTimeout(resolve, 30));
    }
    throw new Error(`${description} did not update the form. The saved HTML may be missing the site's scripts. Open the live edit page, or use existing rows and author slots.`);
  }
  const typeFields = {
    journal_article: ['journal_name', 'volume', 'issue', 'pages', 'doi_or_url'],
    book: ['publisher', 'publisher_location', 'doi_or_url'],
    website: ['site_name', 'url'],
    conference_paper: ['conference_name', 'conference_location', 'pages']
  };
  function inspect() {
    if (!document.querySelector(selector) || !document.querySelector('#citation_style')) throw new Error('No supported ThesisPro citation form found. Open an edit proposal page.');
    return { count: blocks().length, references: blocks().map((block, index) => ({ number: index + 1, title: field(block, 'title')?.value || '(empty)', occupied: occupied(block) })) };
  }
  let busy = false;
  async function fill({ references, mode, start, overwrite, style = 'apa7' }) {
    if (busy) throw new Error('A fill is already in progress.');
    inspect();
    if (!Array.isArray(references) || !references.length || references.length > 100 || !['append', 'existing'].includes(mode) || !['keep', 'apa7', 'apa6'].includes(style)) throw new Error('Invalid fill request.');
    if (references.some(ref => !typeFields[ref.reference_type] || !ref.title || !Array.isArray(ref.authors) || !ref.authors.length)) throw new Error('Invalid reference data.');
    const initial = blocks();
    if (mode === 'existing') {
      if (!Number.isInteger(start) || start < 1 || start > initial.length + 1) throw new Error('Choose an existing reference number or the next row after the last reference.');
      if (!overwrite && initial.slice(start - 1, start - 1 + references.length).some(occupied)) throw new Error('The selected rows contain data. Enable replacement after reviewing the destination.');
    }
    busy = true;
    let completed = 0;
    let needsOrganizationSupport = false;
    try {
      for (const ref of references) {
        let block;
        if (mode === 'append' || start - 1 + completed >= blocks().length) {
          const before = blocks();
          const add = document.querySelector(selector).parentElement.querySelector('[data-add-reference]');
          await clickAndWait(add, () => blocks().length === before.length + 1, 'Add Reference');
          block = blocks().find(item => !before.includes(item));
        } else block = blocks()[start - 1 + completed];
        const names = ['reference_type', 'year', 'title', ...typeFields[ref.reference_type]];
        for (const name of names) {
          const input = field(block, name);
          if (!input || input.disabled || input.readOnly) throw new Error(`The ${name} field is missing or locked.`);
        }
        const authorRows = () => [...block.querySelectorAll('[data-author-row]')];
        // Only the site's own controls create/remove rows, preserving its indexing and listeners.
        while (authorRows().length < ref.authors.length) {
          const count = authorRows().length;
          await clickAndWait(block.querySelector('[data-add-author]'), () => authorRows().length === count + 1, 'Add author');
        }
        while (authorRows().length > ref.authors.length) {
          const count = authorRows().length;
          await clickAndWait(authorRows().at(-1).querySelector('[data-remove-author]'), () => authorRows().length === count - 1, 'Remove author');
        }
        setValue(field(block, 'reference_type'), ref.reference_type);
        ref.authors.forEach((author, index) => {
          setValue(field(authorRows()[index], 'last_name'), author.last_name);
          setValue(field(authorRows()[index], 'first_name'), author.first_name);
          if (!author.first_name && field(authorRows()[index], 'first_name').required) needsOrganizationSupport = true;
        });
        // Clear stale fields from a previous reference type, within this block only.
        for (const name of ['year', 'title', ...new Set(Object.values(typeFields).flat())]) {
          const input = field(block, name);
          if (input && !input.disabled && !input.readOnly) setValue(input, names.includes(name) ? (ref[name] || '') : '');
        }
        completed++;
      }
      if (style !== 'keep') setValue(document.querySelector('#citation_style'), style);
      const warning = needsOrganizationSupport ? 'Organization authors have no first name in APA 7. Their First name fields were left blank. ThesisPro requires these fields, so it needs organization-author support before these entries can be saved correctly. Do not add a dash or invented name.' : '';
      return { ok: true, completed, warning, message: `Filled ${completed} reference${completed === 1 ? '' : 's'}. ${warning || 'Review the page and save using ThesisPro when ready.'}` };
    } catch (error) {
      return { ok: false, completed, message: `${completed} reference(s) fully filled. ${error.message} Check the form for any partially changed or added rows before retrying. Nothing was submitted.` };
    } finally { busy = false; }
  }
  return { inspect, fill };
})();
