/**
 * Purchases API helper: /admin/purchases
 * Requires: auth.js (Auth.fetch)
 */
const Purchases = (function () {
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
        if (filters.vendorId) params.set('vendorId', filters.vendorId);
        if (filters.status) params.set('status', filters.status);
        if (filters.search) params.set('search', filters.search);
        if (filters.from) params.set('from', filters.from);
        if (filters.to) params.set('to', filters.to);
        const qs = params.toString();
        return apiFetch('/admin/purchases' + (qs ? '?' + qs : ''));
    }

    async function getOne(id) {
        return apiFetch(`/admin/purchases/${id}`);
    }

    async function recordPayment(id, payload) {
        return apiFetch(`/admin/purchases/${id}/payments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
    }

    async function receiveGoods(id, payload) {
        return apiFetch(`/admin/purchases/${id}/receive`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
    }

    /** Dev Feedback Round 9: Product Acceptance -- the separate review-and-credit-to-inventory step, now distinct from receiveGoods above. */
    async function acceptGoods(id, payload) {
        return apiFetch(`/admin/purchases/${id}/accept-goods`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
    }

    // ── Paying the vendor by Paystack transfer ───────────────────────────

    /** { grandTotal, amountPaid, processing, outstanding, vendor, accounts: [{ id, bankName, accountName, accountNumberMasked, isDefault }] } */
    async function paymentOptions(id) {
        return apiFetch(`/admin/purchases/${id}/payment-options`);
    }

    /** payload: { amount, vendorBankAccountId }. Returns the payment (transferStatus COMPLETED, PROCESSING or FAILED). */
    async function payVendor(id, payload) {
        return apiFetch(`/admin/purchases/${id}/transfers`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
    }

    async function retryTransfer(paymentId) {
        return apiFetch(`/admin/purchases/payments/${paymentId}/retry`, { method: 'POST' });
    }

    async function resyncTransfer(paymentId) {
        return apiFetch(`/admin/purchases/payments/${paymentId}/resync`, { method: 'POST' });
    }

    /** Paystack receipt for a paid transfer: { payment, receipt }. */
    async function transferReceipt(paymentId) {
        return apiFetch(`/admin/purchases/payments/${paymentId}/receipt`);
    }

    /** The receipt PDF as { blob, filename }. Fetched with the login token, so it cannot be a plain link. */
    async function transferReceiptPdf(paymentId) {
        const res = await Auth.fetch(`/admin/purchases/payments/${paymentId}/receipt.pdf`);
        if (!res.ok) {
            const raw = await res.json().catch(() => ({}));
            throw new Error(raw.message || `Could not load the receipt (${res.status})`);
        }
        const match = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') || '');
        return { blob: await res.blob(), filename: match ? match[1] : 'vendor-payment-receipt.pdf' };
    }

    return {
        getAll, getOne, recordPayment, receiveGoods, acceptGoods,
        paymentOptions, payVendor, retryTransfer, resyncTransfer, transferReceipt, transferReceiptPdf,
    };
})();