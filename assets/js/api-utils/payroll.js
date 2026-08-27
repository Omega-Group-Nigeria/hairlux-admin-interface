/**
 * Payroll API helper (admin) — /admin/payroll
 * Requires: auth.js (Auth.fetch)
 */
const Payroll = (function () {
    async function apiFetch(path, options = {}) {
        const res = await Auth.fetch(path, options);
        const raw = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(raw.message || `Request failed (${res.status})`);
        return raw.data !== undefined ? raw.data : raw;
    }

    async function getDashboard() {
        return apiFetch('/admin/payroll/dashboard');
    }

    async function listBanks() {
        return apiFetch('/admin/payroll/banks');
    }

    async function setCompensation(staffId, payload) {
        return apiFetch(`/admin/payroll/staff/${staffId}/compensation`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
    }

    async function getCompensationHistory(staffId) {
        return apiFetch(`/admin/payroll/staff/${staffId}/compensation/history`);
    }

    async function getBankAccount(staffId) {
        return apiFetch(`/admin/payroll/bank-accounts/${staffId}`);
    }

    async function listPendingBankChanges() {
        return apiFetch('/admin/payroll/bank-accounts/pending');
    }

    async function approveBankChange(staffId) {
        return apiFetch(`/admin/payroll/bank-accounts/${staffId}/approve`, { method: 'PATCH' });
    }

    async function rejectBankChange(staffId) {
        return apiFetch(`/admin/payroll/bank-accounts/${staffId}/reject`, { method: 'PATCH' });
    }

    async function createPeriod(payload) {
        return apiFetch('/admin/payroll/periods', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
    }

    async function listPeriods() {
        return apiFetch('/admin/payroll/periods');
    }

    async function getPeriod(id) {
        return apiFetch(`/admin/payroll/periods/${id}`);
    }

    async function generatePayroll(id) {
        return apiFetch(`/admin/payroll/periods/${id}/generate`, { method: 'POST' });
    }

    async function approvePeriod(id) {
        return apiFetch(`/admin/payroll/periods/${id}/approve`, { method: 'PATCH' });
    }

    /** Dev Feedback Round 4, item #22 -- sends an AWAITING_RELEASE period back to Draft for correction. */
    async function requestCorrection(id, note) {
        return apiFetch(`/admin/payroll/periods/${id}/request-correction`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ note: note || undefined }),
        });
    }

    async function createAdjustment(periodId, payload) {
        return apiFetch(`/admin/payroll/periods/${periodId}/adjustments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
    }

    async function listAdjustments(periodId) {
        return apiFetch(`/admin/payroll/periods/${periodId}/adjustments`);
    }

    async function removeAdjustment(id) {
        return apiFetch(`/admin/payroll/adjustments/${id}`, { method: 'DELETE' });
    }

    async function getSettings() {
        return apiFetch('/admin/payroll/settings');
    }

    async function setReleaseActive(active) {
        return apiFetch('/admin/payroll/settings/release', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ active }),
        });
    }

    async function setPensionRate(rate) {
        return apiFetch('/admin/payroll/settings/pension-rate', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rate }),
        });
    }

    /** Dev Feedback Round 4, items #22-24 -- was single-param (status only); now takes the full filter set the backend supports. */
    async function listWithdrawals(filters = {}) {
        const q = new URLSearchParams();
        ['status', 'staffId', 'locationId', 'from', 'to', 'page', 'limit'].forEach((k) => {
            if (filters[k] !== undefined && filters[k] !== null && filters[k] !== '') q.set(k, filters[k]);
        });
        const qs = q.toString() ? `?${q.toString()}` : '';
        return apiFetch(`/admin/payroll/withdrawals${qs}`);
    }

    async function getAuditLog(filters = {}) {
        const q = new URLSearchParams();
        ['entityType', 'entityId', 'staffId', 'actorId', 'action', 'page', 'limit'].forEach((k) => {
            if (filters[k] !== undefined && filters[k] !== null && filters[k] !== '') q.set(k, filters[k]);
        });
        const qs = q.toString() ? `?${q.toString()}` : '';
        return apiFetch(`/admin/payroll/audit-log${qs}`);
    }

    function formatMoney(amount) {
        if (amount == null) return '\u2014';
        return '\u20a6' + Number(amount).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function formatDate(value) {
        if (!value) return '\u2014';
        return new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    }

    return {
        getDashboard, listBanks,
        setCompensation, getCompensationHistory,
        listPendingBankChanges, getBankAccount, approveBankChange, rejectBankChange,
        createPeriod, listPeriods, getPeriod, generatePayroll, approvePeriod, requestCorrection,
        createAdjustment, listAdjustments, removeAdjustment,
        getSettings, setReleaseActive, setPensionRate,
        listWithdrawals, getAuditLog,
        formatMoney, formatDate,
    };
})();