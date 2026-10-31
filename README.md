# ThesisPro AutoCitation

A Google Chrome extension that imports reference metadata and fills the citation section of a ThesisPro proposal. Review your references before filling the form, then save through ThesisPro when ready.

Developed by [Ghildert](https://github.com/Ghildert) with assistance from [ChatGPT](https://chatgpt.com/).

## 1. Download the project

1. On this repository, click **Code → Download ZIP**.
2. Extract the ZIP to a permanent folder on your computer.
3. Keep the extracted folder: Chrome loads the extension from it.

Alternatively, clone the repository:

```sh
git clone https://github.com/Ghildert/ThesisPro-AutoCitation.git
cd ThesisPro-AutoCitation
```

No Node.js installation, npm command, build step, or API key is needed to use the extension.

## 2. Install the extension in Chrome

1. Open `chrome://extensions` in Google Chrome.
2. Turn on **Developer mode** in the upper right.
3. Click **Load unpacked**.
4. Select the **extension** folder inside the extracted project. Select the folder that directly contains `manifest.json`.
5. Pin **ThesisPro Citation Assistant** from Chrome's Extensions menu.

If Chrome reports **Manifest file is missing or unreadable**, select the `extension` subfolder instead of the project folder. If you move the files later, load the extension again from its new location.

## 3. Run the LLM conversion prompt

For a reference list written as bibliographic text, complete this step before importing. The LLM script is the reusable prompt in [LLM-CITATION-CONVERTER.md](LLM-CITATION-CONVERTER.md). Run it by sending its contents to an LLM chat; it is not a terminal or Python script. The extension does not run an LLM itself.

1. Open [LLM-CITATION-CONVERTER.md](LLM-CITATION-CONVERTER.md). On GitHub, use **Raw** to view the complete plain text, or open the downloaded file in a text editor.
2. Copy the **entire file**.
3. Open a new conversation in ChatGPT or another LLM chat and paste the copied prompt as your first message. Send it.
4. Wait for the LLM to ask for your RRL/RRS reference list.
5. In your **next message**, paste your complete bibliographic entries, including authors, titles, publication dates, and any DOI or source URLs. In-text citations alone are insufficient. If sending multiple parts, tell the LLM first and say when the list is complete.
6. Wait for the JSON array and conversion report. Review rejected entries, metadata uncertainties, and source corrections against your original references. Resolve missing information before continuing.
7. Copy **only the JSON array**, starting with `[` and ending with `]`. Exclude the code fences and conversion report. You may save it as a UTF-8 file named `references.json` or paste it directly into the extension.
8. For more than 100 references, handle each batch separately. An empty array (`[]`) contains no importable references; resolve the reported problems first.

The prompt asks a browsing-capable LLM to verify source metadata. If browsing is unavailable, it should report that the metadata was not independently verified. Always check the output yourself.

If you already have a RIS or CSL-JSON export from a reference manager such as Zotero, you can import that directly in step 4. Manual entry is also available.

## 4. Import and review your references

1. Sign in to ThesisPro and open the live **edit proposal** page containing the reference form.
2. Open **ThesisPro Citation Assistant** from Chrome's toolbar.
3. Paste the LLM's JSON array into the import text area, or choose your `.json` file. The same area also accepts RIS and CSL-JSON exports.
4. Click **Review import**.
5. Check every author, year, title, metadata field, and warning in the review queue. Use **Remove** to discard an entry. To correct imported metadata, edit the source and review it again, or remove the entry and recreate it through **Manual entry**.

A new import replaces the review queue. Manual entries append to it. Closing the popup clears the queue, so keep the popup open until the fill result appears.

## 5. Fill the ThesisPro form and save

1. Choose a citation style. **APA 7** is selected by default; **APA 6** and **Keep the page's current style** are also available. The style selector applies to every reference on the page.
2. Choose a destination:
   - **Append new references** preserves existing entries and uses ThesisPro's Add Reference button for each new item.
   - **Fill from reference number (adds missing rows)** starts at your selected reference number and adds rows as needed. To replace occupied rows, enable **Replace all citation fields in the selected rows**. Replacement clears unused citation fields and removes surplus authors in those rows.
3. Click **Fill references on this page** and keep the popup open until the result appears.
4. Inspect the filled fields and ThesisPro's citation previews. The website formats and validates the final references.
5. Use **ThesisPro's own Save control** when you are satisfied. The extension does not save or submit the proposal.

A successful fill clears the queue to prevent duplicate filling. If a fill fails, inspect the page for partially filled or newly added rows before retrying.

## Supported input and limitations

- Reference types: journal article, book, website/webpage, and conference paper.
- Import formats: RIS, CSL-JSON, and the native JSON generated by the LLM prompt.
- Limits: up to 100 references per import, 100 authors per reference, and input under 2 MB.
- Raw APA paragraphs, BibTeX, PDFs, and DOI-only lookups require conversion before import. The extension does not look up metadata.
- Unsupported reference types, such as theses, dissertations, datasets, software, and preprints, should be handled separately. Do not relabel them just to import them.
- Organization authors are preserved in the last-name field with an empty first name. ThesisPro may reject that empty field; review its validation.
- The native JSON transfers only the publication year. Full webpage dates and article numbers need separate review. The target form has no conference DOI/URL field.
- APA 7 selection does not guarantee complete APA 7 formatting. Review the website's output against your institution's requirements.

## Troubleshooting

- **The extension cannot find the reference form:** open the live ThesisPro edit proposal page, select that tab, and reopen the popup. Chrome's internal pages cannot be used as a destination.
- **Invalid JSON:** copy only the JSON array, without Markdown fences, comments, or the LLM's report. Correct the source and click **Review import** again.
- **Add Reference or Add author is unavailable:** the extension depends on the live website's functioning buttons and scripts. Reload the live page and inspect any partial changes before retrying.
- **The queue disappeared:** closing the popup clears it. Reimport the JSON after checking whether the previous operation already filled any rows.

## Access and privacy

The extension uses Chrome's `activeTab` and `scripting` permissions. It has no permanent host permissions, background scripts, remote libraries, analytics, network requests, or persistent citation storage. It fills citation controls and uses the website's reference and author buttons.

The LLM conversion is a separate step: anything you paste into an LLM chat is processed by that service under its own settings and policies.

## Included files

`extension/` contains the six files needed to run the extension. `LLM-CITATION-CONVERTER.md` contains the conversion prompt. This README explains installation and use. See `LICENSE` for the repository's MIT license.
