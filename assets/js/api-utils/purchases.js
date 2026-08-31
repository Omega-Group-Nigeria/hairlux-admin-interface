/**
 * Purchases API helper — /admin/purchases
 * Requires: auth.js (Auth.fetch)
 */
const Purchases = (function () {
    async function apiFetch(path, options = {}) {
        const res = await Auth.fetch(path, options);
        const raw = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(raw.message || `Request failed (${res.status})`);
        return raw.data !== undefined ? raw.data : raw;
    }

    async function getAll(filters) {
        filters = filters || {};
        const params = new URLSearchParams();
        if (filters.branchId) params.set('branchId', filters.branchId);
        if (filters.vendorId) params.set('vendorId', filters.vendorId);
        if (filters.status) params.set('status', filters.status);
        if (filters.search) params.set('search', filters.search);
        if (filters.from) params.set('from', filters.from);
        if (filters.to) params.set('to', filters.to);
        const qs = params.toString();
        return apiFetch('/admin/purchases' + (qs ? '?' + qs : ''));
    }

    async function getOne(id) {
        return apiFetch(`/admin/purchases/${id}`);
    }

    async function recordPayment(id, payload) {
        return apiFetch(`/admin/purchases/${id}/payments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
    }

    async function receiveGoods(id, payload) {
        return apiFetch(`/admin/purchases/${id}/receive`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
    }

    return { getAll, getOne, recordPayment, receiveGoods };
})();