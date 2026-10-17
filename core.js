// Helper code for chapter extraction and export formatting.
(() => {
    const SKIP_CONTAINERS = 'nav, header, footer, aside, script, style, noscript, form, [role="navigation"], [role="complementary"]';

    function escapeXml(str) {
        return String(str)
            // strip characters that are illegal in XML 1.0
            .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function safeFilename(title) {
        const cleaned = String(title)
            .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_')
            .replace(/\s+/g, ' ')
            .replace(/^[.\s_]+|[.\s_]+$/g, '')
            .slice(0, 80)
            .trim();
        return cleaned || 'chapter';
    }

    function textOf(el) {
        return (el.innerText !== undefined ? el.innerText : el.textContent || '').trim();
    }

    function paragraphsFrom(container) {
        const ps = Array.from(container.querySelectorAll('p'))
            .map(textOf)
            .filter(Boolean);
        if (ps.length) return ps;
        // No <p> tags: fall back to line breaks in the text.
        return textOf(container)
            .split(/\n+/)
            .map((s) => s.trim())
            .filter(Boolean);
    }

    /* Finds the element that most likely holds the chapter: the parent with the most
    paragraph text directly inside it, ignoring navigation, headers, footers, etc. */
    function guessContainer(doc) {
        const scores = new Map();
        for (const p of doc.querySelectorAll('p')) {
            if (p.closest(SKIP_CONTAINERS)) continue;
            const len = textOf(p).length;
            if (!len) continue;
            const parent = p.parentElement;
            if (!parent) continue;
            scores.set(parent, (scores.get(parent) || 0) + len);
        }
        let best = null;
        let bestScore = 0;
        for (const [el, score] of scores) {
            if (score > bestScore) {
                best = el;
                bestScore = score;
            }
        }
        return bestScore >= 200 ? best : null;
    }

    function pageTitle(doc) {
        const h1 = doc.querySelector('h1');
        if (h1 && textOf(h1)) return textOf(h1);
        const og = doc.querySelector('meta[property="og:title"]');
        if (og && og.content) return og.content.trim();
        return (doc.title || '').trim() || 'Chapter';
    }

    // config: { titleSel?, contentSel? } from the user's site settings.
    function extract(doc, config = {}) {
        let title = '';
        if (config.titleSel) {
            const el = doc.querySelector(config.titleSel);
            if (el) title = textOf(el);
        }
        if (!title) title = pageTitle(doc);

        let container = null;
        if (config.contentSel) container = doc.querySelector(config.contentSel);
        if (!container) container = guessContainer(doc);

        const paragraphs = container ? paragraphsFrom(container) : [];
        return {
            title,
            paragraphs,
            found: paragraphs.length > 0,
            safeFilename: safeFilename(title)
        };
    }

    function toMarkdown({ title, paragraphs }) {
        return `# ${title}\n\n${paragraphs.join('\n\n')}\n`;
    }

    function toPrintHtml({ title, paragraphs }) {
        const body = paragraphs.map((p) => `<p>${escapeXml(p)}</p>`).join('\n');
        return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${escapeXml(title)}</title>
<style>
body { font-family: Georgia, serif; line-height: 1.8; color: #111; max-width: 700px; margin: 40px auto; padding: 0 20px; }
.instruction-banner { background: #e0f2fe; color: #0369a1; padding: 14px 18px; border-radius: 8px; font-family: sans-serif; font-size: 14px; margin-bottom: 25px; border-left: 4px solid #0284c7; line-height: 1.5; }
h1 { font-size: 22px; border-bottom: 1px solid #ccc; padding-bottom: 10px; margin-bottom: 25px; }
p { margin: 0 0 20px; font-size: 15px; text-align: justify; }
@media print { .instruction-banner { display: none; } }
</style>
</head>
<body>
<div class="instruction-banner">
<strong>How to save as PDF:</strong><br>
1. If the print dialog doesn't open automatically, press <b>Ctrl + P</b> (Windows/Linux) or <b>Cmd + P</b> (Mac).<br>
2. Set the destination to <b>Save as PDF</b> and click <b>Save</b>.
</div>
<h1>${escapeXml(title)}</h1>
${body}
</body>
</html>`;
    }

    function uuid() {
        if (globalThis.crypto && crypto.randomUUID) return crypto.randomUUID();
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = (Math.random() * 16) | 0;
            return (c === 'x' ? r : (r & 3) | 8).toString(16);
        });
    }

    function safeLang(lang) {
        return /^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8})*$/.test(lang || '') ? lang : 'en';
    }

    // Returns the list of files for a valid EPUB 3 package. "mimetype" is first, as the spec requires.
    function epubFiles({ title, paragraphs }, lang = 'en', now = new Date()) {
        const modified = now.toISOString().replace(/\.\d{3}Z$/, 'Z');
        const id = 'urn:uuid:' + uuid();
        const t = escapeXml(title);
        const language = escapeXml(safeLang(lang));
        const body = paragraphs.map((p) => `    <p>${escapeXml(p)}</p>`).join('\n');

        return [
            { name: 'mimetype', data: 'application/epub+zip' },
            {
                name: 'META-INF/container.xml',
                data: `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>
`
            },
            {
                name: 'OEBPS/content.opf',
                data: `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid" xml:lang="${language}">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="bookid">${id}</dc:identifier>
    <dc:title>${t}</dc:title>
    <dc:language>${language}</dc:language>
    <meta property="dcterms:modified">${modified}</meta>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="chapter" href="chapter.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine>
    <itemref idref="chapter"/>
  </spine>
</package>
`
            },
            {
                name: 'OEBPS/nav.xhtml',
                data: `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${language}" lang="${language}">
<head><meta charset="utf-8"/><title>${t}</title></head>
<body>
  <nav epub:type="toc" id="toc">
    <ol>
      <li><a href="chapter.xhtml">${t}</a></li>
    </ol>
  </nav>
</body>
</html>
`
            },
            {
                name: 'OEBPS/chapter.xhtml',
                data: `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="${language}" lang="${language}">
<head><meta charset="utf-8"/><title>${t}</title></head>
<body>
  <h1>${t}</h1>
${body}
</body>
</html>
`
            }
        ];
    }

    globalThis.NovCore = { escapeXml, safeFilename, extract, toMarkdown, toPrintHtml, epubFiles, guessContainer };
})();
