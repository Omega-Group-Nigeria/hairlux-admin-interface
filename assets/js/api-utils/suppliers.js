/**
 * Suppliers & Vendors API helper — /admin/suppliers
 * Requires: auth.js (Auth.fetch)
 */
const Suppliers = (function () {
    async function apiFetch(path, options = {}) {
        const res = await Auth.fetch(path, options);
        const raw = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(raw.message || `Request failed (${res.status})`);
        return raw.data !== undefined ? raw.data : raw;
    }

    async function getAll(type, activeOnly) {
        const q = new URLSearchParams();
        if (type) q.set('type', type);
        if (activeOnly) q.set('activeOnly', 'true');
        const qs = q.toString() ? '?' + q.toString() : '';
        return apiFetch(`/admin/suppliers${qs}`);
    }

    async function getOne(id) {
        return apiFetch(`/admin/suppliers/${id}`);
    }

    async function create(payload) {
        return apiFetch('/admin/suppliers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
    }

    async function update(id, payload) {
        return apiFetch(`/admin/suppliers/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
    }

    async function remove(id) {
        return apiFetch(`/admin/suppliers/${id}`, { method: 'DELETE' });
    }
    

    return { getAll, getOne, create, update, remove };
})();