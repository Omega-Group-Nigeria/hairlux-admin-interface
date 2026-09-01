/**
 * Financial Transactions API helper — read-only ledger view.
 * Requires: auth.js (Auth.fetch)
 */
const FinancialTransactions = (function () {
    async function apiFetch(path, options = {}) {
        const res = await Auth.fetch(path, options);
        const raw = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(raw.message || `Request failed (${res.status})`);
        return raw.data !== undefined ? raw.data : raw;
    }

    async function getAll(filters, page) {
        filters = filters || {};
        const params = new URLSearchParams();
        if (filters.direction) params.set('direction', filters.direction);
        if (filters.category) params.set('category', filters.category);
        if (filters.branchId) params.set('branchId', filters.branchId);
        if (filters.from) params.set('from', filters.from);
        if (filters.to) params.set('to', filters.to);
        if (page) params.set('page', page);
        const qs = params.toString();
        return apiFetch('/admin/financial-transactions' + (qs ? '?' + qs : ''));
    }

    async function getSummary(filters) {
        filters = filters || {};
        const params = new URLSearchParams();
        if (filters.branchId) params.set('branchId', filters.branchId);
        if (filters.from) params.set('from', filters.from);
        if (filters.to) params.set('to', filters.to);
        const qs = params.toString();
        return apiFetch('/admin/financial-transactions/summary' + (qs ? '?' + qs : ''));
    }

    async function exportAll(filters) {
        filters = filters || {};
        const params = new URLSearchParams();
        if (filters.direction) params.set('direction', filters.direction);
        if (filters.category) params.set('category', filters.category);
        if (filters.branchId) params.set('branchId', filters.branchId);
        if (filters.from) params.set('from', filters.from);
        if (filters.to) params.set('to', filters.to);
        const qs = params.toString();
        return apiFetch('/admin/financial-transactions/export' + (qs ? '?' + qs : ''));
    }

    return { getAll, getSummary, exportAll };
})();