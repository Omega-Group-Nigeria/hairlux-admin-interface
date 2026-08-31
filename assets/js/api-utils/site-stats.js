/**
 * Site Stats API helper — /admin/site-stats
 * Requires: auth.js (Auth.fetch)
 */
const SiteStats = (function () {
    async function apiFetch(path, options = {}) {
        const res = await Auth.fetch(path, options);
        const raw = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(raw.message || `Request failed (${res.status})`);
        return raw.data !== undefined ? raw.data : raw;
    }

    async function getStats() {
        return apiFetch('/admin/site-stats');
    }

    async function setStats(payload) {
        return apiFetch('/admin/site-stats', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
    }

    return { getStats, setStats };
})();