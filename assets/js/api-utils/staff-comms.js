/**
 * Staff Comms API helper (admin) — /admin/announcements, /admin/directives
 * Depends on auth.js (Auth.fetch) being loaded first.
 */
const StaffComms = (() => {
    const PERMISSIONS = {
        READ:   "staff:read",
        MANAGE: "staff:update",
    };

    async function jsonFetch(path, options = {}) {
        const res = await Auth.fetch(path, options);
        const raw = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(raw.message || `Request failed (${res.status})`);
        return raw.data !== undefined ? raw.data : raw;
    }

    async function createAnnouncement(payload) {
        return jsonFetch("/admin/announcements", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
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
        return jsonFetch("/admin/directives" + (q.toString() ? "?" + q.toString() : ""));
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

    function announcementTargetLabel(a) {
        if (a.target === "ALL") return "All Staff";
        if (a.target === "BRANCH") return a.targetLocation ? a.targetLocation.name : "Branch";
        if (a.target === "INDIVIDUAL") return a.targetStaff ? a.targetStaff.name : "Individual";
        return a.target;
    }

    return {
        PERMISSIONS,
        createAnnouncement,
        getAllAnnouncements,
        createDirective,
        getAllDirectives,
        getStaffDirectives,
        directiveStatusBadge,
        createdByName,
        announcementTargetLabel,
        formatDate,
    };
})();