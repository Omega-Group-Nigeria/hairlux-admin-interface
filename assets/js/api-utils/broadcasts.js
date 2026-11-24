/**
 * Email & SMS Broadcasts API helper: /admin/broadcasts
 * One email or text message admins send to customers or beauticians, now or
 * scheduled. Separate from Push Notifications and Lifecycle Campaigns.
 * Requires: auth.js (Auth.fetch)
 */
const Broadcasts = (function () {
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

    function jsonBody(method, payload) {
        return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload || {}) };
    }

    function qs(params) {
        const q = new URLSearchParams();
        Object.keys(params || {}).forEach(function (k) {
            if (params[k] !== undefined && params[k] !== null && params[k] !== '') q.set(k, params[k]);
        });
        const s = q.toString();
        return s ? '?' + s : '';
    }

    const base = '/admin/broadcasts';

    return {
        list: (params) => apiFetch(base + qs(params)),
        audience: (channel, audience) => apiFetch(base + '/audience' + qs({ channel, audience })),
        get: (id) => apiFetch(`${base}/${id}`),
        create: (payload) => apiFetch(base, jsonBody('POST', payload)),
        cancel: (id) => apiFetch(`${base}/${id}/cancel`, jsonBody('POST')),
        sendNow: (id) => apiFetch(`${base}/${id}/send-now`, jsonBody('POST')),
    };
})();
