/**
 * beauticians.js — Hairlux Admin
 * /admin/beauticians/* + /admin/settings/home-service +
 * /admin/settings/service-commission-rates + /admin/settings/dispatch +
 * /admin/payouts/* API calls.
 *
 * Requires:
 *   - config.js  (window.API_BASE)
 *   - auth.js    (Auth.fetch)
 */

const Beauticians = (() => {

    async function apiFetch(path, options = {}) {
        const res = await Auth.fetch(path, options);
        const raw = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(raw.message || `Request failed (${res.status})`);
        return raw.data !== undefined ? raw.data : raw;
    }

    function firstArray() {
        for (let i = 0; i < arguments.length; i++) {
            if (Array.isArray(arguments[i])) return arguments[i];
        }
        return [];
    }

    // ── 1. Beautician management ─────────────────────────────────────────────

    async function listBeauticians(params = {}) {
        const q = new URLSearchParams();
        if (params.page) q.set('page', params.page);
        if (params.limit) q.set('limit', params.limit);
        if (params.search) q.set('search', params.search);
        if (params.kycStatus) q.set('kycStatus', params.kycStatus);
        if (params.profileStatus) q.set('profileStatus', params.profileStatus);
        if (params.availabilityStatus) q.set('availabilityStatus', params.availabilityStatus);
        if (params.ratingMin !== undefined && params.ratingMin !== '') q.set('ratingMin', params.ratingMin);

        const res = await Auth.fetch('/admin/beauticians' + (q.toString() ? '?' + q.toString() : ''));
        const raw = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(raw.message || 'Failed to load beauticians');

        const payload = raw.data !== undefined ? raw.data : raw;
        if (Array.isArray(payload)) return { data: payload, meta: {} };
        return {
            data: firstArray(payload.beauticians, payload.items, payload.data),
            meta: payload.meta || payload.pagination || {},
        };
    }

    async function getBeautician(id) {
        return apiFetch('/admin/beauticians/' + id);
    }

    async function updateBeautician(id, payload) {
        return apiFetch('/admin/beauticians/' + id, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
    }

    /**
     * GET /admin/beauticians/:id/reviews
     * Customer reviews for a beautician profile (beautician_profiles.id).
     * @param {string} id
     * @param {{page?:number,limit?:number,sortBy?:'createdAt'|'rating',sortOrder?:'asc'|'desc',ratingMin?:number,ratingMax?:number,status?:string}} [params]
     */
    async function getBeauticianReviews(id, params = {}) {
        const q = new URLSearchParams();
        if (params.page) q.set('page', params.page);
        if (params.limit) q.set('limit', params.limit);
        if (params.sortBy) q.set('sortBy', params.sortBy);
        if (params.sortOrder) q.set('sortOrder', params.sortOrder);
        if (params.ratingMin !== undefined && params.ratingMin !== '') q.set('ratingMin', params.ratingMin);
        if (params.ratingMax !== undefined && params.ratingMax !== '') q.set('ratingMax', params.ratingMax);
        if (params.status) q.set('status', params.status);

        const res = await Auth.fetch(
            '/admin/beauticians/' + encodeURIComponent(id) + '/reviews' +
            (q.toString() ? '?' + q.toString() : '')
        );
        const raw = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(raw.message || 'Failed to load reviews');

        const payload = raw.data !== undefined ? raw.data : raw;
        if (Array.isArray(payload)) return { data: payload, meta: {} };
        return {
            data: firstArray(payload.reviews, payload.items, payload.data),
            meta: payload.meta || payload.pagination || {},
        };
    }

    async function getPendingProfileReviews(params = {}) {
        const q = new URLSearchParams();
        if (params.page) q.set('page', params.page);
        if (params.limit) q.set('limit', params.limit);
        if (params.submittedDaysAgoMin) q.set('submittedDaysAgoMin', params.submittedDaysAgoMin);

        const res = await Auth.fetch('/admin/beauticians/pending-profile-reviews' + (q.toString() ? '?' + q.toString() : ''));
        const raw = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(raw.message || 'Failed to load pending reviews');

        const payload = raw.data !== undefined ? raw.data : raw;
        return {
            data: firstArray(payload.beauticians, payload.items, payload.data),
            meta: payload.meta || payload.pagination || {},
        };
    }

    async function getPerformance(params = {}) {
        const q = new URLSearchParams();
        if (params.periodDays) q.set('periodDays', params.periodDays);
        return apiFetch('/admin/beauticians/performance' + (q.toString() ? '?' + q.toString() : ''));
    }

    // ── 2. KYC review ──────────────────────────────────────────────────────────

    async function approveKyc(id) {
        return apiFetch('/admin/beauticians/' + id + '/kyc/approve', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: '{}',
        });
    }

    async function rejectKyc(id, reason) {
        return apiFetch('/admin/beauticians/' + id + '/kyc/reject', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason }),
        });
    }

    // ── 3. Professional profile review ────────────────────────────────────────

    async function approveProfile(id, notes) {
        return apiFetch('/admin/beauticians/' + id + '/profile/approve', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ notes: notes || '' }),
        });
    }

    /**
     * PATCH /admin/beauticians/:id/profile/reject
     * @param {string} id
     * @param {string} reason - required rejection reason shown to beautician
     * @param {string} [notes]
     * @param {'FULL'|'VIDEO_ONLY'} [scope] - FULL (default) rejects whole profile;
     *   VIDEO_ONLY keeps profile locked and requires a new intro video only
     */
    async function rejectProfile(id, reason, notes, scope) {
        const body = { reason };
        if (notes) body.notes = notes;
        if (scope === 'FULL' || scope === 'VIDEO_ONLY') body.scope = scope;
        return apiFetch('/admin/beauticians/' + id + '/profile/reject', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
    }

    // ── 4. Service assignment ─────────────────────────────────────────────────

    async function listAssignedServices(id) {
        const data = await apiFetch('/admin/beauticians/' + id + '/services');
        return Array.isArray(data) ? data : data.data || data.services || [];
    }

    async function assignServices(id, serviceIds) {
        return apiFetch('/admin/beauticians/' + id + '/services', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ serviceIds }),
        });
    }

    // ── 5. Home service settings ─────────────────────────────────────────────

    async function getHomeServiceSettings() {
        return apiFetch('/admin/settings/home-service');
    }

    async function updateHomeServiceSettings(payload) {
        return apiFetch('/admin/settings/home-service', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
    }

    // ── 5a. Per-service commission overrides ─────────────────────────────────
    // Rates are beautician take-home fraction (0–1). Services without a row use
    // HomeServiceSettings.commissionRate. See documents/service-commission-rates.md

    /**
     * GET /admin/settings/service-commission-rates
     * Returns only services with an explicit override.
     * @returns {Promise<Array<{serviceId:string, serviceName:string, commissionRate:number, updatedAt:string}>>}
     */
    async function listServiceCommissionRates() {
        const data = await apiFetch('/admin/settings/service-commission-rates');
        return Array.isArray(data) ? data : firstArray(data && data.items, data && data.rates);
    }

    /**
     * PUT /admin/settings/service-commission-rates/:serviceId
     * Upsert override. commissionRate must be 0–1.
     */
    async function setServiceCommissionRate(serviceId, commissionRate) {
        return apiFetch('/admin/settings/service-commission-rates/' + encodeURIComponent(serviceId), {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ commissionRate }),
        });
    }

    /**
     * DELETE /admin/settings/service-commission-rates/:serviceId
     * Removes override so the service uses the platform default again.
     */
    async function deleteServiceCommissionRate(serviceId) {
        return apiFetch('/admin/settings/service-commission-rates/' + encodeURIComponent(serviceId), {
            method: 'DELETE',
        });
    }

    // ── 5b. Dispatch settings ──────────────────────────────────────────────────

    async function getDispatchSettings() {
        return apiFetch('/admin/settings/dispatch');
    }

    async function updateDispatchSettings(payload) {
        return apiFetch('/admin/settings/dispatch', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
    }

    /**
     * PATCH /admin/beauticians/:id/dispatch
     * @param {string} id - beautician profile id
     * @param {boolean|object} suspendedOrPayload - boolean for simple toggle, or payload:
     *   { suspended: true, durationHours?: 1–720, until?: ISO string, reason?: string }
     *   Use until or durationHours (not both). Omit both for indefinite suspend.
     *   { suspended: false } to resume (cancels probation job).
     */
    async function updateDispatch(id, suspendedOrPayload) {
        var body;
        if (suspendedOrPayload && typeof suspendedOrPayload === 'object') {
            body = { suspended: !!suspendedOrPayload.suspended };
            if (body.suspended) {
                if (suspendedOrPayload.durationHours != null && suspendedOrPayload.durationHours !== '') {
                    body.durationHours = Number(suspendedOrPayload.durationHours);
                }
                if (suspendedOrPayload.until) {
                    body.until = suspendedOrPayload.until;
                }
                if (suspendedOrPayload.reason) {
                    body.reason = String(suspendedOrPayload.reason).trim();
                }
            }
        } else {
            body = { suspended: !!suspendedOrPayload };
        }
        return apiFetch('/admin/beauticians/' + id + '/dispatch', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
    }

    // ── 6. Payouts ─────────────────────────────────────────────────────────────

    async function listPayouts(params = {}) {
        const q = new URLSearchParams();
        if (params.status) q.set('status', params.status);
        const path = '/admin/payouts' + (q.toString() ? '?' + q.toString() : '');
        const data = await apiFetch(path);
        if (Array.isArray(data)) return data;
        return data.data || data.payouts || data.items || [];
    }

    async function listPendingPayouts() {
        return listPayouts({ status: 'PENDING' });
    }

    async function processPayout(payoutRequestId) {
        return apiFetch('/admin/payouts/process', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ payoutRequestId }),
        });
    }

    /**
     * Live used / remaining capacity for today's platform payout pool.
     * Day boundary: Africa/Lagos. Counted statuses: PENDING, PROCESSING, COMPLETED.
     * @returns {Promise<{limit: number|null, used: number, remaining: number|null, dayStartsAt: string, timezone: string, unlimited: boolean}>}
     */
    async function getDailyPayoutPool() {
        return apiFetch('/admin/payouts/daily-pool');
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    const KYC_COLORS = {
        PENDING: 'warning',
        IN_PROGRESS: 'info',
        VERIFIED: 'success',
        REJECTED: 'danger',
        SUSPENDED: 'dark',
        NEEDS_REVIEW: 'orange',
    };

    const PROFILE_COLORS = {
        NOT_SUBMITTED: 'secondary',
        AWAITING_VIDEO: 'info',
        PENDING_REVIEW: 'warning',
        APPROVED: 'success',
        REJECTED: 'danger',
    };

    const AVAILABILITY_COLORS = {
        OFFLINE: 'secondary',
        ONLINE: 'success',
        ON_JOB: 'info',
    };

    const PAYOUT_STATUS_COLORS = {
        PENDING: 'warning',
        PROCESSING: 'info',
        COMPLETED: 'success',
        REJECTED: 'danger',
        CANCELLED: 'secondary',
    };

    function kycBadge(status) {
        const val = String(status || '').toUpperCase();
        const color = KYC_COLORS[val] || 'secondary';
        return '<span class="badge bg-' + color + '-lt">' + val.replace(/_/g, ' ') + '</span>';
    }

    function profileBadge(status) {
        const val = String(status || '').toUpperCase();
        const color = PROFILE_COLORS[val] || 'secondary';
        return '<span class="badge bg-' + color + '-lt">' + val.replace(/_/g, ' ') + '</span>';
    }

    function availabilityBadge(status) {
        const val = String(status || '').toUpperCase();
        const color = AVAILABILITY_COLORS[val] || 'secondary';
        return '<span class="badge bg-' + color + '-lt">' + val.replace(/_/g, ' ') + '</span>';
    }

    function statusBadge(isActive) {
        if (isActive === true || isActive === 'true') {
            return '<span class="badge bg-green-lt">Active</span>';
        }
        return '<span class="badge bg-red-lt">Inactive</span>';
    }

    function formatMoney(amount) {
        if (amount === null || amount === undefined) return '—';
        const num = typeof amount === 'string' ? parseFloat(amount) : amount;
        if (Number.isNaN(num)) return '—';
        return '\u20A6' + Number(num).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function formatDate(value) {
        if (!value) return '—';
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return String(value);
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    }

    function formatDateTime(value) {
        if (!value) return '—';
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return String(value);
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) +
            ' \u00b7 ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    }

    function formatBytes(bytes) {
        if (bytes === null || bytes === undefined || bytes === '') return '—';
        const num = typeof bytes === 'string' ? parseFloat(bytes) : Number(bytes);
        if (!Number.isFinite(num) || num < 0) return '—';
        if (num < 1024) return Math.round(num) + ' B';
        if (num < 1048576) return (num / 1024).toFixed(1) + ' KB';
        return (num / 1048576).toFixed(2) + ' MB';
    }

    function fullName(b) {
        const user = b.user || {};
        const parts = [user.firstName, user.lastName].filter(Boolean);
        if (parts.length) return parts.join(' ');
        return user.name || '—';
    }

    function dateOfBirth(b) {
        if (!b || typeof b !== 'object') return null;
        const user = b.user || {};
        return user.dateOfBirth || b.dateOfBirth || null;
    }

    function formatDateOfBirth(b) {
        return formatDate(dateOfBirth(b));
    }

    function beauticianUserId(b) {
        return (b && b.user && b.user.id) || b.userId || null;
    }

    function dispatchSuspendedUntil(b) {
        if (!b || typeof b !== 'object') return null;
        return b.dispatchSuspendedUntil || b.dispatchSuspendedUntilAt || b.suspendedUntil || null;
    }

    function dispatchSuspendedReason(b) {
        if (!b || typeof b !== 'object') return null;
        var r = b.dispatchSuspendedReason || b.suspendedReason || null;
        return r ? String(r) : null;
    }

    function dispatchSuspendedBadge(suspended, until) {
        if (suspended) {
            if (until) {
                return '<span class="badge bg-red-lt">Suspended until ' + formatDateTime(until) + '</span>';
            }
            return '<span class="badge bg-red-lt">Dispatch suspended</span>';
        }
        return '<span class="badge bg-green-lt">Dispatch active</span>';
    }

    function payoutStatusBadge(status) {
        const val = String(status || '').toUpperCase();
        const color = PAYOUT_STATUS_COLORS[val] || 'secondary';
        return '<span class="badge bg-' + color + '-lt">' + val.replace(/_/g, ' ') + '</span>';
    }

    return {
        // API methods
        listBeauticians,
        getBeautician,
        updateBeautician,
        getBeauticianReviews,
        getPendingProfileReviews,
        getPerformance,
        approveKyc,
        rejectKyc,
        approveProfile,
        rejectProfile,
        listAssignedServices,
        assignServices,
        getHomeServiceSettings,
        updateHomeServiceSettings,
        listServiceCommissionRates,
        setServiceCommissionRate,
        deleteServiceCommissionRate,
        getDispatchSettings,
        updateDispatchSettings,
        updateDispatch,
        listPayouts,
        listPendingPayouts,
        processPayout,
        getDailyPayoutPool,
        // Helpers
        kycBadge,
        profileBadge,
        availabilityBadge,
        payoutStatusBadge,
        statusBadge,
        formatMoney,
        formatDate,
        formatDateTime,
        formatBytes,
        fullName,
        dateOfBirth,
        formatDateOfBirth,
        beauticianUserId,
        dispatchSuspendedUntil,
        dispatchSuspendedReason,
        dispatchSuspendedBadge,
    };
})();
