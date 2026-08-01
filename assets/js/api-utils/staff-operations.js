/**
 * Staff Operations API helper (admin) — /admin/attendance, /admin/inventory/*
 * Depends on auth.js (Auth.fetch) being loaded first.
 */
const StaffOps = (() => {
    async function jsonFetch(path, options = {}) {
        const res = await Auth.fetch(path, options);
        const raw = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(raw.message || `Request failed (${res.status})`);
        return raw.data !== undefined ? raw.data : raw;
    }

    async function correctAttendance(recordId, payload) {
        return jsonFetch(`/admin/attendance/${recordId}/correct`, {
            method: "PATCH",
            body: JSON.stringify(payload),
        });
    }

    async function getAttendanceReport(params = {}) {
        const q = new URLSearchParams();
        if (params.date) q.set("date", params.date);
        if (params.locationId) q.set("locationId", params.locationId);
        if (params.staffId) q.set("staffId", params.staffId);
        return jsonFetch("/admin/attendance" + (q.toString() ? "?" + q.toString() : ""));
    }

    async function getInventoryDashboard(locationId) {
        const q = locationId ? "?locationId=" + encodeURIComponent(locationId) : "";
        return jsonFetch("/admin/inventory/dashboard" + q);
    }

    async function getInventoryEntries(params = {}) {
        const q = new URLSearchParams();
        if (params.locationId) q.set("locationId", params.locationId);
        if (params.productName) q.set("productName", params.productName);
        return jsonFetch("/admin/inventory/entries" + (q.toString() ? "?" + q.toString() : ""));
    }

    const LOW_STOCK_THRESHOLD = 5; // prototype-level heuristic, not a configured value yet

    function formatDate(value) {
        if (!value) return "-";
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return String(value);
        return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    }

    function formatTime(value) {
        if (!value) return "-";
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return "-";
        return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    }

    return {
        getAttendanceReport,
        correctAttendance,
        getInventoryDashboard,
        getInventoryEntries,
        LOW_STOCK_THRESHOLD,
        formatDate,
        formatTime,
    };
})();
