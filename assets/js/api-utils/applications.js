/**
 * applications.js — Hairlux Admin
 * All /admin/applications/* API calls.
 *
 * Requires: auth.js (Auth.fetch)
 */

const Applications = (() => {

  /**
   * List applications (paginated, filterable).
   * @param {object} opts  { status?, search?, preferredLocationId?, jobId?, page?, limit? }
   */
  async function getAll({ status = '', search = '', preferredLocationId = '', jobId = '', page = 1, limit = 20 } = {}) {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (search) params.set('search', search);
    if (preferredLocationId) params.set('preferredLocationId', preferredLocationId);
    if (jobId) params.set('jobId', jobId);
    if (page) params.set('page', page);
    if (limit) params.set('limit', limit);
    const qs = params.toString() ? '?' + params.toString() : '';
    const res = await Auth.fetch(`/admin/applications${qs}`);
    const raw = await res.json().catch(() => ({}));
    return raw.data || raw;
  }

  /**
   * Get a single application.
   * @param {string} id
   */
  async function getOne(id) {
    const res = await Auth.fetch(`/admin/applications/${id}`);
    const raw = await res.json().catch(() => ({}));
    return raw.data || raw;
  }

  /**
   * Transition status. Not for EMPLOYED — use convertToStaff() for that.
   * @param {string} id
   * @param {object} payload  { status, reason? }
   */
  async function updateStatus(id, payload) {
    const res = await Auth.fetch(`/admin/applications/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(raw.message || 'Failed to update application status');
    return raw.data || raw;
  }

  /**
   * Schedule (or reschedule) an interview.
   * @param {string} id
   * @param {object} payload  { scheduledAt, locationId, interviewerName, note? }
   */
  async function scheduleInterview(id, payload) {
    const res = await Auth.fetch(`/admin/applications/${id}/schedule-interview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(raw.message || 'Failed to schedule interview');
    return raw.data || raw;
  }

  /**
 * Record the interview outcome — PASS/FAIL/HOLD — tied to a real interviewer.
 * @param {string} id
 * @param {object} payload  { outcome, interviewerId, note? }
 */
  async function recordInterviewOutcome(id, payload) {
    const res = await Auth.fetch(`/admin/applications/${id}/interview-outcome`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(raw.message || 'Failed to record interview outcome');
    return raw.data || raw;
  }

  /**
   * Record Employment Approval — the gate before an offer letter can be generated.
   * @param {string} id
   * @param {object} payload  { notes? }
   */
  async function recordEmploymentApproval(id, payload) {
    const res = await Auth.fetch(`/admin/applications/${id}/employment-approval`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(raw.message || 'Failed to record employment approval');
    return raw.data || raw;
  }

  /**
   * Generate and send an offer letter. Requires employment approval to already exist.
   * @param {string} id
   * @param {object} payload  { baseSalary, allowances?, compensationNote?, effectiveDate, templateUsed? }
   */
  async function generateOfferLetter(id, payload) {
    const res = await Auth.fetch(`/admin/applications/${id}/offer-letter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(raw.message || 'Failed to generate offer letter');
    return raw.data || raw;
  }

  /**
   * Mark an applicant as employed — creates the staff record via the staff
   * resource and links it back to this application.
   * @param {string} id
   * @param {object} payload  { locationId }
   */
  async function convertToStaff(id, payload) {
    const res = await Auth.fetch(`/admin/applications/${id}/convert-to-staff`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(raw.message || 'Failed to convert applicant to staff');
    return raw.data || raw;
  }

  /**
   * Active staff locations — used to populate the branch selects on the
   * Schedule Interview and Convert to Staff forms.
   */
  async function getLocations() {
    const res = await Auth.fetch('/admin/staff/locations');
    const raw = await res.json().catch(() => ({}));
    return raw.data || raw;
  }

  // ─── Display helpers ──────────────────────────────────────────────────────────

  const STATUS_ORDER = ['SUBMITTED', 'UNDER_REVIEW', 'SHORTLISTED', 'INTERVIEW_SCHEDULED', 'INTERVIEW_COMPLETED', 'OFFER_EXTENDED', 'EMPLOYED', 'NOT_SELECTED'];

  const STATUS_LABELS = {
    SUBMITTED: 'Submitted',
    UNDER_REVIEW: 'Under Review',
    SHORTLISTED: 'Shortlisted',
    INTERVIEW_SCHEDULED: 'Interview Scheduled',
    INTERVIEW_COMPLETED: 'Interview Completed',
    OFFER_EXTENDED: 'Offer Extended',
    EMPLOYED: 'Employed',
    NOT_SELECTED: 'Not Selected',
  };

  const STATUS_COLORS = {
    SUBMITTED: 'bg-blue-lt',
    UNDER_REVIEW: 'bg-yellow-lt',
    SHORTLISTED: 'bg-cyan-lt',
    INTERVIEW_SCHEDULED: 'bg-purple-lt',
    INTERVIEW_COMPLETED: 'bg-azure-lt',
    OFFER_EXTENDED: 'bg-lime-lt',
    EMPLOYED: 'bg-success-lt',
    NOT_SELECTED: 'bg-danger-lt',
  };

  // The single valid "forward" status transition for each current status,
  // excluding EMPLOYED (that's always via convertToStaff, never a plain
  // status PATCH) and NOT_SELECTED (offered from every non-terminal status,
  // handled separately in the UI rather than listed here).
  const NEXT_STATUS = {
    SUBMITTED: 'UNDER_REVIEW',
    UNDER_REVIEW: 'SHORTLISTED',
    INTERVIEW_COMPLETED: 'OFFER_EXTENDED',
  };

  function statusBadge(status) {
    const label = STATUS_LABELS[status] || status;
    const cls = STATUS_COLORS[status] || 'bg-secondary-lt';
    return `<span class="badge ${cls}">${label}</span>`;
  }

  function formatDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function formatDateTime(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) +
      ', ' + d.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit' });
  }

  async function getReport() {
    const res = await Auth.fetch('/admin/applications/report');
    const raw = await res.json().catch(() => ({}));
    return raw.data || raw;
  }

  return {
    getAll, getOne, updateStatus, scheduleInterview, convertToStaff, getLocations, getReport,
    recordInterviewOutcome, recordEmploymentApproval, generateOfferLetter,   // ← add
    STATUS_ORDER, STATUS_LABELS, STATUS_COLORS, NEXT_STATUS,
    statusBadge, formatDate, formatDateTime,
  };
})();