/**
 * Ad Bookings API helper: /admin/ad-bookings (settings, summary, checkouts)
 * and the public landing page config (branches and services for filters).
 * Requires: auth.js (Auth.fetch)
 */
const AdBookings = (function () {
    async function apiFetch(path, options = {}) {
        const res = await Auth.fetch(path, options);
        if (!res) throw new Error('Your session has ended. Please sign in again.');
        const raw = await res.json().catch(() => ({}));
        if (!res.ok) {
            const msg = Array.isArray(raw.message) ? raw.message.join('. ') : raw.message;
            throw new Error(msg || `Request failed (${res.status})`);
        }
        return raw.data !== undefined ? raw.data : raw;
    }

    function qs(params) {
        const q = new URLSearchParams();
        Object.keys(params || {}).forEach(function (k) {
            if (params[k] !== undefined && params[k] !== null && params[k] !== '') q.set(k, params[k]);
        });
        const s = q.toString();
        return s ? '?' + s : '';
    }

    const base = '/admin/ad-bookings';

    return {
        getSettings: () => apiFetch(base + '/settings'),
        saveSettings: (payload) => apiFetch(base + '/settings', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload || {}),
        }),
        summary: (params) => apiFetch(base + '/summary' + qs(params)),
        intents: (params) => apiFetch(base + '/intents' + qs(params)),
        landingConfig: () => apiFetch('/public/ad-bookings/config'),
    };
})();
