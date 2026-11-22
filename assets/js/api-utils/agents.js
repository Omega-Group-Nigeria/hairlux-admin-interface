/**
 * Field Agents API helper: /admin/agents
 * Field sales & booking agents: applications and status, results, earnings
 * approval, incentives, wallets and withdrawals, credited customers (disputes),
 * leads, reports, alerts, announcements and settings.
 * Requires: auth.js (Auth.fetch)
 */
const Agents = (function () {
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

    const base = '/admin/agents';

    return {
        overview: () => apiFetch(base + '/overview'),
        report: (period, date) => apiFetch(base + '/reports' + qs({ period, date })),
        getSettings: () => apiFetch(base + '/settings'),
        saveSettings: (payload) => apiFetch(base + '/settings', jsonBody('PATCH', payload)),

        alerts: (params) => apiFetch(base + '/alerts' + qs(params)),
        readAlerts: (ids) => apiFetch(base + '/alerts/read', jsonBody('POST', ids && ids.length ? { ids } : {})),
        announce: (payload) => apiFetch(base + '/announcements', jsonBody('POST', payload)),

        list: (params) => apiFetch(base + qs(params)),
        get: (id) => apiFetch(`${base}/${id}`),
        setStatus: (id, action, reason) => apiFetch(`${base}/${id}/status`, jsonBody('POST', { action, reason: reason || undefined })),
        update: (id, payload) => apiFetch(`${base}/${id}`, jsonBody('PATCH', payload)),
        performance: (id, params) => apiFetch(`${base}/${id}/performance` + qs(params)),
        transactions: (id, params) => apiFetch(`${base}/${id}/transactions` + qs(params)),
        credit: (id, payload) => apiFetch(`${base}/${id}/credit`, jsonBody('POST', payload)),

        days: (params) => apiFetch(base + '/days' + qs(params)),
        reviewDay: (id, action, note) => apiFetch(`${base}/days/${id}/review`, jsonBody('POST', { action, note: note || undefined })),

        withdrawals: (params) => apiFetch(base + '/withdrawals' + qs(params)),
        approveWithdrawal: (id) => apiFetch(`${base}/withdrawals/${id}/approve`, { method: 'POST' }),
        rejectWithdrawal: (id, reason) => apiFetch(`${base}/withdrawals/${id}/reject`, jsonBody('POST', { reason })),
        markPaid: (id, reference) => apiFetch(`${base}/withdrawals/${id}/mark-paid`, jsonBody('POST', { reference })),
        markFailed: (id, reason) => apiFetch(`${base}/withdrawals/${id}/mark-failed`, jsonBody('POST', { reason })),
        resync: (id) => apiFetch(`${base}/withdrawals/${id}/resync`, { method: 'POST' }),

        leads: (params) => apiFetch(base + '/leads' + qs(params)),
        customers: (params) => apiFetch(base + '/customers' + qs(params)),
        assignCustomer: (payload) => apiFetch(base + '/customers', jsonBody('POST', payload)),
        customerAction: (id, payload) => apiFetch(`${base}/customers/${id}/action`, jsonBody('POST', payload)),
        checkBookings: () => apiFetch(base + '/check-bookings', { method: 'POST' }),
    };
})();
