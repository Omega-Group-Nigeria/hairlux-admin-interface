/**
 * Expense Requests API helper: /admin/expense-requests
 * Requires: auth.js (Auth.fetch)
 */
const ExpenseRequests = (function () {
    async function apiFetch(path, options = {}) {
        const res = await Auth.fetch(path, options);
        const raw = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(raw.message || `Request failed (${res.status})`);
        return raw.data !== undefined ? raw.data : raw;
    }

    async function getAll(filters) {
        filters = filters || {};
        const params = new URLSearchParams();
        if (filters.branchId) params.set('branchId', filters.branchId);
        if (filters.category) params.set('category', filters.category);
        if (filters.status) params.set('status', filters.status);
        if (filters.search) params.set('search', filters.search);
        if (filters.from) params.set('from', filters.from);
        if (filters.to) params.set('to', filters.to);
        if (filters.requestedByUserId) params.set('requestedByUserId', filters.requestedByUserId);
        const qs = params.toString();
        return apiFetch('/admin/expense-requests' + (qs ? '?' + qs : ''));
    }

    async function getOne(id) {
        return apiFetch(`/admin/expense-requests/${id}`);
    }

    async function create(payload) {
        return apiFetch('/admin/expense-requests', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
    }

    async function update(id, payload) {
        return apiFetch(`/admin/expense-requests/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
    }

    async function submit(id) {
        return apiFetch(`/admin/expense-requests/${id}/submit`, { method: 'POST' });
    }

    async function remove(id) {
        return apiFetch(`/admin/expense-requests/${id}`, { method: 'DELETE' });
    }

    async function approve(id, comment) {
        return apiFetch(`/admin/expense-requests/${id}/approve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ comment: comment || undefined }),
        });
    }

    async function reject(id, reason) {
        return apiFetch(`/admin/expense-requests/${id}/reject`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason: reason || undefined }),
        });
    }

    /** Change the amount of a Pending / Under Review request before final approval. */
    async function overrideAmount(id, amount, reason) {
        return apiFetch(`/admin/expense-requests/${id}/amount`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount, reason }),
        });
    }

    async function reverse(id, reason) {
        return apiFetch(`/admin/expense-requests/${id}/reverse`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason }),
        });
    }

    /** Retry a FAILED payout (or start one that never ran). */
    async function retryPayout(id) {
        return apiFetch(`/admin/expense-requests/${id}/payout/retry`, { method: 'POST' });
    }

    /** Ask Paystack for the latest status of a payout still in progress. */
    async function resyncPayout(id) {
        return apiFetch(`/admin/expense-requests/${id}/payout/resync`, { method: 'POST' });
    }

    /** Paystack transfer receipt for a paid payout: { expense, receipt }. */
    async function payoutReceipt(id) {
        return apiFetch(`/admin/expense-requests/${id}/payout-receipt`);
    }

    /**
     * The receipt PDF as { blob, filename }. Fetched with the login token,
     * so it cannot be a plain link.
     */
    async function payoutReceiptPdf(id) {
        const res = await Auth.fetch(`/admin/expense-requests/${id}/payout-receipt.pdf`);
        if (!res.ok) {
            const raw = await res.json().catch(() => ({}));
            throw new Error(raw.message || `Could not load the receipt (${res.status})`);
        }
        const match = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') || '');
        return { blob: await res.blob(), filename: match ? match[1] : 'payout-receipt.pdf' };
    }

    let _banksCache = null;
    /** Banks (Paystack) for the "Account to pay" picker. */
    async function banks() {
        if (!_banksCache) _banksCache = await apiFetch('/admin/expense-requests/banks');
        return _banksCache;
    }

    /** Account name for a bank + account number. Saves nothing. */
    async function resolveAccount(bankCode, accountNumber) {
        return apiFetch('/admin/expense-requests/resolve-account', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bankCode, accountNumber }),
        });
    }

    return { getAll, getOne, create, update, submit, remove, approve, reject, overrideAmount, reverse, retryPayout, resyncPayout, payoutReceipt, payoutReceiptPdf, banks, resolveAccount };
})();
