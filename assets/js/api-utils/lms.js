/**
 * LMS (Staff Training) API helper — /admin/lms/courses
 * Requires: auth.js (Auth.fetch, Auth.getToken)
 */
const Lms = (function () {
    async function apiFetch(path, options = {}) {
        const res = await Auth.fetch(path, options);
        const raw = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(raw.message || `Request failed (${res.status})`);
        return raw.data !== undefined ? raw.data : raw;
    }

    async function getAll() {
        return apiFetch('/admin/lms/courses');
    }

    async function getOne(id) {
        return apiFetch(`/admin/lms/courses/${id}`);
    }

    /**
     * Bypasses Auth.fetch entirely for create/update (the browser needs to
     * set its own Content-Type including the multipart boundary, which
     * Auth.fetch's forced 'application/json' default would break).
     * Replicates Auth's own base-URL + bearer-token handling manually,
     * same proven pattern as staff-documents.js's uploadFile.
     */
    async function submitFormData(path, method, formData) {
        const base = (window.API_BASE || "").replace(/\/$/, "");
        const res = await fetch(base + path, {
            method,
            headers: { Authorization: "Bearer " + Auth.getToken() },
            body: formData,
        });
        const raw = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(raw.message || `Request failed (${res.status})`);
        return raw.data !== undefined ? raw.data : raw;
    }

    async function create(formData) {
        return submitFormData('/admin/lms/courses', 'POST', formData);
    }

    async function update(id, formData) {
        return submitFormData(`/admin/lms/courses/${id}`, 'PATCH', formData);
    }

    async function remove(id) {
        return apiFetch(`/admin/lms/courses/${id}`, { method: 'DELETE' });
    }

    return { getAll, getOne, create, update, remove };
})();