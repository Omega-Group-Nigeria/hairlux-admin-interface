/**
 * Software Costs API helper: /admin/software-costs
 * Paid services that run the software (servers, domains, providers), their
 * payments and reminder emails. Not part of Business Intelligence or Expenses.
 * Requires: auth.js (Auth.fetch, Auth.getToken)
 */
const SoftwareCosts = (function () {
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

    const base = '/admin/software-costs';

    let _options = null;
    async function options() {
        if (!_options) _options = await apiFetch(base + '/options');
        return _options;
    }

    function recipientOptions() { return apiFetch(base + '/recipient-options'); }
    function summary(year) { return apiFetch(base + '/summary' + qs({ year })); }

    function listServices(params) { return apiFetch(base + '/services' + qs(params)); }
    function getService(id) { return apiFetch(`${base}/services/${id}`); }
    function createService(payload) { return apiFetch(base + '/services', jsonBody('POST', payload)); }
    function updateService(id, payload) { return apiFetch(`${base}/services/${id}`, jsonBody('PATCH', payload)); }
    function setStatus(id, status, cancelledAt) { return apiFetch(`${base}/services/${id}/status`, jsonBody('PATCH', { status, cancelledAt })); }
    function deleteService(id) { return apiFetch(`${base}/services/${id}`, { method: 'DELETE' }); }
    function testReminder(id) { return apiFetch(`${base}/services/${id}/test-reminder`, { method: 'POST' }); }

    function listPayments(params) { return apiFetch(base + '/payments' + qs(params)); }
    function recordPayment(serviceId, payload) { return apiFetch(`${base}/services/${serviceId}/payments`, jsonBody('POST', payload)); }
    function updatePayment(paymentId, payload) { return apiFetch(`${base}/payments/${paymentId}`, jsonBody('PATCH', payload)); }
    function deletePayment(paymentId) { return apiFetch(`${base}/payments/${paymentId}`, { method: 'DELETE' }); }
    function receiptUrl(paymentId) { return apiFetch(`${base}/payments/${paymentId}/receipt`); }
    function removeReceipt(paymentId) { return apiFetch(`${base}/payments/${paymentId}/receipt`, { method: 'DELETE' }); }

    /** Multipart upload: Auth.fetch forces JSON, so this calls fetch directly. */
    async function uploadReceipt(paymentId, file) {
        const apiBase = (window.API_BASE || '').replace(/\/$/, '');
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch(`${apiBase}${base}/payments/${paymentId}/receipt`, {
            method: 'POST',
            headers: { Authorization: 'Bearer ' + Auth.getToken() },
            body: formData,
        });
        const raw = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(raw.message || `Upload failed (${res.status})`);
        return raw.data !== undefined ? raw.data : raw;
    }

    return {
        options, recipientOptions, summary,
        listServices, getService, createService, updateService, setStatus, deleteService, testReminder,
        listPayments, recordPayment, updatePayment, deletePayment, receiptUrl, removeReceipt, uploadReceipt,
    };
})();
