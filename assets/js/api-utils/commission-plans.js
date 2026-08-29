/**
 * Commission Plans API helper — /admin/payroll/commission-plans
 * Payroll Engine v2, Phase 4.
 * Requires: auth.js (Auth.fetch)
 */
const CommissionPlans = (function () {
    async function apiFetch(path, options = {}) {
        const res = await Auth.fetch(path, options);
        const raw = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(raw.message || `Request failed (${res.status})`);
        return raw.data !== undefined ? raw.data : raw;
    }

    async function getAll(isActive, branchId) {
        const q = new URLSearchParams();
        if (isActive !== undefined) q.set('isActive', String(isActive));
        if (branchId) q.set('branchId', branchId);
        const qs = q.toString();
        return apiFetch('/admin/payroll/commission-plans' + (qs ? '?' + qs : ''));
    }

    async function getOne(id) {
        return apiFetch(`/admin/payroll/commission-plans/${id}`);
    }

    async function create(payload) {
        return apiFetch('/admin/payroll/commission-plans', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
    }

    async function update(id, payload) {
        return apiFetch(`/admin/payroll/commission-plans/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
    }

    async function remove(id) {
        return apiFetch(`/admin/payroll/commission-plans/${id}`, { method: 'DELETE' });
    }

    async function assignCompensation(staffId, payload) {
        return apiFetch(`/admin/payroll/commission-plans/staff/${staffId}/assign`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
    }

    function formatRate(rate) {
        return rate == null ? '\u2014' : (Number(rate) * 100).toFixed(1) + '%';
    }

    return { getAll, getOne, create, update, remove, assignCompensation, formatRate };
})();