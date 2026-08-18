/**
 * Lifecycle Campaign Templates API helper — /admin/lifecycle-campaigns/templates
 * Requires: auth.js (Auth.fetch)
 */
const LifecycleCampaigns = (function () {
    async function apiFetch(path, options = {}) {
        const res = await Auth.fetch(path, options);
        const raw = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(raw.message || `Request failed (${res.status})`);
        return raw.data !== undefined ? raw.data : raw;
    }

    async function getAll() {
        return apiFetch('/admin/lifecycle-campaigns/templates');
    }

    async function getOne(id) {
        return apiFetch(`/admin/lifecycle-campaigns/templates/${id}`);
    }

    async function create(payload) {
        return apiFetch('/admin/lifecycle-campaigns/templates', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
    }

    async function update(id, payload) {
        return apiFetch(`/admin/lifecycle-campaigns/templates/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
    }

    async function remove(id) {
        return apiFetch(`/admin/lifecycle-campaigns/templates/${id}`, { method: 'DELETE' });
    }

    return { getAll, getOne, create, update, remove };
})();