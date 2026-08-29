/**
 * Reports API helper — /admin/reports
 * Procurement/Inventory/Finance Integration, Phase 8.
 * Requires: auth.js (Auth.fetch)
 */
const Reports = (function () {
    async function apiFetch(path, options = {}) {
        const res = await Auth.fetch(path, options);
        const raw = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(raw.message || `Request failed (${res.status})`);
        return raw.data !== undefined ? raw.data : raw;
    }

    async function getProfitability(filters) {
        filters = filters || {};
        const params = new URLSearchParams();
        if (filters.branchId) params.set('branchId', filters.branchId);
        if (filters.from) params.set('from', filters.from);
        if (filters.to) params.set('to', filters.to);
        const qs = params.toString();
        return apiFetch('/admin/reports/profitability' + (qs ? '?' + qs : ''));
    }

    return { getProfitability };
})();