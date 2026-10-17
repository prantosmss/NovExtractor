/* It's the background service worker. It keeps the registered content scripts in 
sync with the site list that user manages on the options page. Nothing runs on a site 
until the user adds it in the list and grants the browser permission for it. */

const SCRIPT_PREFIX = 'novextractor-';

chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());

async function getSites() {
    const { sites } = await chrome.storage.sync.get('sites');
    return Array.isArray(sites) ? sites : [];
}

function patternFor(host) {
    return [`https://${host}/*`, `http://${host}/*`];
}

async function syncScripts() {
    const sites = await getSites();
    const granted = [];
    for (const site of sites) {
        const ok = await chrome.permissions.contains({ origins: patternFor(site.host) });
        if (ok) granted.push(site);
    }

    const existing = await chrome.scripting.getRegisteredContentScripts();
    const stale = existing
        .map((s) => s.id)
        .filter((id) => id.startsWith(SCRIPT_PREFIX));
    if (stale.length) await chrome.scripting.unregisterContentScripts({ ids: stale });

    if (!granted.length) return;
    await chrome.scripting.registerContentScripts(
        granted.map((site) => ({
            id: SCRIPT_PREFIX + site.host,
            matches: patternFor(site.host),
            js: ['zip.js', 'core.js', 'content.js'],
            runAt: 'document_idle',
            persistAcrossSessions: true
        }))
    );
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
