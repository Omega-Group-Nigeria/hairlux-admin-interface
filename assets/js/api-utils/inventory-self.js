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
    // add getBranches to the returned object
    return { getItems, receiveGoods, requestTransfer, getTransferRequests, getBranches, createItem, CATEGORY_LABELS };

})();