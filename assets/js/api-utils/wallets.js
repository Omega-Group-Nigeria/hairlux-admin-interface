/**
 * Wallets API helper — /admin/wallets/*
 * Depends on auth.js (Auth.fetch) being loaded first.
 */
const Wallets = (() => {

    function normalizePaymentMethod(value) {
        return String(value || "").toUpperCase();
    }

    function normalizeTransaction(tx) {
        if (!tx || typeof tx !== "object") return tx;
        return {
            ...tx,
            paymentMethod: normalizePaymentMethod(tx.paymentMethod),
        };
    }

    // ── API calls ─────────────────────────────────────────────────────────────

    async function getStats(params = {}) {
        const q = new URLSearchParams();
        if (params.startDate) q.set("startDate", params.startDate);
        if (params.endDate)   q.set("endDate",   params.endDate);
        
        const res = await Auth.fetch("/admin/wallets/stats?" + q.toString());
        const raw = await res.json();
        if (!res.ok) throw new Error(raw.message || "Failed to load wallet stats");
        return raw.data || raw;
    }

    async function getAllTransactions(params = {}) {
        const q = new URLSearchParams();
        if (params.type)      q.set("type",      params.type);
        if (params.status)    q.set("status",    params.status);
        if (params.userId)    q.set("userId",    params.userId);
        if (params.startDate) q.set("startDate", params.startDate);
        if (params.endDate)   q.set("endDate",   params.endDate);
        if (params.page)      q.set("page",      params.page);
        if (params.limit)     q.set("limit",     params.limit);
        const res = await Auth.fetch("/admin/wallets/transactions?" + q.toString());
        const raw = await res.json();
        if (!res.ok) throw new Error(raw.message || "Failed to load transactions");
        const payload = raw.data || raw;
        if (Array.isArray(payload)) return { data: payload.map(normalizeTransaction), meta: {} };
        // API returns { transactions: [...], pagination: {...} }
        return {
            data: (payload.transactions || payload.data || []).map(normalizeTransaction),
            meta: payload.pagination  || payload.meta  || {},
        };
    }

    // ── Display helpers ───────────────────────────────────────────────────────

    const TX_TYPE_COLORS = {
        DEPOSIT:         "success",
        DEBIT:           "danger",
        CREDIT:          "info",
        BOOKING_PAYMENT: "primary",
        REFUND:          "warning",
        WITHDRAWAL:      "danger",
        ADJUSTMENT:      "secondary",
    };

    const TX_STATUS_COLORS = {
        SUCCESS:   "success",
        COMPLETED: "success",
        PENDING:   "warning",
        FAILED:    "danger",
    };

    const PAYMENT_METHOD_COLORS = {
        WALLET: "secondary",
        REFERRAL: "info",
        PAYSTACK: "primary",
        MONNIFY: "teal",
    };

    function typeBadge(type) {
        const color = TX_TYPE_COLORS[type] || "secondary";
        const label = (type || "").replace(/_/g, " ");
        return '<span class="badge bg-' + color + '-lt">' + label + '</span>';
    }

    function statusBadge(status) {
        const color = TX_STATUS_COLORS[status] || "secondary";
        return '<span class="badge bg-' + color + '-lt">' + (status || "—") + '</span>';
    }

    function paymentMethodBadge(paymentMethod) {
        const method = normalizePaymentMethod(paymentMethod);
        if (!method) return '<span class="text-secondary">—</span>';
        const color = PAYMENT_METHOD_COLORS[method] || "secondary";
        return '<span class="badge bg-' + color + '-lt">' + method.replace(/_/g, " ") + '</span>';
    }

    function formatMoney(n) {
        if (n === null || n === undefined || isNaN(Number(n))) return "—";
        return "₦" + Number(n).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function formatDateTime(dateStr) {
        if (!dateStr) return "—";
        const d = new Date(dateStr);
        if (isNaN(d)) return String(dateStr);
        return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
            + " · " + d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    }

    return {
        getStats, getAllTransactions,
        typeBadge, statusBadge, paymentMethodBadge, formatMoney, formatDateTime,
    };
})();
