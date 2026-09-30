/**
 * Vendor Ledger API helper — /admin/vendor-ledger
 * Requires: auth.js (Auth.fetch)
 */
const VendorLedger = (function () {
    async function apiFetch(path, options = {}) {
        const res = await Auth.fetch(path, options);
        const raw = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(raw.message || `Request failed (${res.status})`);
        return raw.data !== undefined ? raw.data : raw;
    }

    async function listBalances() {
        return apiFetch('/admin/vendor-ledger');
    }

    async function getVendorLedger(vendorId) {
        return apiFetch(`/admin/vendor-ledger/${vendorId}`);
    }

    async function createAdjustment(vendorId, payload) {
        return apiFetch(`/admin/vendor-ledger/${vendorId}/adjustments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
    }

    function formatMoney(amount) {
        if (amount == null) return '\u2014';
        return '\u20a6' + Number(amount).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    return { listBalances, getVendorLedger, createAdjustment, formatMoney };
})();