/**
 * branches.js — Hairlux Admin
 * API helper for branch locations and per-branch service configuration.
 *
 * Requires:
 *   - config.js (window.API_BASE)
 *   - auth.js   (Auth.fetch, Auth.getToken, Auth.isTokenExpired, Auth.refreshAccessToken, Auth.logout)
 *
 * Permissions (see documents/branch-api.md):
 *   branches:read             — list/view branches and service matrix
 *   branches:create           — create a new branch
 *   branches:update           — edit branch details
 *   branches:manage_manager   — assign or remove a branch's manager
 *   branches:delete           — delete a branch
 *   branches:manage_services  — manage which services a branch offers, and their walk-in pricing
 *
 * Dev Feedback Round 4, item #43: the previous single branches:manage
 * permission was split into the 5 above (delete always separate from
 * edit) -- kept as individual constants below so each UI action can be
 * gated by the specific permission it actually needs, not one blanket
 * check.
 *
 * Branch create/update requires non-empty `address` (max 500 chars). See documents/branch-address-required.md.
 *
 * Admin endpoints:
 *   POST   /admin/branches
 *   GET    /admin/branches
 *   GET    /admin/branches/:id
 *   PATCH  /admin/branches/:id
 *   DELETE /admin/branches/:id
 *   PATCH  /admin/branches/:id/manager
 *   DELETE /admin/branches/:id/manager
 *   GET    /admin/branches/:id/services
 *   PUT    /admin/branches/:id/services
 *   PATCH  /admin/branches/:id/services
 */

