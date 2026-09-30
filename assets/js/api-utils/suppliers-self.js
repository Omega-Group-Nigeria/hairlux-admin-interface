/**
 * Suppliers & Vendors API helper (staff self-service, read-only) — /staff/me/suppliers
 * Requires: auth.js (Auth.fetch)
 */
const SuppliersSelf = (function () {
    async function jsonFetch(path, options) {
        const res = await Auth.fetch(path, options);
        const raw = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(raw.message || 'Request failed');
        return raw.data !== undefined ? raw.data : raw;
    }

    async function getAll() {
        return jsonFetch('/staff/me/suppliers');
    }

    return { getAll };
})();