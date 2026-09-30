/**
 * Product Sales API helper (Admin/Super Admin) — /admin/product-sales
 * Data Accuracy & Audit, Phase 1/2 (2026-09-16): backs the Product Sales
 * admin page (list, view, record, and void a standalone product sale).
 * Requires: auth.js (Auth.fetch)
 */
const ProductSales = (function () {
    const STATUS_COLORS = {
        COMPLETED: 'bg-success-lt',
        VOIDED: 'bg-red-lt',
    };

    function statusBadge(status) {
        return '<span class="badge ' + (STATUS_COLORS[status] || 'bg-secondary-lt') + '">' + String(status || '').replace(/_/g, ' ') + '</span>';
    }

    function formatMoney(amount) {
        if (amount == null) return '—';
        return '₦' + Number(amount).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    async function apiFetch(path, options = {}) {
        const res = await Auth.fetch(path, options);
        const raw = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(raw.message || `Request failed (${res.status})`);
        return raw.data !== undefined ? raw.data : raw;
    }

    async function getAll(params = {}) {
        const q = new URLSearchParams();
        Object.keys(params).forEach((k) => {
            if (params[k] !== undefined && params[k] !== null && params[k] !== '') q.set(k, params[k]);
        });
        const qs = q.toString() ? '?' + q.toString() : '';
        return apiFetch(`/admin/product-sales${qs}`);
    }

    async function getOne(id) {
        return apiFetch(`/admin/product-sales/${id}`);
    }

    async function create(payload) {
        return apiFetch('/admin/product-sales', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
    }

    async function voidSale(id, reason) {
        return apiFetch(`/admin/product-sales/${id}/void`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason }),
        });
    }

    return { getAll, getOne, create, voidSale, statusBadge, formatMoney };
})();
