/**
 * services.js — Hairlux Admin
 * API helper for service catalog + category management.
 *
 * Requires:
 *   - config.js (window.API_BASE)
 *   - auth.js   (Auth.fetch, Auth.getToken, Auth.isTokenExpired, Auth.refreshAccessToken, Auth.logout)
 *
 * Endpoints used:
 *   Public (no auth):
 *     GET  /services                       list all services (filters: categoryId, search, status, bookingType)
 *     GET  /services/categories            list all categories
 *     GET  /services/:id                   get single service
 *
 *   Admin (JWT required):
 *     POST   /admin/services               create service  (multipart/form-data)
 *     PUT    /admin/services/:id           update service  (multipart/form-data)
 *     DELETE /admin/services/:id           delete service
 *     PUT    /admin/services/:id/status    toggle ACTIVE / INACTIVE  (JSON)
 *     POST   /admin/services/categories    create category (JSON)
 *     PUT    /admin/services/categories/:id   update category (JSON)
 *     DELETE /admin/services/categories/:id   delete category
 */

const Services = (() => {

    function getBase() {
        return (window.API_BASE || "").replace(/\/$/, "");
    }

    // ── Auth-aware JSON fetch ─────────────────────────────────────────────────────
    async function apiFetch(path, options = {}) {
        const res  = await Auth.fetch(path, options);
        const raw  = await res.json().catch(() => ({}));
        if (!res || !res.ok) throw new Error(raw.message || `Request failed (${res ? res.status : "no response"})`);
        return raw.data !== undefined ? raw.data : raw;
    }

    // ── Auth-aware multipart fetch (FormData — must NOT set Content-Type) ─────────
    async function multipartFetch(path, method, formData) {
        // Proactively refresh if near expiry
        if (Auth.isTokenExpired()) {
            try { await Auth.refreshAccessToken(); } catch { Auth.logout(); return; }
        }

        const doFetch = () => fetch(`${getBase()}${path}`, {
            method,
            headers: { Authorization: `Bearer ${Auth.getToken()}` },
            body: formData,
        });

        let res = await doFetch();

        // On 401 try refresh + retry once
        if (res.status === 401) {
            try { await Auth.refreshAccessToken(); res = await doFetch(); } catch { Auth.logout(); return; }
        }

        const raw = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(raw.message || `Request failed (${res.status})`);
        return raw.data !== undefined ? raw.data : raw;
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // CATEGORIES
    // ═══════════════════════════════════════════════════════════════════════════════

    /**
     * GET /services/categories
     * Returns array of { id, name, description, serviceCount, createdAt, updatedAt }
     */
    async function getCategories() {
        const data = await apiFetch("/services/categories");
        return Array.isArray(data) ? data : (data.categories || []);
    }

    /**
     * POST /admin/services/categories  { name, description? }
     */
    async function createCategory(payload) {
        return apiFetch("/admin/services/categories", {
            method: "POST",
            body: JSON.stringify(payload),
        });
    }

    /**
     * PUT /admin/services/categories/:id  { name?, description? }
     */
    async function updateCategory(id, payload) {
        return apiFetch(`/admin/services/categories/${id}`, {
            method: "PUT",
            body: JSON.stringify(payload),
        });
    }

    /**
     * DELETE /admin/services/categories/:id
     * Fails (409) if any services are still assigned to the category.
     */
    async function deleteCategory(id) {
        return apiFetch(`/admin/services/categories/${id}`, { method: "DELETE" });
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // SERVICES
    // ═══════════════════════════════════════════════════════════════════════════════

    /**
     * GET /services?categoryId=&search=&status=&bookingType=
     * Returns array of service objects.
     */
    async function getAll(params = {}) {
        const q = new URLSearchParams();
        if (params.categoryId) q.set("categoryId", params.categoryId);
        if (params.search)     q.set("search",     params.search);
        if (params.status)     q.set("status",     params.status);
        if (params.bookingType) q.set("bookingType", params.bookingType);
        const qs   = q.toString();
        const data = await apiFetch("/services" + (qs ? "?" + qs : ""));
        return Array.isArray(data) ? data : (data.services || []);
    }

    /**
     * GET /services/:id
     */
    async function getOne(id) {
        return apiFetch(`/services/${id}`);
    }

    /**
    * POST /admin/services  (multipart/form-data)
    * Required fields:
    * image (File), categoryId, name, description,
    * walkInPrice (number), homeServicePrice (number),
    * isWalkInAvailable (boolean), isHomeServiceAvailable (boolean), duration (number)
     * @param {FormData} formData
     */
    async function create(formData) {
        return multipartFetch("/admin/services", "POST", formData);
    }

    /**
     * PUT /admin/services/:id  (multipart/form-data)
     * All fields optional; image only if replacing.
     * @param {string}   id
     * @param {FormData} formData
     */
    async function update(id, formData) {
        return multipartFetch(`/admin/services/${id}`, "PUT", formData);
    }

    /**
     * PUT /admin/services/:id/status  { status: "ACTIVE" | "INACTIVE" }
     */
    async function updateStatus(id, status) {
        return apiFetch(`/admin/services/${id}/status`, {
            method: "PUT",
            body: JSON.stringify({ status }),
        });
    }

    /**
     * DELETE /admin/services/:id
     * Fails (409) if the service has existing bookings.
     */
    async function remove(id) {
        return apiFetch(`/admin/services/${id}`, { method: "DELETE" });
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // DISPLAY HELPERS
    // ═══════════════════════════════════════════════════════════════════════════════

    function statusBadge(status) {
        return status === "ACTIVE"
            ? '<span class="badge bg-success-lt text-success">Active</span>'
            : '<span class="badge bg-secondary-lt text-secondary">Inactive</span>';
    }

    /** Format amount in Naira (price stored as number, e.g. 25000 = ₦25,000) */
    function formatMoney(amount) {
        return "₦" + Number(amount || 0).toLocaleString("en-NG", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });
    }

    /** Format duration in minutes → human readable, e.g. 90 → "1h 30m" */
    function formatDuration(mins) {
        const m = Number(mins) || 0;
        const h = Math.floor(m / 60);
        const r = m % 60;
        if (h > 0 && r > 0) return h + "h " + r + "m";
        if (h > 0)           return h + "h";
        return r + "m";
    }

    /** Short ISO date → "15 Jan 2026" */
    function formatDate(iso) {
        if (!iso) return "—";
        try {
            return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
        } catch { return iso; }
    }

    // ─── Public API ───────────────────────────────────────────────────────────────
    return {
        // Categories
        getCategories,
        createCategory,
        updateCategory,
        deleteCategory,
        // Services
        getAll,
        getOne,
        create,
        update,
        updateStatus,
        remove,
        // Helpers
        statusBadge,
        formatMoney,
        formatDuration,
        formatDate,
    };
})();
