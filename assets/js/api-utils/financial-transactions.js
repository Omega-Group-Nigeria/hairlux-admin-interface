/**
 * Financial Transactions API helper: read-only ledger view.
 * Requires: auth.js (Auth.fetch)
 */
const FinancialTransactions = (function () {
    async function apiFetch(path, options = {}) {
        const res = await Auth.fetch(path, options);
        const raw = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(raw.message || `Request failed (${res.status})`);
        return raw.data !== undefined ? raw.data : raw;
    }

    async function getAll(filters, page, limit) {
        filters = filters || {};
        const params = new URLSearchParams();
        if (filters.direction) params.set('direction', filters.direction);
        if (filters.category) params.set('category', filters.category);
        if (filters.branchId) params.set('branchId', filters.branchId);
        if (filters.from) params.set('from', filters.from);
        if (filters.to) params.set('to', filters.to);
        if (filters.paymentMethod) params.set('paymentMethod', filters.paymentMethod);
        if (page) params.set('page', page);
        if (limit) params.set('limit', limit);
        const qs = params.toString();
        return apiFetch('/admin/financial-transactions' + (qs ? '?' + qs : ''));
    }

    async function getSummary(filters) {
        filters = filters || {};
        const params = new URLSearchParams();
        if (filters.branchId) params.set('branchId', filters.branchId);
        if (filters.from) params.set('from', filters.from);
        if (filters.to) params.set('to', filters.to);
        // Optional -- the summary cards then describe the same filtered view as the list.
        if (filters.direction) params.set('direction', filters.direction);
        if (filters.category) params.set('category', filters.category);
        if (filters.paymentMethod) params.set('paymentMethod', filters.paymentMethod);
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
        if (filters.paymentMethod) params.set('paymentMethod', filters.paymentMethod);
        const qs = params.toString();
        return apiFetch('/admin/financial-transactions/export' + (qs ? '?' + qs : ''));
    }

    return { getAll, getSummary, exportAll };
})();