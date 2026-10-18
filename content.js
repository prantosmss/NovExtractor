// NovExtractor content script: floating export button.
// Injected only on sites the user added in the options page.
(async () => {
    // The script can be injected more than once (registered script + injection into
    // an already-open tab). Only the first run builds the button.
    if (globalThis.__novExtractorLoaded || document.getElementById('novextractor-container')) return;
    globalThis.__novExtractorLoaded = true;
    const { extract, toMarkdown, toPrintHtml, epubFiles } = globalThis.NovCore;

    // Per-site settings (optional CSS selectors) saved on the options page.
    const bare = (h) => h.replace(/^www\./, '');
    let siteConfig = {};
    try {
        const { sites } = await chrome.storage.sync.get('sites');
        siteConfig = (sites || []).find((s) => bare(s.host) === bare(location.hostname)) || {};
    } catch (err) {
        // Settings unreadable (e.g. the extension was just reloaded): keep the empty
        // config so automatic chapter detection still works.
        console.warn('[NovExtractor] Could not read site settings, using auto-detection:', err);
    }

    const host = document.createElement('div');
    host.id = 'novextractor-container';
    host.style.cssText = 'position:fixed;bottom:30px;right:30px;z-index:2147483647;';
    // Shadow DOM keeps the page's CSS from restyling the widget (and vice versa).
    const root = host.attachShadow({ mode: 'closed' });

    root.innerHTML = `
        <style>
            :host { all: initial; }
            .wrap { position: relative; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
            .main {
                background: #014bb9; color: #fff; border: none; padding: 12px 20px;
                font-weight: 600; font-size: 15px; font-family: inherit; border-radius: 50px;
                box-shadow: 0 4px 15px rgba(0,0,0,.25); cursor: pointer;
                transition: background .2s, transform .2s;
            }
            .main:hover { background: #0257d6; transform: translateY(-2px); }
            .menu {
                display: none; position: absolute; bottom: 55px; right: 0; background: #fff;
                box-shadow: 0 8px 24px rgba(0,0,0,.2); border-radius: 12px; overflow: hidden;
                min-width: 180px; flex-direction: column;
            }
            .menu.open { display: flex; }
            .opt {
                background: none; border: none; padding: 12px 16px; text-align: left;
                font-weight: 500; font-size: 14px; font-family: inherit; color: #333; cursor: pointer; width: 100%;
            }
            .opt:hover { background: #f3f4f6; }
            .toast {
                position: absolute; bottom: 55px; right: 0; width: 260px; background: #1b1f24; color: #fff;
                padding: 10px 14px; border-radius: 10px; font-size: 13px; line-height: 1.4; display: none;
                box-shadow: 0 8px 24px rgba(0,0,0,.3);
            }
            .toast.show { display: block; }
        </style>
        <div class="wrap">
            <div class="toast" role="status"></div>
            <div class="menu">
                <button class="opt" data-act="md">Download .md</button>
                <button class="opt" data-act="epub">Download .epub</button>
                <button class="opt" data-act="pdf">Save as PDF</button>
            </div>
            <button class="main" aria-haspopup="true">NovExtractor ▾</button>
        </div>`;

    const menu = root.querySelector('.menu');
    const toast = root.querySelector('.toast');
    let toastTimer;

    const showToast = (msg) => {
        toast.textContent = msg;
        toast.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toast.classList.remove('show'), 6000);
    };

    const download = (blob, filename) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 10000);
    };

    const actions = {
        md(data) {
            download(new Blob([toMarkdown(data)], { type: 'text/markdown;charset=utf-8' }), data.safeFilename + '.md');
        },
        epub(data) {
            const blob = globalThis.NovZip.build(epubFiles(data, document.documentElement.lang));
            download(blob, data.safeFilename + '.epub');
        },
        pdf(data) {
            const win = window.open('', '_blank', 'width=800,height=900');
            if (!win) {
                showToast('Popup blocked. Allow popups for this site to save as PDF.');
                return;
            }
            win.document.write(toPrintHtml(data));
            win.document.close();
            setTimeout(() => win.print(), 500);
        }
    };

    root.querySelector('.main').addEventListener('click', (e) => {
        e.stopPropagation();
        menu.classList.toggle('open');
    });
    document.addEventListener('click', () => menu.classList.remove('open'));

    menu.addEventListener('click', (e) => {
        const btn = e.target.closest('.opt');
        if (!btn) return;
        e.stopPropagation();
        menu.classList.remove('open');

        const data = extract(document, siteConfig);
        if (!data.found) {
            showToast('Could not find the chapter text on this page. Open NovExtractor settings and set a text selector for this site.');
            return;
        }
        actions[btn.dataset.act](data);
    });

    document.body.appendChild(host);
})();
