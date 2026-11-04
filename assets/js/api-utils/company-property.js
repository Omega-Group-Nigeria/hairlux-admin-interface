/**
 * Company Property API helper: /admin/company-property
 * Requires: auth.js (Auth.fetch)
 */
const CompanyProperty = (function () {
    async function apiFetch(path, options = {}) {
        const res = await Auth.fetch(path, options);
        const raw = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(Array.isArray(raw.message) ? raw.message.join(' ') : raw.message || `Request failed (${res.status})`);
        return raw.data !== undefined ? raw.data : raw;
    }
    const post = (path, body) => apiFetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });

    function qs(params) {
        const q = new URLSearchParams();
        Object.keys(params || {}).forEach((k) => { if (params[k] !== undefined && params[k] !== null && params[k] !== '') q.set(k, params[k]); });
        const s = q.toString();
        return s ? '?' + s : '';
    }

    return {
        list: (params) => apiFetch('/admin/company-property' + qs(params)),
        summary: () => apiFetch('/admin/company-property/summary'),
        get: (id) => apiFetch('/admin/company-property/' + id),
        create: (body) => post('/admin/company-property', body),
        update: (id, body) => apiFetch('/admin/company-property/' + id, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
        setCondition: (id, body) => post('/admin/company-property/' + id + '/condition', body),
        assign: (id, body) => post('/admin/company-property/' + id + '/assign', body),
        returnItem: (id, body) => post('/admin/company-property/' + id + '/return', body),
        transfer: (id, body) => post('/admin/company-property/' + id + '/transfer', body),
        transfers: (params) => apiFetch('/admin/company-property/transfers' + qs(params)),
        receive: (transferId, body) => post('/admin/company-property/transfers/' + transferId + '/receive', body),
        cancelTransfer: (transferId, body) => post('/admin/company-property/transfers/' + transferId + '/cancel', body),
        /** { branches (yours), allBranches (transfer targets), staff (active), suppliers } */
        options: () => apiFetch('/admin/company-property/options'),

        CATEGORIES: { EQUIPMENT: 'Equipment', TOOLS: 'Tools', ELECTRONICS: 'Electronics', FURNITURE: 'Furniture', VEHICLE: 'Vehicle', OTHER: 'Other' },
        CONDITIONS: { WORKING: 'Working', NEEDS_REPAIR: 'Needs repair', UNDER_REPAIR: 'Under repair', INOPERABLE: 'Inoperable', LOST: 'Lost', DISPOSED: 'Disposed' },
        CONDITION_BADGE: { WORKING: 'bg-success-lt', NEEDS_REPAIR: 'bg-warning-lt', UNDER_REPAIR: 'bg-azure-lt', INOPERABLE: 'bg-danger-lt', LOST: 'bg-dark-lt', DISPOSED: 'bg-secondary-lt' },
    };
})();
