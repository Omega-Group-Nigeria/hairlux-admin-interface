/**
 * Branch Bank Accounts API helper: /admin/branch-bank-accounts
 * Requires: auth.js (Auth.fetch)
 */
const BranchBankAccounts = (function () {
    async function apiFetch(path, options = {}) {
        const res = await Auth.fetch(path, options);
        const raw = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(raw.message || `Request failed (${res.status})`);
        return raw.data !== undefined ? raw.data : raw;
    }

    function jsonBody(method, payload) {
        return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload || {}) };
    }

    /** Every branch you can see: [{ branch, account, hasApprovedAccount, hasPendingChange }] */
    function list() { return apiFetch('/admin/branch-bank-accounts'); }

    let _banksCache = null;
    async function banks() {
        if (!_banksCache) _banksCache = await apiFetch('/admin/branch-bank-accounts/banks');
        return _banksCache;
    }

    function resolve(branchId, bankCode, accountNumber) {
        return apiFetch(`/admin/branch-bank-accounts/${branchId}/resolve`, jsonBody('POST', { bankCode, accountNumber }));
    }

    function submit(branchId, bankCode, accountNumber) {
        return apiFetch(`/admin/branch-bank-accounts/${branchId}`, jsonBody('PUT', { bankCode, accountNumber }));
    }

    function approve(branchId) {
        return apiFetch(`/admin/branch-bank-accounts/${branchId}/approve`, { method: 'POST' });
    }

    function reject(branchId, reason) {
        return apiFetch(`/admin/branch-bank-accounts/${branchId}/reject`, jsonBody('POST', { reason: reason || undefined }));
    }

    return { list, banks, resolve, submit, approve, reject };
})();
