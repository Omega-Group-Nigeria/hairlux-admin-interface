/**
 * Commission Plans API helper: /admin/payroll/commission-plans
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

    /** Staff on a commission compensation type with no ACTIVE plan -- their bookings record 0% commission. */
    async function getStaffMissingPlan() {
        return apiFetch('/admin/payroll/commission-plans/staff/missing-plan');
    }

    /**
     * Recalculate 0%-recorded commissions with each staff member's current plan.
     * payload: { from: 'YYYY-MM-DD', to: 'YYYY-MM-DD', staffId?, dryRun (default true) }
     */
    async function recalculateCommissions(payload) {
        return apiFetch('/admin/payroll/commissions/recalculate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
    }

    /**
     * Commission Approvals queue. filters: { status (default PENDING | ALL), from, to, staffId, branchId, planId, page, limit }
     * Returns { data: [...], meta: { page, limit, total, totalPages }, totals: { count, amount } }.
     */
    async function listCommissions(filters = {}) {
        const q = new URLSearchParams();
        Object.keys(filters).forEach((k) => {
            if (filters[k] !== undefined && filters[k] !== null && filters[k] !== '') q.set(k, String(filters[k]));
        });
        const qs = q.toString();
        return apiFetch('/admin/payroll/commissions' + (qs ? '?' + qs : ''));
    }

    /** decision: 'approve' | 'reject'. ids: one or many (max 500). */
    async function decideCommissions(decision, ids, reason) {
        const body = { ids: ids };
        if (reason) body.reason = reason;
        return apiFetch(`/admin/payroll/commissions/${decision}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
    }

    async function decideCommission(decision, id, reason) {
        return apiFetch(`/admin/payroll/commissions/${id}/${decision}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(reason ? { reason: reason } : {}),
        });
    }

    function _esc(s) { return (s == null ? '' : String(s)).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }
    function _money(v) { return v == null ? '-' : '\u20a6' + Number(v).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

    /**
     * HTML for the payslipsRecalculated / payslipRecalcErrors part of a
     * recalculation or approval response (Awaiting Release periods: each
     * affected staff payslip is recalculated and its wallet reconciled).
     */
    function renderPayslipResults(res) {
        var ok = (res && res.payslipsRecalculated) || [];
        var errors = (res && res.payslipRecalcErrors) || [];
        if (!ok.length && !errors.length) return '';
        var html = '';
        if (ok.length) {
            html += '<div class="small fw-semibold mt-2 mb-1">Payslips recalculated automatically (Awaiting Release: wallet credits reconciled, still locked until Payday):</div>' +
                '<div class="table-responsive mb-2"><table class="table table-sm table-vcenter mb-0"><thead><tr>' +
                '<th>Staff</th><th>Period</th><th class="text-end">Commission</th><th class="text-end">Old net pay</th><th class="text-end">New net pay</th><th class="text-end">Difference</th><th class="text-end">Wallet</th>' +
                '</tr></thead><tbody>' +
                ok.map(function (r) {
                    return '<tr><td>' + _esc(r.staffName || r.staffId) + (r.warning ? '<div class="text-warning small">' + _esc(r.warning) + '</div>' : '') + '</td>' +
                        '<td>' + _esc(r.periodLabel) + '</td>' +
                        '<td class="text-end">' + _money(r.oldCommissionEarned) + ' \u2192 ' + _money(r.newCommissionEarned) + '</td>' +
                        '<td class="text-end">' + _money(r.oldNetPay) + '</td>' +
                        '<td class="text-end">' + _money(r.newNetPay) + '</td>' +
                        '<td class="text-end fw-semibold ' + (r.netPayDifference >= 0 ? 'text-success' : 'text-danger') + '">' + _money(r.netPayDifference) + '</td>' +
                        '<td class="text-end">' + (r.walletAdjusted ? _money(r.walletDelta) : '-') + '</td></tr>';
                }).join('') +
                '</tbody></table></div>';
        }
        if (errors.length) {
            html += '<div class="alert alert-danger small mb-2"><strong>Payslip recalculation failed for ' + errors.length + ' staff member(s)</strong>: their commission records were updated, but recalculate their payslip manually on the <a href="payroll.html">Payroll</a> page (period \u2192 staff \u2192 Recalculate):<ul class="mb-0">' +
                errors.map(function (e) { return '<li>' + _esc(e.staffName || e.staffId) + ' (' + _esc(e.periodLabel) + '): ' + _esc(e.error) + '</li>'; }).join('') +
                '</ul></div>';
        }
        return html;
    }

    function formatRate(rate) {
        return rate == null ? '-' : (Number(rate) * 100).toFixed(1) + '%';
    }

    return { getAll, getOne, create, update, remove, assignCompensation, getStaffMissingPlan, recalculateCommissions, listCommissions, decideCommissions, decideCommission, renderPayslipResults, formatRate };
})();