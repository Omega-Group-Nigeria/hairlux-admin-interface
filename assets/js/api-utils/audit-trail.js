/**
 * Audit Trail API helper (admin) — /admin/audit-trail
 * Depends on auth.js (Auth.fetch) being loaded first.
 */
const AuditTrail = (() => {
    async function apiFetch(path, options = {}) {
        const res = await Auth.fetch(path, options);
        const raw = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(raw.message || 'Request failed');
        return raw.data !== undefined ? raw.data : raw;
    }

    async function getAll(params = {}) {
        const q = new URLSearchParams();
        Object.keys(params).forEach((k) => {
            if (params[k] !== undefined && params[k] !== null && params[k] !== '') q.set(k, params[k]);
        });
        const qs = q.toString() ? '?' + q.toString() : '';
        return apiFetch('/admin/audit-trail' + qs);
    }

    async function getEntityTypes() {
        return apiFetch('/admin/audit-trail/entity-types');
    }

    const SOURCE_LABELS = { ROLE: 'Roles & Permissions', PAYROLL: 'Payroll', SYSTEM: 'System' };
    const SOURCE_BADGE = { ROLE: 'bg-purple-lt', PAYROLL: 'bg-azure-lt', SYSTEM: 'bg-secondary-lt' };

    function formatDate(value) {
        if (!value) return '-';
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return String(value);
        return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    }

    return { getAll, getEntityTypes, SOURCE_LABELS, SOURCE_BADGE, formatDate };
})();