/**
 * Users API helper — /admin/users/*
 * Depends on auth.js (Auth.fetch) being loaded first.
 */
const Users = (() => {

    // ── API calls ─────────────────────────────────────────────────────────────

    async function getAll(params = {}) {
        const q = new URLSearchParams();
        if (params.search)   q.set("search",   params.search);
        if (params.status)   q.set("status",   params.status);
        if (params.role)     q.set("role",     params.role);
        if (params.page)     q.set("page",     params.page);
        if (params.limit)    q.set("limit",    params.limit);
        const res = await Auth.fetch("/admin/users?" + q.toString());
        const raw = await res.json();
        if (!res.ok) throw new Error(raw.message || "Failed to load users");
        // Paginated shape: { data: [...], meta: { total, page, limit, totalPages } }
        if (raw.data !== undefined && raw.meta !== undefined) {
            return { data: Array.isArray(raw.data) ? raw.data : [], meta: raw.meta };
        }
        // Fallback for flat responses
        const payload = raw.data || raw;
        if (Array.isArray(payload)) return { data: payload, meta: {} };
        return payload;
    }

    async function getOne(id) {
        const res = await Auth.fetch("/admin/users/" + id);
        const raw = await res.json();
        if (!res.ok) throw new Error(raw.message || "Failed to load user");
        return raw.data || raw;
    }

    async function getUserTransactions(id, params = {}) {
        const q = new URLSearchParams();
        if (params.type)   q.set("type",   params.type);
        if (params.status) q.set("status", params.status);
        if (params.page)   q.set("page",   params.page);
        if (params.limit)  q.set("limit",  params.limit);
        const res = await Auth.fetch("/admin/users/" + id + "/transactions?" + q.toString());
        const raw = await res.json();
        if (!res.ok) throw new Error(raw.message || "Failed to load user transactions");
        const payload = raw.data || raw;
        if (Array.isArray(payload)) return { data: payload, meta: {} };
        // API returns { transactions: [...], pagination: {...} }
        return {
            data: payload.transactions || payload.data || [],
            meta: payload.pagination  || payload.meta  || {},
        };
    }

    async function createAdmin(data) {
        const res = await Auth.fetch("/admin/users", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
        });
        const raw = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(raw.message || "Failed to create admin user");
        return raw.data || raw;
    }

    async function getStats() {
        const res = await Auth.fetch("/admin/analytics/users");
        const raw = await res.json();
        if (!res.ok) throw new Error(raw.message || "Failed to load user stats");
        return raw.data || {};
    }

    async function updateStatus(id, status) {
        const res = await Auth.fetch("/admin/users/" + id + "/status", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: status }),
        });
        const raw = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(raw.message || "Failed to update status");
        return raw.data || raw;
    }

    // ── Display helpers ───────────────────────────────────────────────────────

    const STATUS_COLORS = {
        ACTIVE:   "success",
        INACTIVE: "danger",
        BANNED:   "danger",
        PENDING:  "warning",
    };

    const ROLE_COLORS = {
        SUPER_ADMIN: "danger",
        ADMIN:       "warning",
        STAFF:       "info",
        USER:        "secondary",
    };

    function statusBadge(isActive, status) {
        // API may return isActive boolean or status string
        if (typeof isActive === "boolean") {
            const color = isActive ? "success" : "secondary";
            const label = isActive ? "Active" : "Inactive";
            return '<span class="badge bg-' + color + '-lt">' + label + '</span>';
        }
        const s     = String(status || "").toUpperCase();
        const color = STATUS_COLORS[s] || "secondary";
        return '<span class="badge bg-' + color + '-lt">' + (status || "—") + '</span>';
    }

    function roleBadge(role) {
        const r     = String(role || "").toUpperCase();
        const color = ROLE_COLORS[r] || "secondary";
        const label = r.replace(/_/g, " ");
        return '<span class="badge bg-' + color + '-lt">' + (label || "—") + '</span>';
    }

    function formatMoney(n) {
        if (n === null || n === undefined || isNaN(Number(n))) return "—";
        return "₦" + Number(n).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function formatDate(dateStr) {
        if (!dateStr) return "—";
        const d = new Date(dateStr);
        if (isNaN(d)) return String(dateStr);
        return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    }

    function formatDateTime(dateStr) {
        if (!dateStr) return "—";
        const d = new Date(dateStr);
        if (isNaN(d)) return String(dateStr);
        return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
            + " · " + d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    }

    return { getAll, getOne, getStats, createAdmin, getUserTransactions, updateStatus, statusBadge, roleBadge, formatMoney, formatDate, formatDateTime };
})();
