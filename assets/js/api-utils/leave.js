/**
 * Leave & Permission Requests API helper (admin) — /admin/leave-requests
 * Requires: auth.js (Auth.fetch)
 */
const LeaveRequests = (function () {
    const TYPE_LABELS = {
        ANNUAL_LEAVE: 'Annual Leave',
        SICK_LEAVE: 'Sick Leave',
        CASUAL_LEAVE: 'Casual Leave',
        DAY_OFF: 'Day Off',
        PERMISSION_LATE_ARRIVAL: 'Permission — Late Arrival',
        PERMISSION_EARLY_DEPARTURE: 'Permission — Early Departure',
        OVERTIME_REQUEST: 'Overtime Request',
    };

    const STATUS_COLORS = {
        PENDING: 'bg-warning-lt',
        APPROVED: 'bg-success-lt',
        REJECTED: 'bg-danger-lt',
    };

    function statusBadge(status) {
        return '<span class="badge ' + (STATUS_COLORS[status] || 'bg-secondary-lt') + '">' + status + '</span>';
    }

    function formatDate(value) {
        if (!value) return '—';
        const d = new Date(value);
        return d.toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' });
    }

    /**
     * List leave requests, filterable by status/type/staff.
     * @param {object} params { status?, type?, staffId?, page?, limit? }
     */
    async function getAll(params = {}) {
        const q = new URLSearchParams();
        Object.keys(params).forEach((k) => {
            if (params[k] !== undefined && params[k] !== null && params[k] !== '') q.set(k, params[k]);
        });
        const qs = q.toString() ? '?' + q.toString() : '';
        const res = await Auth.fetch(`/admin/leave-requests${qs}`);
        const raw = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(raw.message || 'Failed to load leave requests');
        return raw.data || raw;
    }

    /** Dev Feedback Round 6, item #22 -- gated the same as this page's other endpoints (ADMIN/SUPER_ADMIN role only), sidestepping the staff:read permission mismatch that silently broke both staff dropdowns on this page for a plain ADMIN without that permission individually granted. */
    async function getStaffOptions() {
        const res = await Auth.fetch('/admin/leave-requests/staff-options');
        const raw = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(raw.message || 'Failed to load staff options');
        return raw.data || raw;
    }

    async function approve(id) {
        const res = await Auth.fetch(`/admin/leave-requests/${id}/approve`, { method: 'PATCH' });
        const raw = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(raw.message || 'Failed to approve request');
        return raw.data || raw;
    }

    async function reject(id, reason) {
        const res = await Auth.fetch(`/admin/leave-requests/${id}/reject`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason }),
        });
        const raw = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(raw.message || 'Failed to reject request');
        return raw.data || raw;
    }

    async function reassign(id, toApproverId, reason) {
        const res = await Auth.fetch(`/admin/leave-requests/${id}/reassign`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ toApproverId, reason }),
        });
        const raw = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(raw.message || 'Failed to reassign request');
        return raw.data || raw;
    }

    return { getAll, getStaffOptions, approve, reject, reassign, TYPE_LABELS, STATUS_COLORS, statusBadge, formatDate };
})();