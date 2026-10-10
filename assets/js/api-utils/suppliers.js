/**
 * Suppliers & Vendors API helper: /admin/suppliers
 * Requires: auth.js (Auth.fetch)
 */
const Suppliers = (function () {
    async function apiFetch(path, options = {}) {
        const res = await Auth.fetch(path, options);
        const raw = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(raw.message || `Request failed (${res.status})`);
        return raw.data !== undefined ? raw.data : raw;
    }

    async function getAll(type, activeOnly) {
        const q = new URLSearchParams();
        if (type) q.set('type', type);
        if (activeOnly) q.set('activeOnly', 'true');
        const qs = q.toString() ? '?' + q.toString() : '';
        return apiFetch(`/admin/suppliers${qs}`);
    }

    async function getOne(id) {
        return apiFetch(`/admin/suppliers/${id}`);
    }

    async function create(payload) {
        return apiFetch('/admin/suppliers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
    }

    async function update(id, payload) {
        return apiFetch(`/admin/suppliers/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
    }

    async function remove(id) {
        return apiFetch(`/admin/suppliers/${id}`, { method: 'DELETE' });
    }

    // ── Bank accounts (verified with Paystack; purchase payments go to one of them) ──

    let _banksCache = null;
    /** Banks (Paystack) for the account picker. */
    async function banks() {
        if (!_banksCache) _banksCache = await apiFetch('/admin/suppliers/banks');
        return _banksCache;
    }

    /** Account name for a bank + account number. Saves nothing. */
    async function resolveAccount(bankCode, accountNumber) {
        return apiFetch('/admin/suppliers/resolve-account', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bankCode, accountNumber }),
        });
    }

    async function bankAccounts(id) {
        return apiFetch(`/admin/suppliers/${id}/bank-accounts`);
    }

    async function addBankAccount(id, payload) {
        return apiFetch(`/admin/suppliers/${id}/bank-accounts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
    }

    /** payload: { isDefault } or { isActive } */
    async function updateBankAccount(id, accountId, payload) {
        return apiFetch(`/admin/suppliers/${id}/bank-accounts/${accountId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
    }

    /** Deleted if never paid to, otherwise deactivated (kept for payment history). */
    async function removeBankAccount(id, accountId) {
        return apiFetch(`/admin/suppliers/${id}/bank-accounts/${accountId}`, { method: 'DELETE' });
    }

    return { getAll, getOne, create, update, remove, banks, resolveAccount, bankAccounts, addBankAccount, updateBankAccount, removeBankAccount };
})();