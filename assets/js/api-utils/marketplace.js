/**
 * Marketplace API helper: /admin/marketplace
 * Third-party vendors from the vendor site (separate from Suppliers): vendor
 * review and KYC documents, product approval, vendor orders, marketplace settings,
 * (Phase 3) balances, payouts, returns and category commission, and (Phase 4)
 * the Receiving Center: vendor stock deliveries, stock and withdrawals.
 * Requires: auth.js (Auth.fetch)
 */
const Marketplace = (function () {
    async function apiFetch(path, options = {}) {
        const res = await Auth.fetch(path, options);
        if (!res) throw new Error('Your session has ended. Please sign in again.');
        const raw = await res.json().catch(() => ({}));
        if (!res.ok) {
            const msg = Array.isArray(raw.message) ? raw.message.join('. ') : raw.message;
            throw new Error(msg || `Request failed (${res.status})`);
        }
        return raw.data !== undefined ? raw.data : raw;
    }

    function jsonBody(method, payload) {
        return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload || {}) };
    }

    function qs(params) {
        const q = new URLSearchParams();
        Object.keys(params || {}).forEach(function (k) {
            if (params[k] !== undefined && params[k] !== null && params[k] !== '') q.set(k, params[k]);
        });
        const s = q.toString();
        return s ? '?' + s : '';
    }

    const base = '/admin/marketplace';

    return {
        summary: () => apiFetch(base + '/summary'),
        getSettings: () => apiFetch(base + '/settings'),
        saveSettings: (payload) => apiFetch(base + '/settings', jsonBody('PUT', payload)),

        listVendors: (params) => apiFetch(base + '/vendors' + qs(params)),
        getVendor: (id) => apiFetch(`${base}/vendors/${id}`),
        documentUrl: (id, docId) => apiFetch(`${base}/vendors/${id}/documents/${docId}/url`),
        documentViews: (id, docId) => apiFetch(`${base}/vendors/${id}/documents/${docId}/views`),
        reviewDocument: (id, docId, status, note) => apiFetch(`${base}/vendors/${id}/documents/${docId}`, jsonBody('PATCH', { status, note })),
        verifyNin: (id) => apiFetch(`${base}/vendors/${id}/verify-nin`, { method: 'POST' }),
        verifyCac: (id) => apiFetch(`${base}/vendors/${id}/verify-cac`, { method: 'POST' }),
        decideVendor: (id, payload) => apiFetch(`${base}/vendors/${id}/decision`, jsonBody('POST', payload)),
        saveNotes: (id, payload) => apiFetch(`${base}/vendors/${id}/notes`, jsonBody('PATCH', payload)),
        updateDetails: (id, payload) => apiFetch(`${base}/vendors/${id}/details`, jsonBody('PATCH', payload)),
        setCommission: (id, commissionPercent) => apiFetch(`${base}/vendors/${id}/commission`, jsonBody('PATCH', { commissionPercent })),

        listProducts: (params) => apiFetch(base + '/products' + qs(params)),
        getProduct: (id) => apiFetch(`${base}/products/${id}`),
        decideProduct: (id, payload) => apiFetch(`${base}/products/${id}/decision`, jsonBody('POST', payload)),

        // Vendor orders (one per vendor per web shop order)
        listOrders: (params) => apiFetch(base + '/orders' + qs(params)),
        getOrder: (id) => apiFetch(`${base}/orders/${id}`),
        cancelOrder: (id, reason, restock) => apiFetch(`${base}/orders/${id}/cancel`, jsonBody('POST', { reason, restock })),
        listReturns: (id) => apiFetch(`${base}/orders/${id}/returns`),
        recordReturn: (id, payload) => apiFetch(`${base}/orders/${id}/returns`, jsonBody('POST', payload)),

        // Balances and payouts (Phase 3)
        payoutSummary: () => apiFetch(base + '/payouts/summary'),
        balances: (params) => apiFetch(base + '/balances' + qs(params)),
        vendorLedger: (id, params) => apiFetch(`${base}/vendors/${id}/ledger` + qs(params)),
        adjustBalance: (id, amount, note) => apiFetch(`${base}/vendors/${id}/adjustments`, jsonBody('POST', { amount, note })),
        listRuns: (params) => apiFetch(base + '/payout-runs' + qs(params)),
        getRun: (id) => apiFetch(`${base}/payout-runs/${id}`),
        prepareRun: (note) => apiFetch(base + '/payout-runs', jsonBody('POST', { note })),
        approveRun: (id) => apiFetch(`${base}/payout-runs/${id}/approve`, { method: 'POST' }),
        cancelRun: (id) => apiFetch(`${base}/payout-runs/${id}/cancel`, { method: 'POST' }),
        listPayouts: (params) => apiFetch(base + '/payouts' + qs(params)),
        approvePayout: (id) => apiFetch(`${base}/payouts/${id}/approve`, { method: 'POST' }),
        rejectPayout: (id, reason) => apiFetch(`${base}/payouts/${id}/reject`, jsonBody('POST', { reason })),
        markPaid: (id, reference) => apiFetch(`${base}/payouts/${id}/mark-paid`, jsonBody('POST', { reference })),
        markFailed: (id, reason) => apiFetch(`${base}/payouts/${id}/mark-failed`, jsonBody('POST', { reason })),
        checkPayout: (id) => apiFetch(`${base}/payouts/${id}/check`, { method: 'POST' }),

        // Receiving Center (Phase 4)
        rcIntakes: (params) => apiFetch(base + '/receiving-center/intakes' + qs(params)),
        rcIntake: (id) => apiFetch(`${base}/receiving-center/intakes/${id}`),
        rcReceive: (id, payload) => apiFetch(`${base}/receiving-center/intakes/${id}/receive`, jsonBody('POST', payload)),
        rcCancelIntake: (id, reason) => apiFetch(`${base}/receiving-center/intakes/${id}/cancel`, jsonBody('POST', { reason })),
        rcStock: (params) => apiFetch(base + '/receiving-center/stock' + qs(params)),
        rcMovements: (params) => apiFetch(base + '/receiving-center/stock/movements' + qs(params)),
        rcAdjust: (productId, quantity, reason) => apiFetch(`${base}/receiving-center/stock/${productId}/adjust`, jsonBody('POST', { quantity, reason })),
        rcWithdrawals: (params) => apiFetch(base + '/receiving-center/withdrawals' + qs(params)),
        rcApproveWithdrawal: (id, note) => apiFetch(`${base}/receiving-center/withdrawals/${id}/approve`, jsonBody('POST', { note })),
        rcRejectWithdrawal: (id, note) => apiFetch(`${base}/receiving-center/withdrawals/${id}/reject`, jsonBody('POST', { note })),
        rcCollectedWithdrawal: (id, collectedBy) => apiFetch(`${base}/receiving-center/withdrawals/${id}/collected`, jsonBody('POST', { collectedBy })),

        // Category commission (Phase 3)
        categories: () => apiFetch(base + '/categories'),
        setCategoryCommission: (id, marketplaceCommissionPercent) => apiFetch(`${base}/categories/${id}/commission`, jsonBody('PATCH', { marketplaceCommissionPercent })),
    };
})();
