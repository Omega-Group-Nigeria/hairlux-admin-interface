/**
 * Inventory API helper (staff self-service) — /staff/me/inventory-items
 * Requires: auth.js (Auth.fetch)
 */
const InventorySelf = (function () {
    const CATEGORY_LABELS = {
        FOR_SALE: 'For Sale',
        INTERNAL_USE: 'Internal Use',
        STORAGE: 'Storage',
    };

    async function jsonFetch(path, options) {
        const res = await Auth.fetch(path, options);
        const raw = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(raw.message || 'Request failed');
        return raw.data || raw;
    }

    /** @param {object} params { branchId?, category?, lowStockOnly?, page?, limit? } */
    async function getItems(params = {}) {
        const q = new URLSearchParams();
        Object.keys(params).forEach((k) => {
            if (params[k] !== undefined && params[k] !== null && params[k] !== '') q.set(k, params[k]);
        });
        const qs = q.toString() ? '?' + q.toString() : '';
        return jsonFetch(`/staff/me/inventory-items${qs}`);
    }

    async function receiveGoods(itemId, payload) {
        return jsonFetch(`/staff/me/inventory-items/${itemId}/receive-goods`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
    }

    async function requestTransfer(payload) {
        return jsonFetch('/staff/me/inventory-items/transfer-requests', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
    }

    async function getTransferRequests() {
        return jsonFetch('/staff/me/inventory-items/transfer-requests');
    }

    async function approveTransfer(id) {
        return jsonFetch('/staff/me/inventory-items/transfer-requests/' + id + '/approve', { method: 'PATCH' });
    }

    async function rejectTransfer(id, reason) {
        return jsonFetch('/staff/me/inventory-items/transfer-requests/' + id + '/reject', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason }),
        });
    }

    async function reassignTransfer(id, toApproverId, reason) {
        return jsonFetch('/staff/me/inventory-items/transfer-requests/' + id + '/reassign', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ toApproverId, reason }),
        });
    }

    async function requestAdjustment(itemId, payload) {
        return jsonFetch('/staff/me/inventory-items/' + itemId + '/adjust-request', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
    }

    async function getAdjustmentRequests() {
        return jsonFetch('/staff/me/inventory-items/adjustment-requests');
    }

    async function approveAdjustment(id) {
        return jsonFetch('/staff/me/inventory-items/adjustment-requests/' + id + '/approve', { method: 'PATCH' });
    }

    async function rejectAdjustment(id, reason) {
        return jsonFetch('/staff/me/inventory-items/adjustment-requests/' + id + '/reject', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason }),
        });
    }

    async function reassignAdjustment(id, toApproverId, reason) {
        return jsonFetch('/staff/me/inventory-items/adjustment-requests/' + id + '/reassign', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ toApproverId, reason }),
        });
    }

    async function getBranches() {
        return jsonFetch('/staff/me/inventory-items/branches');
    }

    async function createItem(payload) {
        return jsonFetch('/staff/me/inventory-items', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
    }
    return {
        getItems, receiveGoods,
        requestTransfer, getTransferRequests, approveTransfer, rejectTransfer, reassignTransfer,
        requestAdjustment, getAdjustmentRequests, approveAdjustment, rejectAdjustment, reassignAdjustment,
        getBranches, createItem, CATEGORY_LABELS,
    };

})();