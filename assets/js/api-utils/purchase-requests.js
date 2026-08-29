/**
 * Purchase Requests API helper — /admin/purchase-requests
 * Requires: auth.js (Auth.fetch)
 */
const PurchaseRequests = (function () {
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
        const qs = params.toString();
        return apiFetch('/admin/purchase-requests' + (qs ? '?' + qs : ''));
    }

    async function getOne(id) {
        return apiFetch(`/admin/purchase-requests/${id}`);
    }

    async function getLastPrice(productId) {
        const result = await apiFetch(`/admin/purchase-requests/last-price/${productId}`);
        return result.price;
    }

    async function create(payload) {
        return apiFetch('/admin/purchase-requests', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
    }

    /**
     * POST /admin/purchase-requests/from-alerts
     * payload: { lowStockAlertIds?, expiryAlertIds?, vendorId, reason? }
     * Procurement/Inventory/Finance Integration, Phase 7.
     */
    async function createFromAlerts(payload) {
        return apiFetch('/admin/purchase-requests/from-alerts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
    }

    async function update(id, payload) {
        return apiFetch(`/admin/purchase-requests/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
    }

    async function submit(id) {
        return apiFetch(`/admin/purchase-requests/${id}/submit`, { method: 'POST' });
    }

    async function approve(id, comment) {
        return apiFetch(`/admin/purchase-requests/${id}/approve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ comment: comment || undefined }),
        });
    }

    async function reject(id, reason) {
        return apiFetch(`/admin/purchase-requests/${id}/reject`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason: reason || undefined }),
        });
    }

    return { getAll, getOne, getLastPrice, create, createFromAlerts, update, submit, approve, reject };
})();