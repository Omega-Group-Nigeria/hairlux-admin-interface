/**
 * Push Notifications API helper: /admin/push-campaigns
 * Notifications admins send to the customer and beautician apps, now or
 * scheduled. Separate from Lifecycle Campaigns.
 * Requires: auth.js (Auth.fetch)
 */
const PushCampaigns = (function () {
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

    const base = '/admin/push-campaigns';

    return {
        list: (params) => apiFetch(base + qs(params)),
        audience: (audience, platform) => apiFetch(base + '/audience' + qs({ audience, platform })),
        get: (id) => apiFetch(`${base}/${id}`),
        create: (payload) => apiFetch(base, jsonBody('POST', payload)),
        cancel: (id) => apiFetch(`${base}/${id}/cancel`, jsonBody('POST')),
        sendNow: (id) => apiFetch(`${base}/${id}/send-now`, jsonBody('POST')),
    };
})();
