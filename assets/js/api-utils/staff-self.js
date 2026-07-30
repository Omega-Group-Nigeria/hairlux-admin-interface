/**
 * Staff Self-Service API helper — /staff/me/*
 * Depends on auth.js (Auth.fetch) being loaded first.
 * Used by staff-portal.html.
 */
const StaffSelf = (() => {
    async function jsonFetch(path, options = {}) {
        const res = await Auth.fetch(path, options);
        const raw = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(raw.message || `Request failed (${res.status})`);
        return raw.data !== undefined ? raw.data : raw;
    }

    // -- Profile ----------------------------------------------------------
    async function getMe() {
        return jsonFetch("/staff/me");
    }

    // -- Onboarding ---------------------------------------------------------
    async function getOnboarding() {
        return jsonFetch("/staff/me/onboarding");
    }

    // -- Documents / Agreements -----------------------------------------------
    async function getDocuments() {
        return jsonFetch("/staff/me/documents");
    }

    async function acknowledgeDocument(documentId) {
        return jsonFetch("/staff/me/documents/" + documentId + "/acknowledge", {
            method: "POST",
        });
    }

    // -- Announcements --------------------------------------------------------
    async function getAnnouncements() {
        return jsonFetch("/staff/me/announcements");
    }

    async function markAnnouncementRead(announcementId) {
        return jsonFetch("/staff/me/announcements/" + announcementId + "/read", {
            method: "POST",
        });
    }

    // -- Directives / Tasks ----------------------------------------------------
    async function getDirectives() {
        return jsonFetch("/staff/me/directives");
    }

    async function updateDirectiveStatus(directiveId, status) {
        return jsonFetch("/staff/me/directives/" + directiveId + "/status", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status }),
        });
    }

    // -- Attendance -------------------------------------------------------------
    function getCurrentPosition() {
        function attempt(options) {
            return new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(
                    (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                    (err) => reject(err),
                    options,
                );
            });
        }

        return new Promise(async (resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Geolocation is not supported on this device.'));
                return;
            }
            try {
                const coords = await attempt({ enableHighAccuracy: true, timeout: 8000 });
                resolve(coords);
            } catch (firstErr) {
                // High-accuracy failed or timed out (common indoors) — retry with a coarser,
                // faster reading rather than failing the clock-in outright.
                try {
                    const coords = await attempt({ enableHighAccuracy: false, timeout: 8000 });
                    resolve(coords);
                } catch (secondErr) {
                    reject(new Error('Location access is required to clock in. Please enable it and try again.'));
                }
            }
        });
    }

    // -- Attendance -------------------------------------------------------------
    async function checkIn() {
        const coords = await getCurrentPosition();
        return jsonFetch("/staff/me/attendance/check-in", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(coords),
        });
    }

    async function checkOut() {
        const coords = await getCurrentPosition();
        return jsonFetch("/staff/me/attendance/check-out", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(coords),
        });
    }

    // -- Leave & Permission --------------------------------------------------------
    async function submitLeaveRequest(payload) {
        return jsonFetch("/staff/me/leave-requests", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
    }

    async function getMyLeaveRequests() {
        return jsonFetch("/staff/me/leave-requests");
    }

    async function approveLeaveRequest(id) {
        return jsonFetch("/staff/me/leave-requests/" + id + "/approve", { method: "PATCH" });
    }

    async function rejectLeaveRequest(id, reason) {
        return jsonFetch("/staff/me/leave-requests/" + id + "/reject", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reason }),
        });
    }

    async function reassignLeaveRequest(id, toApproverId, reason) {
        return jsonFetch("/staff/me/leave-requests/" + id + "/reassign", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ toApproverId, reason }),
        });
    }

    // -- My Approvals (generic, cross-module queue) -----------------------------
    async function getPendingApprovals() {
        return jsonFetch("/staff/me/approvals/pending");
    }

    async function getAttendance() {
        return jsonFetch("/staff/me/attendance");
    }

    // -- Inventory ----------------------------------------------------------------
    async function logInventoryEntry(payload) {
        return jsonFetch("/staff/me/inventory", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
    }

    async function getCompensation() {
        return jsonFetch("/staff/me/compensation");
    }

    // -- Onboarding self-submission ------------------------------------------------
    async function submitGuarantor(payload) {
        return jsonFetch("/staff/me/onboarding/guarantor", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
    }

    async function submitEmergencyContact(payload) {
        return jsonFetch("/staff/me/onboarding/emergency-contact", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
    }

    async function submitAddress(payload) {
        return jsonFetch("/staff/me/onboarding/address", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
    }

    async function submitReference(payload) {
        return jsonFetch("/staff/me/onboarding/reference", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
    }

    /**
     * Deliberately bypasses Auth.fetch here -- it unconditionally sets
     * Content-Type: application/json with no way to opt out, which breaks
     * multipart/form-data uploads (the browser needs to set its own
     * Content-Type including the boundary). Replicates Auth's own
     * base-URL + bearer-token handling manually instead.
     */
    async function uploadPassportPhoto(file) {
        const base = (window.API_BASE || "").replace(/\/$/, "");
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch(base + "/staff/me/onboarding/passport-photo", {
            method: "POST",
            headers: { Authorization: "Bearer " + Auth.getToken() },
            body: formData,
        });
        const raw = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(raw.message || `Upload failed (${res.status})`);
        return raw.data !== undefined ? raw.data : raw;
    }

    async function getMyPassportPhoto() {
        return jsonFetch("/staff/me/onboarding/passport-photo");
    }

    async function getInventoryDashboard() {
        return jsonFetch("/staff/me/inventory/dashboard");
    }

    async function getInventoryEntries() {
        return jsonFetch("/staff/me/inventory/entries");
    }

    // -- ID card ------------------------------------------------------------------
    function idCardUrl() {
        const base = (window.API_BASE || "").replace(/\/$/, "");
        return base + "/staff/me/id-card.pdf";
    }

    /** Downloads the ID card PDF using an authenticated fetch (the browser can't attach the JWT to a plain <a href>). */
    async function downloadIdCard() {
        const res = await Auth.fetch("/staff/me/id-card.pdf");
        if (!res.ok) throw new Error("Failed to generate ID card");
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "my-staff-id.pdf";
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    }

    // -- Formatting helpers, shared across screens ------------------------------------
    function fullName(staff) {
        return (staff && staff.name) || "-";
    }

    function initials(name) {
        if (!name) return "?";
        const parts = String(name).trim().split(/\s+/);
        return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "?";
    }

    function formatDate(value, opts) {
        if (!value) return "-";
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return String(value);
        return d.toLocaleDateString("en-GB", opts || { day: "2-digit", month: "short", year: "numeric" });
    }

    function formatTime(value) {
        if (!value) return "-";
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return "-";
        return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    }

    function timeAgo(value) {
        if (!value) return "-";
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return "-";
        const diffMs = Date.now() - d.getTime();
        const mins = Math.floor(diffMs / 60000);
        if (mins < 1) return "just now";
        if (mins < 60) return mins + " min" + (mins === 1 ? "" : "s") + " ago";
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return hrs + " hour" + (hrs === 1 ? "" : "s") + " ago";
        const days = Math.floor(hrs / 24);
        if (days < 7) return days + " day" + (days === 1 ? "" : "s") + " ago";
        return formatDate(value);
    }

    return {
        getMe,
        getOnboarding,
        getDocuments,
        acknowledgeDocument,
        getAnnouncements,
        markAnnouncementRead,
        getDirectives,
        updateDirectiveStatus,
        checkIn,
        checkOut,
        getAttendance,
        logInventoryEntry,
        submitGuarantor,
        submitEmergencyContact,
        submitAddress,
        submitReference,
        uploadPassportPhoto,
        getMyPassportPhoto,
        getInventoryDashboard,
        getInventoryEntries,
        idCardUrl,
        downloadIdCard,
        fullName,
        initials,
        formatDate,
        formatTime,
        timeAgo,
        submitLeaveRequest,
        getMyLeaveRequests,
        approveLeaveRequest,
        rejectLeaveRequest,
        reassignLeaveRequest,
        getPendingApprovals,
        getCompensation,
    };
})();