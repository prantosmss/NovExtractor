// NovExtractor background service worker.
// Keeps the registered content scripts in sync with the site list the user
// manages on the options page. Nothing runs on a site until the user adds it
// AND grants the browser permission for it.

const SCRIPT_PREFIX = 'novextractor-';
const SCRIPT_FILES = ['zip.js', 'core.js', 'content.js'];

chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());

// "example.com" and "www.example.com" are treated as the same site, so a link
// pasted with or without "www" works either way.
function hostVariants(host) {
    const variants = new Set([host]);
    if (host.startsWith('www.')) {
        variants.add(host.slice(4));
    } else if (host.split('.').length === 2) {
        variants.add('www.' + host);
    }
    return [...variants];
}

function patternsFor(host) {
    return hostVariants(host).flatMap((h) => [`https://${h}/*`, `http://${h}/*`]);
}

async function getSites() {
    const { sites } = await chrome.storage.sync.get('sites');
    return Array.isArray(sites) ? sites : [];
}

async function doSync() {
    const sites = await getSites();
    const granted = [];
    for (const site of sites) {
        if (await chrome.permissions.contains({ origins: patternsFor(site.host) })) {
            granted.push(site);
        }
    }

    const existing = await chrome.scripting.getRegisteredContentScripts();
    const stale = existing.map((s) => s.id).filter((id) => id.startsWith(SCRIPT_PREFIX));
    if (stale.length) await chrome.scripting.unregisterContentScripts({ ids: stale });

    if (!granted.length) return;
    await chrome.scripting.registerContentScripts(
        granted.map((site) => ({
            id: SCRIPT_PREFIX + site.host,
            matches: patternsFor(site.host),
            js: SCRIPT_FILES,
            runAt: 'document_idle',
            persistAcrossSessions: true
        }))
    );

    // Registered scripts only apply to pages loaded from now on, so also inject
    // into tabs that are already open on these sites. content.js ignores a
    // second injection, so repeating this is harmless.
    for (const site of granted) {
        let tabs = [];
        try {
            tabs = await chrome.tabs.query({ url: patternsFor(site.host) });
        } catch {
            continue;
        }
        for (const tab of tabs) {
            try {
                await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    files: SCRIPT_FILES
                });
            } catch {
                // tab closed, discarded, or not injectable
            }
        }
    }
}

// Run syncs one at a time. Overlapping runs would try to register the same
// script IDs twice and fail.
let queue = Promise.resolve();
function syncScripts() {
    queue = queue
        .then(doSync)
        .catch((err) => console.error('[NovExtractor] Could not sync site scripts:', err));
    return queue;
}

chrome.runtime.onInstalled.addListener(syncScripts);
chrome.runtime.onStartup.addListener(syncScripts);
chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync' && changes.sites) syncScripts();
});
chrome.permissions.onRemoved.addListener(syncScripts);
chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.type === 'sync') syncScripts();
});
