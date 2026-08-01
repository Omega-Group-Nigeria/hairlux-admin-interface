/**
 * Inventory API helper (admin) — /admin/inventory-items
 * Requires: auth.js (Auth.fetch)
 */
const Inventory = (function () {
    const CATEGORY_LABELS = {
        FOR_SALE: 'For Sale',
        INTERNAL_USE: 'Internal Use',
        STORAGE: 'Storage',
    };

    const ALERT_STAGE_COLORS = {
        SUPERVISOR: 'bg-warning-lt',
        OPERATIONS: 'bg-orange-lt',
        MANAGEMENT: 'bg-danger-lt',
    };

    const TRANSFER_STATUS_COLORS = {
        PENDING: 'bg-warning-lt',
        APPROVED: 'bg-azure-lt',
        REJECTED: 'bg-danger-lt',
        COMPLETED: 'bg-success-lt',
    };

    async function jsonFetch(path, options) {
        const res = await Auth.fetch(path, options);
        const raw = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(raw.message || 'Request failed');
        return raw.data || raw;
    }

    /** @param {object} params { branchId?, category?, lowStockOnly?, page?, limit? } */
    async function getAll(params = {}) {
        const q = new URLSearchParams();
        Object.keys(params).forEach((k) => {
            if (params[k] !== undefined && params[k] !== null && params[k] !== '') q.set(k, params[k]);
        });
        const qs = q.toString() ? '?' + q.toString() : '';
        return jsonFetch(`/admin/inventory-items${qs}`);
    }

    async function getOne(id) {
        return jsonFetch(`/admin/inventory-items/${id}`);
    }

    async function create(payload) {
        return jsonFetch('/admin/inventory-items', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
    }

    async function update(id, payload) {
        return jsonFetch(`/admin/inventory-items/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
    }

    function formatMoney(amount) {
        if (amount == null) return '—';
        return '₦' + Number(amount).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    async function adjust(id, payload) {
        return jsonFetch(`/admin/inventory-items/${id}/adjust`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
    }

    async function getAlerts(branchId, resolved) {
        const q = new URLSearchParams();
        if (branchId) q.set('branchId', branchId);
        if (resolved !== undefined) q.set('resolved', String(resolved));
        const qs = q.toString() ? '?' + q.toString() : '';
        return jsonFetch(`/admin/inventory-items/alerts/low-stock${qs}`);
    }

    async function resolveAlert(id) {
        return jsonFetch(`/admin/inventory-items/alerts/low-stock/${id}/resolve`, { method: 'PATCH' });
    }

    async function getExpiryAlerts(branchId, resolved) {
        const q = new URLSearchParams();
        if (branchId) q.set('branchId', branchId);
        if (resolved !== undefined) q.set('resolved', String(resolved));
        const qs = q.toString() ? '?' + q.toString() : '';
        return jsonFetch(`/admin/inventory-items/alerts/expiry${qs}`);
    }

    async function resolveExpiryAlert(id) {
        return jsonFetch(`/admin/inventory-items/alerts/expiry/${id}/resolve`, { method: 'PATCH' });
    }

    async function getTransfers(branchId) {
        const qs = branchId ? `?branchId=${branchId}` : '';
        return jsonFetch(`/admin/inventory-items/transfer-requests${qs}`);
    }

    async function approveTransfer(id) {
        return jsonFetch(`/admin/inventory-items/transfer-requests/${id}/approve`, { method: 'PATCH' });
    }

    async function rejectTransfer(id, reason) {
        return jsonFetch(`/admin/inventory-items/transfer-requests/${id}/reject`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason }),
        });
    }

    async function reassignTransfer(id, toApproverId, reason) {
        return jsonFetch(`/admin/inventory-items/transfer-requests/${id}/reassign`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ toApproverId, reason }),
        });
    }

    async function getAdjustmentRequests(branchId) {
        const qs = branchId ? `?branchId=${branchId}` : '';
        return jsonFetch(`/admin/inventory-items/adjustment-requests${qs}`);
    }

    async function approveAdjustment(id) {
        return jsonFetch(`/admin/inventory-items/adjustment-requests/${id}/approve`, { method: 'PATCH' });
    }

    async function rejectAdjustment(id, reason) {
        return jsonFetch(`/admin/inventory-items/adjustment-requests/${id}/reject`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason }),
        });
    }

    async function reassignAdjustment(id, toApproverId, reason) {
        return jsonFetch(`/admin/inventory-items/adjustment-requests/${id}/reassign`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ toApproverId, reason }),
        });
    }

    function statusBadge(item) {
        if (item.currentQuantity <= 0) return '<span class="badge bg-danger-lt">Out of Stock</span>';
        if (item.currentQuantity <= item.lowStockThreshold) return '<span class="badge bg-warning-lt">Low</span>';
        return '<span class="badge bg-success-lt">Good</span>';
    }

    return {
        getAll, getOne, create, update, adjust,
        getAlerts, resolveAlert,
        getExpiryAlerts, resolveExpiryAlert,
        getTransfers, approveTransfer, rejectTransfer, reassignTransfer,
        getAdjustmentRequests, approveAdjustment, rejectAdjustment, reassignAdjustment,
        CATEGORY_LABELS, ALERT_STAGE_COLORS, TRANSFER_STATUS_COLORS,
        statusBadge, formatMoney,
    };
})();
