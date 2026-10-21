/**
 * Marketplace API helper: /admin/marketplace
 * Third-party vendors from the vendor site (separate from Suppliers): vendor
 * review and KYC documents, product approval, vendor orders, marketplace settings.
 * Requires: auth.js (Auth.fetch)
 */
const Marketplace = (function () {
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

    const base = '/admin/marketplace';

    return {
        summary: () => apiFetch(base + '/summary'),
        getSettings: () => apiFetch(base + '/settings'),
        saveSettings: (payload) => apiFetch(base + '/settings', jsonBody('PUT', payload)),

        listVendors: (params) => apiFetch(base + '/vendors' + qs(params)),
        getVendor: (id) => apiFetch(`${base}/vendors/${id}`),
        documentUrl: (id, docId) => apiFetch(`${base}/vendors/${id}/documents/${docId}/url`),
        documentViews: (id, docId) => apiFetch(`${base}/vendors/${id}/documents/${docId}/views`),
        reviewDocument: (id, docId, status, note) => apiFetch(`${base}/vendors/${id}/documents/${docId}`, jsonBody('PATCH', { status, note })),
        verifyNin: (id) => apiFetch(`${base}/vendors/${id}/verify-nin`, { method: 'POST' }),
        decideVendor: (id, payload) => apiFetch(`${base}/vendors/${id}/decision`, jsonBody('POST', payload)),
        saveNotes: (id, payload) => apiFetch(`${base}/vendors/${id}/notes`, jsonBody('PATCH', payload)),
        setCommission: (id, commissionPercent) => apiFetch(`${base}/vendors/${id}/commission`, jsonBody('PATCH', { commissionPercent })),

        listProducts: (params) => apiFetch(base + '/products' + qs(params)),
        getProduct: (id) => apiFetch(`${base}/products/${id}`),
        decideProduct: (id, payload) => apiFetch(`${base}/products/${id}/decision`, jsonBody('POST', payload)),

        // Vendor orders (one per vendor per web shop order)
        listOrders: (params) => apiFetch(base + '/orders' + qs(params)),
        getOrder: (id) => apiFetch(`${base}/orders/${id}`),
        cancelOrder: (id, reason) => apiFetch(`${base}/orders/${id}/cancel`, jsonBody('POST', { reason })),
        confirmDelivery: (id, code) => apiFetch(`${base}/orders/${id}/confirm-delivery`, jsonBody('POST', { code })),
    };
})();
