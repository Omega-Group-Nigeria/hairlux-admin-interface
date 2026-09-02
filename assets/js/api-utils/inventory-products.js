/**
 * Inventory Products (master catalogue) API helper — /admin/inventory-products
 * Requires: auth.js (Auth.fetch)
 */
const InventoryProducts = (function () {
    async function apiFetch(path, options = {}) {
        const res = await Auth.fetch(path, options);
        const raw = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(raw.message || `Request failed (${res.status})`);
        return raw.data !== undefined ? raw.data : raw;
    }

    async function getAll(search, category, activeOnly, vendorId, noVendor) {
        const params = new URLSearchParams();
        if (search) params.set('search', search);
        if (category) params.set('category', category);
        if (activeOnly) params.set('activeOnly', 'true');
        if (vendorId) params.set('vendorId', vendorId);
        if (noVendor) params.set('noVendor', 'true');
        const qs = params.toString();
        return apiFetch('/admin/inventory-products' + (qs ? '?' + qs : ''));
    }

    async function getOne(id) {
        return apiFetch(`/admin/inventory-products/${id}`);
    }

    async function create(payload) {
        return apiFetch('/admin/inventory-products', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
    }

    async function update(id, payload) {
        return apiFetch(`/admin/inventory-products/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
    }

    async function remove(id) {
        return apiFetch(`/admin/inventory-products/${id}`, { method: 'DELETE' });
    }

    return { getAll, getOne, create, update, remove };
})();