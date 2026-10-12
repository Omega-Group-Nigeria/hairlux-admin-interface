/**
 * Academy Enrolments API helper: /admin/academy/enrolments (settings, summary,
 * checkouts), recording a training balance paid at the branch, and the public
 * enrolment page config (trainings, classes, courses and branches for filters
 * and the link builder).
 * Requires: auth.js (Auth.fetch)
 */
const AcademyEnrolments = (function () {
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

    const base = '/admin/academy/enrolments';
    const json = (method, payload) => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload || {}) });

    return {
        getSettings: () => apiFetch(base + '/settings'),
        saveSettings: (payload) => apiFetch(base + '/settings', json('PUT', payload)),
        summary: (params) => apiFetch(base + '/summary' + qs(params)),
        list: (params) => apiFetch(base + qs(params)),
        /** A training balance taken at the branch: { method: CASH|BANK_TRANSFER|POS|CARD, amount?, note? } */
        recordBalance: (registrationId, payload) => apiFetch('/admin/academy/registrations/' + encodeURIComponent(registrationId) + '/balance-payment', json('POST', payload)),
        publicConfig: () => apiFetch('/public/academy/enrolment/config'),
    };
})();
