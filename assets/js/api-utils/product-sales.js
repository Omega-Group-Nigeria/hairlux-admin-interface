/**
 * Product Sales API helper (staff self-service) — /staff/me/product-sales
 * Requires: auth.js (Auth.fetch)
 */
const ProductSalesSelf = (function () {
    async function jsonFetch(path, options) {
        const res = await Auth.fetch(path, options);
        const raw = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(raw.message || 'Request failed');
        return raw.data !== undefined ? raw.data : raw;
    }

    async function getAll(params = {}) {
        const q = new URLSearchParams();
        Object.keys(params).forEach((k) => {
            if (params[k] !== undefined && params[k] !== null && params[k] !== '') q.set(k, params[k]);
        });
        const qs = q.toString() ? '?' + q.toString() : '';
        return jsonFetch(`/staff/me/product-sales${qs}`);
    }

    async function create(payload) {
        return jsonFetch('/staff/me/product-sales', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
    }

    return { getAll, create };
})();