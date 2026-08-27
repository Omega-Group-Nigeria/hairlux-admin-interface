/**
 * Staff API helper — /admin/staff/*
 * Depends on auth.js (Auth.fetch) being loaded first.
 */
const Staff = (() => {
    async function jsonFetch(path, options = {}) {
        const res = await Auth.fetch(path, options);
        const raw = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(raw.message || `Request failed (${res.status})`);
        return raw.data !== undefined ? raw.data : raw;
    }

    function asBool(value) {
        if (typeof value === "boolean") return value;
        if (typeof value === "string") return value.toLowerCase() === "true";
        return !!value;
    }

    function firstArray() {
        for (let i = 0; i < arguments.length; i++) {
            if (Array.isArray(arguments[i])) return arguments[i];
        }
        return [];
    }

    async function getAll(params = {}) {
        const q = new URLSearchParams();
        if (params.page) q.set("page", params.page);
        if (params.limit) q.set("limit", params.limit);
        if (params.search) q.set("search", params.search);
        if (params.employmentStatus) q.set("employmentStatus", params.employmentStatus);
        if (params.locationId) q.set("locationId", params.locationId);
        if (params.currentRole) q.set("currentRole", params.currentRole);
        if (params.includeArchived !== undefined && params.includeArchived !== null) {
            q.set("includeArchived", String(asBool(params.includeArchived)));
        }

        const res = await Auth.fetch("/admin/staff" + (q.toString() ? "?" + q.toString() : ""));
        const raw = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(raw.message || "Failed to load staff");

        const payload = raw.data !== undefined ? raw.data : raw;
        if (Array.isArray(payload)) return { data: payload, meta: {} };
        if (Array.isArray(payload.data)) {
            return {
                data: payload.data,
                meta: payload.meta || payload.pagination || {},
            };
        }
        return {
            data: firstArray(payload.staff, payload.items, payload.results, payload.rows),
            meta: payload.meta || payload.pagination || {},
        };
    }

    async function getUpcomingBirthdays(params = {}) {
        const q = new URLSearchParams();
        if (params.daysAhead) q.set("daysAhead", params.daysAhead);
        if (params.includeFormer !== undefined && params.includeFormer !== null) {
            q.set("includeFormer", String(asBool(params.includeFormer)));
        }
        const data = await jsonFetch("/admin/staff/birthdays/upcoming" + (q.toString() ? "?" + q.toString() : ""));
        if (Array.isArray(data)) return data;
        return data.items || data.birthdays || data.data || [];
    }

    async function getOne(id) {
        return jsonFetch("/admin/staff/" + id);
    }

    async function getLocations(params = {}) {
        const q = new URLSearchParams();
        if (params.search) q.set("search", params.search);
        if (params.includeInactive !== undefined && params.includeInactive !== null) {
            q.set("includeInactive", String(asBool(params.includeInactive)));
        }

        const data = await jsonFetch("/admin/staff/locations" + (q.toString() ? "?" + q.toString() : ""));
        if (Array.isArray(data)) return data;
        return firstArray(data.items, data.locations, data.data, data.results, data.rows);
    }

    async function tryCreateLocation(payloadVariants) {
        let lastError = null;
        for (const payload of payloadVariants) {
            try {
                return await jsonFetch("/admin/staff/locations", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });
            } catch (err) {
                lastError = err;
            }
        }
        throw lastError || new Error("Failed to create location");
    }

    async function tryUpdateLocation(id, payloadVariants) {
        let lastError = null;
        for (const payload of payloadVariants) {
            try {
                return await jsonFetch("/admin/staff/locations/" + id, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });
            } catch (err) {
                lastError = err;
            }
        }
        throw lastError || new Error("Failed to update location");
    }

    async function createLocation(payload) {
        const name = String((payload && (payload.name || payload.locationName || "")) || "").trim();
        return tryCreateLocation([
            { name },
            { locationName: name },
        ]);
    }

    async function updateLocation(id, payload) {
        const name = String((payload && (payload.name || payload.locationName || "")) || "").trim();
        const isActive = asBool(payload && (payload.isActive !== undefined ? payload.isActive : payload.active));

        return tryUpdateLocation(id, [
            { name, isActive },
            { locationName: name, isActive },
            { name, active: isActive },
            { locationName: name, active: isActive },
        ]);
    }

    async function deleteLocation(id) {
        return jsonFetch("/admin/staff/locations/" + id, {
            method: "DELETE",
        });
    }

    async function create(payload) {
        return jsonFetch("/admin/staff", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
    }

    async function update(id, payload) {
        return jsonFetch("/admin/staff/" + id, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
    }

    async function updateStatus(id, payload) {
        return jsonFetch("/admin/staff/" + id + "/status", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
    }

    async function transferBranch(id, payload) {
        return jsonFetch("/admin/staff/" + id + "/transfer-branch", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
    }

    async function getCodeHistory(id) {
        return jsonFetch("/admin/staff/" + id + "/code-history");
    }

    async function getRoleAssignment(id) {
        return jsonFetch("/admin/staff/" + id + "/role-assignment");
    }

    async function assignRole(id, adminRoleId, grantPortalLogin, mode) {
        return jsonFetch("/admin/staff/" + id + "/role-assignment", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ adminRoleId: adminRoleId, grantPortalLogin: grantPortalLogin, mode: mode || 'primary' }),
        });
    }

    async function removeRole(id) {
        return jsonFetch("/admin/staff/" + id + "/role-assignment", { method: "DELETE" });
    }

    async function archive(id, payload) {
        return jsonFetch("/admin/staff/" + id + "/archive", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload || {}),
        });
    }

    async function restore(id) {
        return jsonFetch("/admin/staff/" + id + "/restore", {
            method: "POST",
        });
    }

    async function addHistory(id, payload) {
        return jsonFetch("/admin/staff/" + id + "/history", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
    }

    async function updateHistory(id, historyId, payload) {
        return jsonFetch("/admin/staff/" + id + "/history/" + historyId, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
    }

    async function removeHistory(id, historyId) {
        return jsonFetch("/admin/staff/" + id + "/history/" + historyId, {
            method: "DELETE",
        });
    }

    async function getOnboarding(id) {
        return jsonFetch("/admin/staff/" + id + "/onboarding");
    }

    async function getWorkCalendar(id) {
        return jsonFetch("/admin/attendance/work-calendar/" + id);
    }

    async function setWorkCalendar(id, payload) {
        return jsonFetch("/admin/attendance/work-calendar/" + id, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
    }

    async function applyWorkCalendarDefault(id, overwrite) {
        return jsonFetch("/admin/attendance/work-calendar/" + id + "/apply-business-hours-default?overwrite=" + (overwrite ? "true" : "false"), {
            method: "POST",
        });
    }

    async function getOnboardingSummary() {
        return jsonFetch("/admin/staff/onboarding-summary");
    }

    async function updateOnboardingItem(id, itemId, payload) {
        return jsonFetch("/admin/staff/" + id + "/onboarding/" + itemId, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
    }

    async function getDocumentStatus(id) {
        return jsonFetch("/admin/staff/" + id + "/documents");
    }

    async function getDirectives(id) {
        return jsonFetch("/admin/staff/" + id + "/directives");
    }

    async function setCompensation(id, payload) {
        return jsonFetch("/admin/payroll/staff/" + id + "/compensation", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
    }

    async function getCompensationHistory(id) {
        return jsonFetch("/admin/payroll/staff/" + id + "/compensation/history");
    }

    async function requestAddressVerification(id) {
        return jsonFetch("/admin/staff/" + id + "/address-verification/request", { method: "POST" });
    }

    async function cancelAddressVerification(id) {
        return jsonFetch("/admin/staff/" + id + "/address-verification/cancel", { method: "POST" });
    }

    async function getAddressVerification(id) {
        return jsonFetch("/admin/staff/" + id + "/address-verification");
    }

    async function getPassportPhotoUrl(id) {
        return jsonFetch("/admin/staff/" + id + "/passport-photo");
    }

    function idCardUrl(id) {
        const base = (window.API_BASE || "").replace(/\/$/, "");
        return base + "/admin/staff/" + id + "/id-card.pdf";
    }

    /** Downloads the ID card PDF using an authenticated fetch (browser can't attach a JWT to a plain <a href>). */
    async function downloadIdCard(id, staffCode) {
        const res = await Auth.fetch("/admin/staff/" + id + "/id-card.pdf");
        if (!res.ok) throw new Error("Failed to generate ID card");
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "staff-id-" + (staffCode || id) + ".pdf";
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    }

    const STATUS_COLORS = {
        ACTIVE: "success",
        ON_LEAVE: "warning",
        SUSPENDED: "orange",
        EXITED: "secondary",
        ARCHIVED: "dark",
    };

    function statusBadge(status) {
        const value = String(status || "UNKNOWN").toUpperCase();
        const color = STATUS_COLORS[value] || "secondary";
        return '<span class="badge bg-' + color + '-lt">' + value.replace(/_/g, " ") + "</span>";
    }

    function formatDate(value) {
        if (!value) return "-";
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return String(value);
        return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    }

    function fullName(staff) {
        const parts = [staff.firstName, staff.middleName, staff.lastName].filter(Boolean);
        if (parts.length) return parts.join(" ");
        return staff.name || "-";
    }

    return {
        getAll,
        getUpcomingBirthdays,
        getOne,
        getLocations,
        createLocation,
        updateLocation,
        deleteLocation,
        create,
        update,
        updateStatus,
        transferBranch,
        getCodeHistory,
        getRoleAssignment,
        assignRole,
        removeRole,
        archive,
        restore,
        addHistory,
        updateHistory,
        removeHistory,
        getOnboarding,
        getWorkCalendar, setWorkCalendar, applyWorkCalendarDefault,
        getOnboardingSummary,
        updateOnboardingItem,
        getDocumentStatus,
        getDirectives,
        setCompensation, getCompensationHistory,
        requestAddressVerification, getAddressVerification, cancelAddressVerification,
        getPassportPhotoUrl,
        idCardUrl,
        downloadIdCard,
        statusBadge,
        formatDate,
        fullName,
    };
})();