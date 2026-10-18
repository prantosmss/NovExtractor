// Pure helpers: chapter extraction and export formatting. No UI, no network.
(() => {
    // Elements whose contents are never chapter text.
    const ALWAYS_SKIP = new Set([
        'SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'SVG', 'BUTTON', 'SELECT',
        'TEXTAREA', 'INPUT', 'IFRAME', 'CANVAS', 'VIDEO', 'AUDIO', 'OBJECT'
    ]);

    // Elements that start a new line of text.
    const BLOCK_TAGS = new Set([
        'ADDRESS', 'ARTICLE', 'ASIDE', 'BLOCKQUOTE', 'DD', 'DIV', 'DL', 'DT', 'FIELDSET',
        'FIGCAPTION', 'FIGURE', 'FOOTER', 'FORM', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'HEADER',
        'HR', 'LI', 'MAIN', 'NAV', 'OL', 'P', 'PRE', 'SECTION', 'TABLE', 'TBODY', 'TD', 'TFOOT',
        'TH', 'THEAD', 'TR', 'UL'
    ]);

    // Areas to ignore, from strictest to loosest. If the strict pass finds no chapter
    // (for example because the whole reader sits inside an element with "comment" in its
    // class name), the next, looser pass is tried.
    const SKIP_LEVELS = [
        'nav, header, footer, aside, [role="navigation"], [role="complementary"], [class*="comment"], [id*="comment"]',
        'nav, header, footer, aside, [role="navigation"], [role="complementary"]',
        ''
    ];

    function escapeXml(str) {
        return String(str)
            // strip characters that are illegal in XML 1.0
            .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
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

    // Reads the text under `root` as a list of blocks, one per line of text on the page.
    // Works whether paragraphs are <p>, <div>, <span> or separated by <br>.
    // Returns [{ el, text, heading }] where `el` is the block element that held the text.
    function walk(root, skipSel) {
        const view = root.ownerDocument.defaultView;
        const blocks = [];
        let buf = '';
        let owner = null;

        const flush = () => {
            const text = buf.replace(/\s+/g, ' ').trim();
            if (text) {
                blocks.push({ el: owner, text, heading: /^H[1-6]$/.test(owner.tagName) });
            }
            buf = '';
            owner = null;
        };

        const visit = (node, ctx) => {
            if (node.nodeType === 3) {
                if (!owner) owner = ctx;
                buf += node.nodeValue;
                return;
            }
            if (node.nodeType !== 1) return;

            const tag = node.tagName.toUpperCase();
            if (ALWAYS_SKIP.has(tag)) return;
            if (node !== root && skipSel && node.matches(skipSel)) return;
            if (node.hidden) return;

            let display = '';
            if (view && view.getComputedStyle) {
                const cs = view.getComputedStyle(node);
                if (cs.display === 'none' || cs.visibility === 'hidden') return;
                display = cs.display || '';
            }
            if (tag === 'BR') {
                flush();
                return;
            }
            const isBlock = BLOCK_TAGS.has(tag) ||
                (display !== '' && !display.startsWith('inline') && display !== 'contents');

            if (isBlock) flush();
            const next = isBlock ? node : ctx;
            for (let child = node.firstChild; child; child = child.nextSibling) visit(child, next);
            if (isBlock) flush();
        };

        visit(root, root);
        flush();
        return blocks;
    }

    // Plain text of one element (used for titles), without scripts, buttons, etc.
    function cleanText(el) {
        return walk(el, '').map((b) => b.text).join(' ').trim();
    }

    // Finds the element that holds the whole chapter. Chapters are often split into several
    // sections with ads or headings in between, so picking the single biggest block loses
    // text. Instead: add each text block's length to every ancestor, then take the smallest
    // element that contains most (85%+) of the page's text. Above 50% there can only be one
    // nested chain of candidates, so "smallest" is well defined.
    const MAIN_SHARE = 0.85;
    const MIN_CHARS = 200;
    const MIN_BLOCK = 25; // short UI labels do not count toward the score

    function findContainer(doc) {
        if (!doc.body) return null;
        for (const skipSel of SKIP_LEVELS) {
            const scores = new Map();
            let total = 0;
            for (const block of walk(doc.body, skipSel)) {
                const len = block.text.length;
                if (len < MIN_BLOCK) continue;
                total += len;
                for (let el = block.el; el; el = el.parentElement) {
                    scores.set(el, (scores.get(el) || 0) + len);
                }
            }
            if (total < MIN_CHARS) continue;

            let best = null;
            let bestDepth = -1;
            for (const [el, score] of scores) {
                if (score < total * MAIN_SHARE) continue;
                let depth = 0;
                for (let n = el; n.parentElement; n = n.parentElement) depth++;
                if (depth > bestDepth) {
                    best = el;
                    bestDepth = depth;
                }
            }
            if (best) return { container: best, skipSel };
        }
        return null;
    }

    function guessContainer(doc) {
        const found = findContainer(doc);
        return found ? found.container : null;
    }

    function pageTitle(doc) {
        const h1 = doc.querySelector('h1');
        if (h1 && cleanText(h1)) return cleanText(h1);
        const og = doc.querySelector('meta[property="og:title"]');
        if (og && og.content) return og.content.trim();
        return (doc.title || '').trim() || 'Chapter';
    }

    // The closest heading that comes before the chapter text, e.g. "Chapter 1: ...".
    function headingBefore(doc, container) {
        let found = '';
        for (const h of doc.querySelectorAll('h1, h2, h3')) {
            if (h.closest(SKIP_LEVELS[1])) continue;
            if (!(container.compareDocumentPosition(h) & 2)) continue; // 2 = h comes before container
            const text = cleanText(h);
            if (text && text.length <= 200) found = text;
        }
        return found;
    }

    // When most of the chapter is real <p> paragraphs, keep just those and headings, so ads
    // and labels between sections are left out. Pages that don't use <p> keep every block.
    function preferParagraphs(blocks) {
        let total = 0;
        let inParagraphs = 0;
        for (const b of blocks) {
            total += b.text.length;
            if (b.el.tagName === 'P' || b.el.closest('p')) inParagraphs += b.text.length;
        }
        if (!total || inParagraphs / total < 0.6) return blocks;
        return blocks.filter((b) => b.heading || b.el.tagName === 'P' || b.el.closest('p'));
    }

    // config: { titleSel?, contentSel? } from the user's site settings.
    function extract(doc, config = {}) {
        let container = null;
        let skipSel = SKIP_LEVELS[1];
        if (config.contentSel) {
            container = doc.querySelector(config.contentSel);
            skipSel = '';
        }
        if (!container) {
            const found = findContainer(doc);
            if (found) {
                container = found.container;
                skipSel = found.skipSel;
            }
        }

        let blocks = container ? preferParagraphs(walk(container, skipSel)) : [];

        let title = '';
        if (config.titleSel) {
            const el = doc.querySelector(config.titleSel);
            if (el) title = cleanText(el);
        }
        // A heading at the very start of the chapter text is the chapter title.
        if (blocks.length && blocks[0].heading && blocks[0].text.length <= 200 &&
            (!title || title === blocks[0].text)) {
            title = blocks[0].text;
            blocks = blocks.slice(1);
        }
        if (!title && container) title = headingBefore(doc, container);
        if (!title) title = pageTitle(doc);

        const paragraphs = blocks.map((b) => b.text);
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
