const form = document.getElementById('add-form');
const hostInput = document.getElementById('host');
const titleInput = document.getElementById('titleSel');
const contentInput = document.getElementById('contentSel');
const statusEl = document.getElementById('status');
const listEl = document.getElementById('sites');
const emptyEl = document.getElementById('empty');

function setStatus(msg, isError = false) {
    statusEl.textContent = msg;
    statusEl.className = isError ? 'error' : '';
}

function patternFor(host) {
    return [`https://${host}/*`, `http://${host}/*`];
}

// Accepts "example.com", "https://www.example.com/book/1", etc. Returns the bare hostname or null.
function normalizeHost(input) {
    let raw = input.trim().toLowerCase();
    if (!raw) return null;
    if (!/^[a-z][a-z0-9+.-]*:\/\//.test(raw)) raw = 'https://' + raw;
    let url;
    try {
        url = new URL(raw);
    } catch {
        return null;
    }
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    const host = url.hostname;
    if (!host.includes('.') || host.includes('*')) return null;
    return host;
}

function isValidSelector(sel) {
    if (!sel) return true;
    try {
        document.createDocumentFragment().querySelector(sel);
        return true;
    } catch {
        return false;
    }
}

async function loadSites() {
    const { sites } = await chrome.storage.sync.get('sites');
    return Array.isArray(sites) ? sites : [];
}

async function render() {
    const sites = await loadSites();
    listEl.replaceChildren();
    emptyEl.hidden = sites.length > 0;

    for (const site of sites) {
        const li = document.createElement('li');
        const info = document.createElement('div');

        const host = document.createElement('div');
        host.className = 'host';
        host.textContent = site.host;
        info.appendChild(host);

        const parts = [];
        if (site.titleSel) parts.push('title: ' + site.titleSel);
        if (site.contentSel) parts.push('text: ' + site.contentSel);
        const granted = await chrome.permissions.contains({ origins: patternFor(site.host) });
        if (!granted) parts.push('access not granted');
        if (parts.length) {
            const sel = document.createElement('div');
            sel.className = 'sel';
            sel.textContent = parts.join(' · ');
            info.appendChild(sel);
        }

        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'danger';
        remove.textContent = 'Remove';
        remove.addEventListener('click', () => removeSite(site.host));

        li.append(info, remove);
        listEl.appendChild(li);
    }
}

async function removeSite(host) {
    const sites = (await loadSites()).filter((s) => s.host !== host);
    await chrome.storage.sync.set({ sites });
    try {
        await chrome.permissions.remove({ origins: patternFor(host) });
    } catch {
        // permission may already be gone
    }
    chrome.runtime.sendMessage({ type: 'sync' });
    setStatus(`Removed ${host}.`);
    render();
}

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    setStatus('');

    const host = normalizeHost(hostInput.value);
    if (!host) {
        setStatus('Enter a valid site address, like example.com.', true);
        return;
    }
    const titleSel = titleInput.value.trim();
    const contentSel = contentInput.value.trim();
    if (!isValidSelector(titleSel) || !isValidSelector(contentSel)) {
        setStatus('One of the selectors is not valid CSS.', true);
        return;
    }

    // Must be called directly from the user gesture (this submit handler).
    let granted = false;
    try {
        granted = await chrome.permissions.request({ origins: patternFor(host) });
    } catch (err) {
        setStatus('Could not request access: ' + err.message, true);
        return;
    }
    if (!granted) {
        setStatus(`Access to ${host} was not granted, so the site was not added.`, true);
        return;
    }

    const sites = (await loadSites()).filter((s) => s.host !== host);
    sites.push({ host, titleSel, contentSel });
    sites.sort((a, b) => a.host.localeCompare(b.host));
    await chrome.storage.sync.set({ sites });
    chrome.runtime.sendMessage({ type: 'sync' });

    form.reset();
    setStatus(`Added ${host}. Reload any open tabs on that site to see the button.`);
    render();
});

render();
