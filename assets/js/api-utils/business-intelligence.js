const BusinessIntelligence = (() => {
    async function apiFetch(path, options = {}) {
        const res = await Auth.fetch(path, options);
        const raw = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(raw.message || 'Request failed');
        return raw.data !== undefined ? raw.data : raw;
    }

    async function getBusinessSnapshot(params = {}) {
        const q = new URLSearchParams();
        Object.keys(params).forEach((k) => {
            if (params[k] !== undefined && params[k] !== null && params[k] !== '') q.set(k, params[k]);
        });
        const qs = q.toString() ? '?' + q.toString() : '';
        return apiFetch('/admin/business-intelligence/business-snapshot' + qs);
    }

    async function listTargets(periodType) {
        const qs = periodType ? '?periodType=' + periodType : '';
        return apiFetch('/admin/business-intelligence/targets' + qs);
    }

    async function setTarget(payload) {
        return apiFetch('/admin/business-intelligence/targets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
    }

    async function getPerformanceComparison(params = {}) {
        const q = new URLSearchParams();
        Object.keys(params).forEach((k) => {
            if (params[k] !== undefined && params[k] !== null && params[k] !== '') q.set(k, params[k]);
        });
        const qs = q.toString() ? '?' + q.toString() : '';
        return apiFetch('/admin/business-intelligence/performance-comparison' + qs);
    }

    async function backfillDailyKpiSnapshot(payload) {
        return apiFetch('/admin/business-intelligence/daily-kpi-snapshot/backfill', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload || {}),
        });
    }

    async function getCustomerInsights(params = {}) {
        const q = new URLSearchParams();
        Object.keys(params).forEach((k) => {
            if (params[k] !== undefined && params[k] !== null && params[k] !== '') q.set(k, params[k]);
        });
        const qs = q.toString() ? '?' + q.toString() : '';
        return apiFetch('/admin/business-intelligence/customer-insights' + qs);
    }

    async function getSalesInsights(params = {}) {
        const q = new URLSearchParams();
        Object.keys(params).forEach((k) => {
            if (params[k] !== undefined && params[k] !== null && params[k] !== '') q.set(k, params[k]);
        });
        const qs = q.toString() ? '?' + q.toString() : '';
        return apiFetch('/admin/business-intelligence/sales-insights' + qs);
    }

    async function getCostInsights(params = {}) {
        const q = new URLSearchParams();
        Object.keys(params).forEach((k) => {
            if (params[k] !== undefined && params[k] !== null && params[k] !== '') q.set(k, params[k]);
        });
        const qs = q.toString() ? '?' + q.toString() : '';
        return apiFetch('/admin/business-intelligence/cost-insights' + qs);
    }

    async function getInventoryInsights(params = {}) {
        const q = new URLSearchParams();
        Object.keys(params).forEach((k) => {
            if (params[k] !== undefined && params[k] !== null && params[k] !== '') q.set(k, params[k]);
        });
        const qs = q.toString() ? '?' + q.toString() : '';
        return apiFetch('/admin/business-intelligence/inventory-insights' + qs);
    }

    async function getFinancialPositionInsights() {
        return apiFetch('/admin/business-intelligence/financial-position');
    }

    async function getRevenueDrilldown(params = {}) {
        const q = new URLSearchParams();
        Object.keys(params).forEach((k) => {
            if (params[k] !== undefined && params[k] !== null && params[k] !== '') q.set(k, params[k]);
        });
        const qs = q.toString() ? '?' + q.toString() : '';
        return apiFetch('/admin/business-intelligence/revenue-drilldown' + qs);
    }

    async function getRevenueFiltered(params = {}) {
        const q = new URLSearchParams();
        Object.keys(params).forEach((k) => {
            if (params[k] !== undefined && params[k] !== null && params[k] !== '') q.set(k, params[k]);
        });
        const qs = q.toString() ? '?' + q.toString() : '';
        return apiFetch('/admin/business-intelligence/revenue-filtered' + qs);
    }

    async function getKpiRegistry() {
        return apiFetch('/admin/business-intelligence/kpi-registry');
    }

    async function getForecast(params = {}) {
        const q = new URLSearchParams();
        Object.keys(params).forEach((k) => {
            if (params[k] !== undefined && params[k] !== null && params[k] !== '') q.set(k, params[k]);
        });
        const qs = q.toString() ? '?' + q.toString() : '';
        return apiFetch('/admin/business-intelligence/forecast' + qs);
    }

    async function getAlerts(params = {}) {
        const q = new URLSearchParams();
        Object.keys(params).forEach((k) => {
            if (params[k] !== undefined && params[k] !== null && params[k] !== '') q.set(k, params[k]);
        });
        const qs = q.toString() ? '?' + q.toString() : '';
        return apiFetch('/admin/business-intelligence/alerts' + qs);
    }

    async function acknowledgeAlert(id) {
        return apiFetch('/admin/business-intelligence/alerts/' + id + '/acknowledge', { method: 'POST' });
    }

    async function resolveAlert(id) {
        return apiFetch('/admin/business-intelligence/alerts/' + id + '/resolve', { method: 'POST' });
    }

    async function runAlertDetection(date) {
        return apiFetch('/admin/business-intelligence/alerts/run-detection', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(date ? { date: date } : {}),
        });
    }

    function formatMoney(value) {
        var n = Number(value) || 0;
        return '₦' + n.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function formatPercent(value) {
        if (value === null || value === undefined) return '-';
        var n = Number(value);
        var sign = n > 0 ? '+' : '';
        return sign + n.toFixed(1) + '%';
    }

    return {
        getBusinessSnapshot,
        listTargets,
        setTarget,
        getPerformanceComparison,
        backfillDailyKpiSnapshot,
        getCustomerInsights,
        getSalesInsights,
        getCostInsights,
        getInventoryInsights,
        getFinancialPositionInsights,
        getRevenueDrilldown,
        getRevenueFiltered,
        getKpiRegistry,
        getForecast,
        getAlerts,
        acknowledgeAlert,
        resolveAlert,
        runAlertDetection,
        formatMoney,
        formatPercent,
    };
})();
