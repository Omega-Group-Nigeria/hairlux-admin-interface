const BranchFinance = (() => {
    async function apiFetch(path, options = {}) {
        const res = await Auth.fetch(path, options);
        const raw = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(raw.message || 'Request failed');
        return raw.data !== undefined ? raw.data : raw;
    }

    async function getDailySummary(params = {}) {
        const q = new URLSearchParams();
        Object.keys(params).forEach((k) => {
            if (params[k] !== undefined && params[k] !== null && params[k] !== '') q.set(k, params[k]);
        });
        const qs = q.toString() ? '?' + q.toString() : '';
        return apiFetch('/branch-finance/daily-summary' + qs);
    }

    async function submitReconciliation(payload) {
        return apiFetch('/branch-finance/reconciliation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
    }

    async function getSettings() {
        return apiFetch('/branch-finance/settings');
    }

    async function updateSettings(submissionDeadlineTime) {
        return apiFetch('/branch-finance/settings', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ submissionDeadlineTime }),
        });
    }

    function formatMoney(value) {
        var n = Number(value) || 0;
        return '₦' + n.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    return {
        getDailySummary,
        submitReconciliation,
        getSettings,
        updateSettings,
        formatMoney,
    };
})();