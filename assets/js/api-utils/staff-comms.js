/**
 * Staff Comms API helper (admin): /admin/announcements, /admin/directives
 * Depends on auth.js (Auth.fetch) being loaded first.
 */
const StaffComms = (() => {
    // Announcements and Tasks & Directives have their own permissions
    // (Settings -> Roles); "View/Edit staff records" no longer grant them.
    const PERMISSIONS = {
        ANNOUNCEMENTS_READ: "announcements:read",
        ANNOUNCEMENTS_CREATE: "announcements:create",
        ANNOUNCEMENTS_UPDATE: "announcements:update",
        ANNOUNCEMENTS_DELETE: "announcements:delete",
        TASKS_READ: "tasks:read",
        TASKS_CREATE: "tasks:create",
        TASKS_UPDATE: "tasks:update",
        TASKS_DELETE: "tasks:delete",
    };

    async function jsonFetch(path, options = {}) {
        const res = await Auth.fetch(path, options);
        const raw = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(raw.message || `Request failed (${res.status})`);
        return raw.data !== undefined ? raw.data : raw;
    }

    // Dev Feedback Round 9: video announcements. Auth.fetch always sets
    // Content-Type: application/json, which breaks a multipart upload --
    // the browser needs to set its own Content-Type with the multipart
    // boundary itself. Bypasses Auth.fetch entirely for this, same
    // pattern already proven in lms.js's submitFormData.
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

    /**
     * Dev Feedback Round 9: video announcements -- payload may now
     * contain a `video` File (or `removeVideo`, update only). When it
     * does, sends multipart/form-data via submitFormData; otherwise
     * keeps sending plain JSON via the existing jsonFetch, unchanged --
     * the vast majority of announcements have no video, so there's no
     * reason to pay the FormData/multipart cost for those.
     */
    function toFormData(payload) {
        const fd = new FormData();
        Object.keys(payload).forEach((key) => {
            var value = payload[key];
            if (value === undefined || value === null) return;
            // Audience id lists go as JSON text over multipart (the API parses them back).
            fd.append(key, Array.isArray(value) ? JSON.stringify(value) : value);
        });
        return fd;
    }

    async function createAnnouncement(payload) {
        if (payload.video) {
            return submitFormData("/admin/announcements", "POST", toFormData(payload));
        }
        return jsonFetch("/admin/announcements", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
    }

    async function updateAnnouncement(id, payload) {
        if (payload.video || payload.removeVideo) {
            return submitFormData("/admin/announcements/" + id, "PATCH", toFormData(payload));
        }
        return jsonFetch("/admin/announcements/" + id, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
    }

    async function deleteAnnouncement(id) {
        return jsonFetch("/admin/announcements/" + id, { method: "DELETE" });
    }

    async function getAllAnnouncements() {
        return jsonFetch("/admin/announcements");
    }

    async function createDirective(payload) {
        return jsonFetch("/admin/directives", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
    }

    async function getAllDirectives(params = {}) {
        const q = new URLSearchParams();
        if (params.status) q.set("status", params.status);
        if (params.targetStaffId) q.set("targetStaffId", params.targetStaffId);
        if (params.locationId) q.set("locationId", params.locationId);
        if (params.dueBefore) q.set("dueBefore", params.dueBefore);
        if (params.dueAfter) q.set("dueAfter", params.dueAfter);
        return jsonFetch("/admin/directives" + (q.toString() ? "?" + q.toString() : ""));
    }

    async function bulkCreateDirectives(payload) {
        return jsonFetch("/admin/directives/bulk", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
    }

    async function updateDirective(id, payload) {
        return jsonFetch("/admin/directives/" + id, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
    }

    async function deleteDirective(id) {
        return jsonFetch("/admin/directives/" + id, { method: "DELETE" });
    }

    async function getDirectiveEvidence(id) {
        return jsonFetch("/admin/directives/" + id + "/evidence");
    }

    async function getStaffDirectives(staffId) {
        return jsonFetch("/admin/staff/" + staffId + "/directives");
    }

    const STATUS_COLORS = { PENDING: "red", ACKNOWLEDGED: "warning", COMPLETED: "success" };

    function directiveStatusBadge(status) {
        const value = String(status || "UNKNOWN").toUpperCase();
        const color = STATUS_COLORS[value] || "secondary";
        return '<span class="badge bg-' + color + '-lt">' + value + "</span>";
    }

    function formatDate(value) {
        if (!value) return "-";
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return String(value);
        return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    }

    function createdByName(entity) {
        if (!entity || !entity.createdBy) return "System";
        return [entity.createdBy.firstName, entity.createdBy.lastName].filter(Boolean).join(" ") || "Unknown";
    }

    /** Short "Visible to" summary: names when one or two are chosen, otherwise a count. */
    function listLabel(names, singular, plural) {
        names = names.filter(Boolean);
        if (!names.length) return null;
        if (names.length <= 2) return names.join(", ");
        return names.length + " " + plural;
    }

    function announcementTargetLabel(a) {
        if (a.target === "ALL") return "All Staff";
        if (a.target === "ROLE") {
            return listLabel((a.roles || []).map(function (r) { return r.adminRole && r.adminRole.name; }), "role", "roles") || "Roles";
        }
        if (a.target === "BRANCH") {
            return listLabel((a.branches || []).map(function (b) { return b.branch && b.branch.name; }), "branch", "branches")
                || (a.targetLocation ? a.targetLocation.name : "Branch");
        }
        if (a.target === "INDIVIDUAL") {
            return listLabel((a.staff || []).map(function (s) { return s.staff && s.staff.name; }), "staff member", "staff")
                || (a.targetStaff ? a.targetStaff.name : "Individual");
        }
        return a.target;
    }

    return {
        PERMISSIONS,
        createAnnouncement,
        updateAnnouncement,
        deleteAnnouncement,
        getAllAnnouncements,
        createDirective,
        bulkCreateDirectives,
        updateDirective,
        deleteDirective,
        getDirectiveEvidence,
        getAllDirectives,
        getStaffDirectives,
        directiveStatusBadge,
        createdByName,
        announcementTargetLabel,
        formatDate,
    };
})();