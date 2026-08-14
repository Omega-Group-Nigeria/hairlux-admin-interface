/**
 * Salon Bookings API helper (staff self-service) — /staff/me/salon-bookings
 * Requires: auth.js (Auth.fetch)
 */
const SalonBookingsSelf = (function () {
    async function jsonFetch(path, options) {
        const res = await Auth.fetch(path, options);
        const raw = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(raw.message || 'Request failed');
        return raw.data !== undefined ? raw.data : raw;
    }

    async function getAll(params = {}) {
        const q = new URLSearchParams();
        Object.keys(params).forEach((k) => {
            if (params[k] !== undefined && params[k] !== null && params[k] !== '') q.set(k, params[k]);
        });
        const qs = q.toString() ? '?' + q.toString() : '';
        return jsonFetch(`/staff/me/salon-bookings${qs}`);
    }

    async function getOne(id) {
        return jsonFetch(`/staff/me/salon-bookings/${id}`);
    }

    async function getBranchStaff() {
        return jsonFetch('/staff/me/salon-bookings/branch-staff');
    }

    async function getMyCommission() {
        return jsonFetch('/staff/me/salon-bookings/commission');
    }

    async function searchCustomers(q) {
        if (!q) return [];
        return jsonFetch('/staff/me/salon-bookings/customers/search?q=' + encodeURIComponent(q));
    }

    async function create(payload) {
        return jsonFetch('/staff/me/salon-bookings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
    }

    async function editBooking(id, payload) {
        return jsonFetch(`/staff/me/salon-bookings/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
    }

    async function addServiceToCompletedBooking(id, payload) {
        return jsonFetch(`/staff/me/salon-bookings/${id}/add-service`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
    }

    async function getTodayStylistPerformance() {
        return jsonFetch('/staff/me/salon-bookings/performance/today');
    }

    async function addInventoryItem(id, payload) {
        return jsonFetch(`/staff/me/salon-bookings/${id}/inventory-items`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
    }

    async function start(id) {
        return jsonFetch(`/staff/me/salon-bookings/${id}/start`, { method: 'PATCH' });
    }

    async function complete(id) {
        return jsonFetch(`/staff/me/salon-bookings/${id}/complete`, { method: 'PATCH' });
    }

    async function cancel(id, reason) {
        return jsonFetch(`/staff/me/salon-bookings/${id}/cancel`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason }),
        });
    }

    async function noShow(id, reason) {
        return jsonFetch(`/staff/me/salon-bookings/${id}/no-show`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason }),
        });
    }

    async function verifyCode(code) {
        return jsonFetch(`/staff/me/salon-bookings/verify/${encodeURIComponent(code)}`);
    }

    async function confirmVerification(code, assignedStaffId) {
        return jsonFetch(`/staff/me/salon-bookings/verify/${encodeURIComponent(code)}/confirm`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ assignedStaffId }),
        });
    }

    return {
        getAll, getOne, getBranchStaff, getMyCommission, searchCustomers,
        create, editBooking, addServiceToCompletedBooking, getTodayStylistPerformance,
        addInventoryItem, start, complete, cancel, noShow, verifyCode, confirmVerification,
    }; 
})();