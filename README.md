# NovExtractor

A small Chrome extension that exports the web novel chapter you're reading to **Markdown**, **EPUB** or **PDF**.

- **You choose the sites.** It does nothing anywhere until you add a site in its settings, and Chrome asks you to approve access for each one.
- **Runs entirely in your browser.** It only reads the page you already have open. No server, no analytics, no network requests, no accounts.
- **Real EPUB 3 files.** Built in the browser with a tiny built-in ZIP writer. No dependencies and no build step.
- **Works on most reading pages.** It guesses where the chapter text is, and you can give it a CSS selector for any site where it guesses wrong.
- Plain JavaScript (Manifest V3), MIT licensed.

## Install

1. Download or clone this repo.
2. Open `chrome://extensions` and turn on **Developer mode**.
3. Click **Load unpacked** and select the `NovExtractor` folder.

## Use

1. Click the NovExtractor toolbar icon to open settings.
2. Paste the link of a chapter you're reading (for example `https://example.com/book/my-novel/chapter-1`) and click **Add site and grant access**. NovExtractor takes only the site from the link, and Chrome asks you to approve access to it. The rest of the link is ignored and never stored.
3. Open any chapter on that site. A **NovExtractor** button appears in the bottom-right corner (tabs that are already open get it right away).
4. Pick **Download .md**, **Download .epub** or **Save as PDF**.

If the wrong text is exported, open settings, expand **Advanced** and add a **chapter text selector** (and optionally a **title selector**) for that site. Right-click the chapter text, choose *Inspect*, and use the class or id of the element that wraps the chapter, for example `.chapter-content` or `#chapter-body`.

Remove a site in settings and its access is revoked.

## Responsible use

NovExtractor is for **personal offline reading and archiving** of content you are allowed to access.

- It reads only what is already displayed in your browser. It doesn't log in for you, fetch other pages, or bypass paywalls, locked chapters or DRM.
- It ships with **no built-in site list** and is not affiliated with any website.
- You are responsible for following each site's terms of service and the copyright law where you live.
- Please don't redistribute exported chapters. Support the authors and translators whose work you read.

## Permissions

| Permission | Why |
| --- | --- |
| `storage` | Saves your site list and selectors (synced with your Chrome profile). |
| `scripting` | Registers the export button for the sites you added. |
| optional host access | Requested per site, only when you add it. |

## Project structure

```
manifest.json    Manifest V3 config
background.js    Registers the content script for the sites you added
options.html/js  Settings page: add and remove sites, custom selectors
core.js          Chapter detection and Markdown / EPUB / print formatting
zip.js           Minimal ZIP writer used to build the EPUB
content.js       The floating export button
```

## Limitations

- Exports **one chapter at a time**. Bulk export is not supported.
- Chapter detection is a heuristic. Sites that load text in unusual ways may need a custom selector.
- PDF export uses your browser's print dialog (Save as PDF).

## Roadmap

- [x] User-managed site list with per-site permission
- [x] Valid EPUB 3 export (checked with EPUBCheck)
- [x] Markdown and PDF (print) export
- [ ] Screenshots / demo GIF in this README
- [ ] Multi-chapter export (next-chapter button → one EPUB)
- [ ] Optional cover and author metadata in the EPUB
- [ ] Preserve italics, bold and scene breaks in exports
- [ ] "Pick the text on the page" selector tool instead of typing CSS
- [ ] Firefox build
- [ ] Chrome Web Store listing
- [ ] Automated tests for extraction and EPUB output

Ideas and pull requests are welcome. Please open an issue first for anything big.

## License

MIT
