/**
 * Salon Bookings API helper (admin) — /admin/salon-bookings
 * Requires: auth.js (Auth.fetch)
 */
const SalonBookings = (function () {
    const STATUS_COLORS = {
        SCHEDULED: 'bg-azure-lt',
        IN_PROGRESS: 'bg-warning-lt',
        COMPLETED: 'bg-success-lt',
        CANCELLED: 'bg-secondary-lt',
        NO_SHOW: 'bg-danger-lt',
    };

    function statusBadge(status) {
        return '<span class="badge ' + (STATUS_COLORS[status] || 'bg-secondary-lt') + '">' + String(status || '').replace(/_/g, ' ') + '</span>';
    }

    function formatMoney(amount) {
        if (amount == null) return '—';
        return '₦' + Number(amount).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function formatDate(value) {
        if (!value) return '—';
        return new Date(value).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' });
    }

    async function apiFetch(path, options = {}) {
        const res = await Auth.fetch(path, options);
        const raw = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(raw.message || `Request failed (${res.status})`);
        return raw.data !== undefined ? raw.data : raw;
    }

    async function getAll(params = {}) {
        const q = new URLSearchParams();
        Object.keys(params).forEach((k) => {
            if (params[k] !== undefined && params[k] !== null && params[k] !== '') q.set(k, params[k]);
        });
        const qs = q.toString() ? '?' + q.toString() : '';
        return apiFetch(`/admin/salon-bookings${qs}`);
    }

    async function getOne(id) {
        return apiFetch(`/admin/salon-bookings/${id}`);
    }

    async function create(payload) {
        return apiFetch('/admin/salon-bookings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
    }

    async function previewDiscount(code, branchId, subtotal, customerId, customerPhone) {
        const q = new URLSearchParams({ code: code, branchId: branchId, subtotal: String(subtotal) });
        if (customerId) q.set('customerId', customerId);
        if (customerPhone) q.set('customerPhone', customerPhone);
        return apiFetch(`/admin/salon-bookings/preview-discount?${q.toString()}`);
    }

    async function editBooking(id, payload) {
        return apiFetch(`/admin/salon-bookings/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
    }

    async function addServiceToCompletedBooking(id, payload) {
        return apiFetch(`/admin/salon-bookings/${id}/add-service`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
    }

    async function addInventoryItem(id, payload) {
        return apiFetch(`/admin/salon-bookings/${id}/inventory-items`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
    }

    async function start(id) {
        return apiFetch(`/admin/salon-bookings/${id}/start`, { method: 'PATCH' });
    }

    async function complete(id) {
        return apiFetch(`/admin/salon-bookings/${id}/complete`, { method: 'PATCH' });
    }

    async function cancel(id, reason) {
        return apiFetch(`/admin/salon-bookings/${id}/cancel`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason }),
        });
    }

    async function noShow(id, reason) {
        return apiFetch(`/admin/salon-bookings/${id}/no-show`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason }),
        });
    }

    async function verifyCode(code) {
        return apiFetch(`/admin/salon-bookings/verify/${encodeURIComponent(code)}`);
    }

    async function findAllCustomers(params = {}) {
        const q = new URLSearchParams();
        Object.keys(params).forEach((k) => {
            if (params[k] !== undefined && params[k] !== null && params[k] !== '') q.set(k, params[k]);
        });
        const qs = q.toString() ? '?' + q.toString() : '';
        return apiFetch(`/admin/salon-bookings/customers${qs}`);
    }

    async function getCustomerContactsPerformance(params = {}) {
        const q = new URLSearchParams();
        Object.keys(params).forEach((k) => {
            if (params[k] !== undefined && params[k] !== null && params[k] !== '') q.set(k, params[k]);
        });
        const qs = q.toString() ? '?' + q.toString() : '';
        return apiFetch(`/admin/salon-bookings/customers/performance${qs}`);
    }

    async function getCustomerProfile(id) {
        return apiFetch(`/admin/salon-bookings/customers/${id}/profile`);
    }

    async function getCustomerClassificationSettings() {
        return apiFetch('/admin/salon-bookings/customers/classification-settings');
    }

    async function updateCustomerClassificationSettings(payload) {
        return apiFetch('/admin/salon-bookings/customers/classification-settings', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
    }

    async function searchCustomers(q) {
        if (!q) return [];
        return apiFetch(`/admin/salon-bookings/customers/search?q=${encodeURIComponent(q)}`);
    }

    async function checkPhoneMatch(phone) {
        if (!phone) return { hasMatch: false };
        return apiFetch(`/admin/salon-bookings/customers/check-phone?phone=${encodeURIComponent(phone)}`);
    }

    async function getOverview(params = {}) {
        const q = new URLSearchParams();
        Object.keys(params).forEach((k) => {
            if (params[k] !== undefined && params[k] !== null && params[k] !== '') q.set(k, params[k]);
        });
        const qs = q.toString() ? '?' + q.toString() : '';
        return apiFetch(`/admin/salon-bookings/overview${qs}`);
    }

    async function deleteBooking(id) {
        return apiFetch(`/admin/salon-bookings/${id}`, { method: 'DELETE' });
    }

    async function confirmVerification(code, assignedStaffId) {
        return apiFetch(`/admin/salon-bookings/verify/${encodeURIComponent(code)}/confirm`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ assignedStaffId }),
        });
    }

    return {
        getAll, getOne, create, previewDiscount, editBooking, addServiceToCompletedBooking,
        addInventoryItem, start, complete, cancel, noShow,
        verifyCode, confirmVerification, searchCustomers, checkPhoneMatch, findAllCustomers,
        getCustomerContactsPerformance, getCustomerProfile,
        getCustomerClassificationSettings, updateCustomerClassificationSettings,
        getOverview, deleteBooking,
        statusBadge, formatMoney, formatDate,
    };
})();