const Branches = (() => {

    const PERMISSIONS = {
        READ: "branches:read",
        CREATE: "branches:create",
        UPDATE: "branches:update",
        MANAGE_MANAGER: "branches:manage_manager",
        DELETE: "branches:delete",
        MANAGE_SERVICES: "branches:manage_services",
    };

    function getBase() {
        return (window.API_BASE || "").replace(/\/$/, "");
    }

    async function apiFetch(path, options = {}) {
        const res = await Auth.fetch(path, options);
        const raw = await res.json().catch(() => ({}));
        if (!res || !res.ok) throw new Error(raw.message || `Request failed (${res ? res.status : "no response"})`);
        return raw.data !== undefined ? raw.data : raw;
    }

    function parseList(data) {
        if (Array.isArray(data)) return data;
        if (data && Array.isArray(data.data)) return data.data;
        if (data && Array.isArray(data.branches)) return data.branches;
        return [];
    }

    async function getBranches(params = {}) {
        const q = new URLSearchParams();
        if (params.search) q.set("search", params.search);
        if (params.includeInactive) q.set("includeInactive", "true");
        const qs = q.toString();
        const data = await apiFetch("/admin/branches" + (qs ? "?" + qs : ""));
        return parseList(data);
    }

    async function getBranch(id) {
        return apiFetch(`/admin/branches/${id}`);
    }

    function normalizeCreateBranchPayload(payload) {
        const name = String((payload && payload.name) || "").trim();
        const address = String((payload && payload.address) || "").trim();
        if (!name) throw new Error("Branch name is required.");
        if (!address) throw new Error("Branch address is required.");
        if (address.length > 500) throw new Error("Address must be 500 characters or fewer.");

        const body = { name, address };
        if (payload.code) body.code = payload.code;
        if (payload.gpsLat !== undefined && payload.gpsLat !== "") body.gpsLat = Number(payload.gpsLat);
        if (payload.gpsLng !== undefined && payload.gpsLng !== "") body.gpsLng = Number(payload.gpsLng);
        if (payload.approvedRadiusMeters !== undefined && payload.approvedRadiusMeters !== "") body.approvedRadiusMeters = Number(payload.approvedRadiusMeters);
        if (payload.lateGracePeriodMinutes !== undefined && payload.lateGracePeriodMinutes !== "") body.lateGracePeriodMinutes = Number(payload.lateGracePeriodMinutes);
        return body;
    }

    function normalizeUpdateBranchPayload(payload) {
        const body = Object.assign({}, payload || {});
        if (body.name != null) body.name = String(body.name).trim();
        if (body.address != null) {
            body.address = String(body.address).trim();
            if (!body.address) throw new Error("Branch address cannot be empty.");
            if (body.address.length > 500) throw new Error("Address must be 500 characters or fewer.");
        }
        if (body.gpsLat !== undefined && body.gpsLat !== "") body.gpsLat = Number(body.gpsLat);
        if (body.gpsLng !== undefined && body.gpsLng !== "") body.gpsLng = Number(body.gpsLng);
        if (body.approvedRadiusMeters !== undefined && body.approvedRadiusMeters !== "") body.approvedRadiusMeters = Number(body.approvedRadiusMeters);
        if (body.lateGracePeriodMinutes !== undefined && body.lateGracePeriodMinutes !== "") body.lateGracePeriodMinutes = Number(body.lateGracePeriodMinutes);
        return body;
    }

    async function createBranch(payload) {
        return apiFetch("/admin/branches", {
            method: "POST",
            body: JSON.stringify(normalizeCreateBranchPayload(payload)),
        });
    }

    async function updateBranch(id, payload) {
        return apiFetch(`/admin/branches/${id}`, {
            method: "PATCH",
            body: JSON.stringify(normalizeUpdateBranchPayload(payload)),
        });
    }

    async function deleteBranch(id) {
        return apiFetch(`/admin/branches/${id}`, { method: "DELETE" });
    }

    async function setManager(id, staffId) {
        return apiFetch(`/admin/branches/${id}/manager`, {
            method: "PATCH",
            body: JSON.stringify({ staffId }),
        });
    }

    async function removeManager(id) {
        return apiFetch(`/admin/branches/${id}/manager`, { method: "DELETE" });
    }

    async function getBusinessHours() {
        const data = await apiFetch("/bookings/business-hours");
        return Array.isArray(data) ? data : (data.hours || []);
    }

    async function setBusinessHours(hours) {
        return apiFetch("/admin/bookings/business-hours", {
            method: "POST",
            body: JSON.stringify({ hours }),
        });
    }

    async function getBranchServices(branchId) {
        const data = await apiFetch(`/admin/branches/${branchId}/services`);
        return Array.isArray(data) ? data : (data.services || data.data || []);
    }

    async function setBranchServices(branchId, serviceIds) {
        const data = await apiFetch(`/admin/branches/${branchId}/services`, {
            method: "PUT",
            body: JSON.stringify({ serviceIds }),
        });
        return Array.isArray(data) ? data : (data.services || data.data || []);
    }

    async function patchBranchServices(branchId, services) {
        const data = await apiFetch(`/admin/branches/${branchId}/services`, {
            method: "PATCH",
            body: JSON.stringify({ services }),
        });
        return Array.isArray(data) ? data : (data.services || data.data || []);
    }

    function statusBadge(isActive) {
        return isActive !== false
            ? '<span class="badge bg-success-lt text-success">Open</span>'
            : '<span class="badge bg-secondary-lt text-secondary">Closed</span>';
    }

    function formatMoney(amount) {
        if (amount == null || amount === "") return "—";
        return "₦" + Number(amount).toLocaleString("en-NG", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });
    }

    function formatDate(iso) {
        if (!iso) return "—";
        try {
            return new Date(iso).toLocaleDateString("en-GB", {
                day: "numeric", month: "short", year: "numeric",
            });
        } catch { return iso; }
    }

    /** Resolved walk-in price for display: override ?? catalog */
    function effectiveWalkIn(row) {
        if (!row) return null;
        if (row.walkInPrice != null && row.walkInPrice !== "") return Number(row.walkInPrice);
        return row.catalogWalkInPrice != null ? Number(row.catalogWalkInPrice) : null;
    }

    return {
        PERMISSIONS,
        getBranches,
        getBranch,
        createBranch,
        updateBranch,
        deleteBranch,
        setManager,
        removeManager,
        getBusinessHours,
        setBusinessHours,
        getBranchServices,
        setBranchServices,
        patchBranchServices,
        statusBadge,
        formatMoney,
        formatDate,
        effectiveWalkIn,
    };
})();