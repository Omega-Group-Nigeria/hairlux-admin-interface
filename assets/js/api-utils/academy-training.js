/**
 * academy-training.js — Hairlux Admin
 * All /admin/academy/* API calls -- Frontend Build Roadmap Phase 2
 * (Academy In-Branch Training): Trainings, Curriculum Modules, Cohorts,
 * Waitlist, Settings, Sessions, Attendance, Assessment Results,
 * Eligibility and registration-scoped Certification.
 *
 * Requires:
 *   - config.js  (window.API_BASE)
 *   - auth.js    (Auth.fetch)
 */
const AcademyTraining = (() => {

  async function apiFetch(path, options = {}) {
    const res = await Auth.fetch(path, options);
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(raw.message || `Request failed (${res.status})`);
    return raw.data !== undefined ? raw.data : raw;
  }

  function buildQuery(params) {
    const qs = new URLSearchParams();
    Object.entries(params || {}).forEach(([k, v]) => { if (v !== "" && v != null) qs.set(k, v); });
    const s = qs.toString();
    return s ? "?" + s : "";
  }

  // ─── TRAININGS ─────────────────────────────────────────────────────────────

  function getTrainings() {
    return apiFetch("/admin/academy/trainings");
  }
  function getTraining(id) {
    return apiFetch(`/admin/academy/trainings/${id}`);
  }
  function createTraining(payload) {
    return apiFetch("/admin/academy/trainings", { method: "POST", body: JSON.stringify(payload) });
  }
  function updateTraining(id, payload) {
    return apiFetch(`/admin/academy/trainings/${id}`, { method: "PUT", body: JSON.stringify(payload) });
  }
  function deleteTraining(id) {
    return apiFetch(`/admin/academy/trainings/${id}`, { method: "DELETE" });
  }

  // ─── CURRICULUM MODULES ──────────────────────────────────────────────────

  function addCurriculumModule(trainingId, payload) {
    return apiFetch(`/admin/academy/trainings/${trainingId}/curriculum-modules`, { method: "POST", body: JSON.stringify(payload) });
  }
  function updateCurriculumModule(trainingId, moduleId, payload) {
    return apiFetch(`/admin/academy/trainings/${trainingId}/curriculum-modules/${moduleId}`, { method: "PUT", body: JSON.stringify(payload) });
  }
  function removeCurriculumModule(trainingId, moduleId) {
    return apiFetch(`/admin/academy/trainings/${trainingId}/curriculum-modules/${moduleId}`, { method: "DELETE" });
  }

  // ─── COHORTS ───────────────────────────────────────────────────────────────
  // No pagination on these endpoints -- see academy-commerce.js's own note;
  // same reality here (listCohorts has no take/skip at all -- unbounded but
  // in practice small; registrations/waitlist are capped at 200).

  function getCohorts(filters) {
    return apiFetch("/admin/academy/cohorts" + buildQuery(filters));
  }
  function getCohort(id) {
    return apiFetch(`/admin/academy/cohorts/${id}`);
  }
  function createCohort(payload) {
    return apiFetch("/admin/academy/cohorts", { method: "POST", body: JSON.stringify(payload) });
  }
  function updateCohort(id, payload) {
    return apiFetch(`/admin/academy/cohorts/${id}`, { method: "PUT", body: JSON.stringify(payload) });
  }
  function getCohortRegistrations(cohortId) {
    return apiFetch(`/admin/academy/cohorts/${cohortId}/registrations`);
  }
  // GET .../waitlist -- Frontend Build Roadmap Phase 2 addition; did not
  // exist before this build (only the write-side promote did).
  function getCohortWaitlist(cohortId) {
    return apiFetch(`/admin/academy/cohorts/${cohortId}/waitlist`);
  }
  function promoteWaitlist(cohortId) {
    return apiFetch(`/admin/academy/waitlist/${cohortId}/promote`, { method: "POST" });
  }
  function decideBelowMinimum(cohortId, payload) {
    return apiFetch(`/admin/academy/cohorts/${cohortId}/below-minimum-decision`, { method: "POST", body: JSON.stringify(payload) });
  }

  // ─── SETTINGS (singleton) ────────────────────────────────────────────────

  function getSettings() {
    return apiFetch("/admin/academy/settings");
  }
  function updateSettings(payload) {
    return apiFetch("/admin/academy/settings", { method: "PUT", body: JSON.stringify(payload) });
  }

  // ─── SESSIONS & ATTENDANCE ───────────────────────────────────────────────

  function getSessions(cohortId) {
    return apiFetch(`/admin/academy/cohorts/${cohortId}/sessions`);
  }
  function createSession(cohortId, payload) {
    return apiFetch(`/admin/academy/cohorts/${cohortId}/sessions`, { method: "POST", body: JSON.stringify(payload) });
  }
  function getSessionAttendance(sessionId) {
    return apiFetch(`/admin/academy/sessions/${sessionId}/attendance`);
  }
  function markAttendance(sessionId, entries) {
    return apiFetch(`/admin/academy/sessions/${sessionId}/attendance`, { method: "POST", body: JSON.stringify({ entries }) });
  }

  // ─── ASSESSMENTS & CERTIFICATION ─────────────────────────────────────────

  function recordAssessmentResult(payload) {
    return apiFetch("/admin/academy/assessment-results", { method: "POST", body: JSON.stringify(payload) });
  }
  // GET cohorts/:cohortId/assessment-results -- Frontend Build Roadmap
  // Phase 2 addition; did not exist before this build (only the write-side
  // recordAssessmentResult and the eligibility-gap view did).
  function getAssessmentResults(cohortId) {
    return apiFetch(`/admin/academy/cohorts/${cohortId}/assessment-results`);
  }
  function getEligibility(registrationId) {
    return apiFetch(`/admin/academy/registrations/${registrationId}/eligibility`);
  }
  function issueCertificateForRegistration(registrationId) {
    return apiFetch(`/admin/academy/registrations/${registrationId}/certificate`, { method: "POST" });
  }

  // ─── HELPERS ─────────────────────────────────────────────────────────────

  function formatMoney(n) {
    return "₦" + Number(n || 0).toLocaleString("en-NG", { minimumFractionDigits: 2 });
  }
  function formatDate(dateStr) {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-NG", { day: "2-digit", month: "short", year: "numeric" });
  }
  function formatDateTime(dateStr) {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleString("en-NG", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  }
  function toDateInputValue(dateStr) {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    return d.toISOString().split("T")[0];
  }

  function trainingStatusBadge(status) {
    const map = {
      DRAFT: "bg-secondary-lt text-secondary",
      PUBLISHED: "bg-success-lt text-success",
      UNPUBLISHED: "bg-warning-lt text-warning",
      COMING_SOON: "bg-info-lt text-info",
      ARCHIVED: "bg-secondary-lt text-secondary",
    };
    return '<span class="badge ' + (map[status] || "bg-secondary-lt") + '">' + (status || "—").replace("_", " ") + "</span>";
  }
  function cohortStatusBadge(status) {
    const map = {
      OPEN: "bg-success-lt text-success",
      FULL: "bg-warning-lt text-warning",
      ACTIVE: "bg-info-lt text-info",
      COMPLETED: "bg-secondary-lt text-secondary",
      CANCELLED: "bg-danger-lt text-danger",
      BELOW_MINIMUM: "bg-danger-lt text-danger",
    };
    return '<span class="badge ' + (map[status] || "bg-secondary-lt") + '">' + (status || "—").replace("_", " ") + "</span>";
  }
  function registrationStatusBadge(status) {
    const map = {
      DRAFT: "bg-secondary-lt text-secondary",
      PENDING_PAYMENT: "bg-warning-lt text-warning",
      CONFIRMED: "bg-success-lt text-success",
      WAITLISTED: "bg-info-lt text-info",
      CANCELLED: "bg-danger-lt text-danger",
      TRANSFERRED: "bg-secondary-lt text-secondary",
      EXPIRED: "bg-secondary-lt text-secondary",
    };
    return '<span class="badge ' + (map[status] || "bg-secondary-lt") + '">' + (status || "—").replace("_", " ") + "</span>";
  }
  function waitlistStatusBadge(status) {
    const map = {
      WAITING: "bg-info-lt text-info",
      OFFERED: "bg-warning-lt text-warning",
      ACCEPTED: "bg-success-lt text-success",
      EXPIRED: "bg-secondary-lt text-secondary",
    };
    return '<span class="badge ' + (map[status] || "bg-secondary-lt") + '">' + (status || "—") + "</span>";
  }
  function identityStatusBadge(status) {
    if (!status) return '<span class="text-secondary small">—</span>';
    const map = { PENDING: "bg-warning-lt text-warning", VERIFIED: "bg-success-lt text-success", FAILED: "bg-danger-lt text-danger" };
    return '<span class="badge ' + (map[status] || "bg-secondary-lt") + '">' + status + "</span>";
  }
  function attendanceStatusBadge(status) {
    const map = { PRESENT: "bg-success-lt text-success", ABSENT: "bg-danger-lt text-danger", LATE: "bg-warning-lt text-warning", EXCUSED: "bg-info-lt text-info" };
    return '<span class="badge ' + (map[status] || "bg-secondary-lt") + '">' + (status || "—") + "</span>";
  }

  return {
    getTrainings, getTraining, createTraining, updateTraining, deleteTraining,
    addCurriculumModule, updateCurriculumModule, removeCurriculumModule,
    getCohorts, getCohort, createCohort, updateCohort, getCohortRegistrations, getCohortWaitlist, promoteWaitlist, decideBelowMinimum,
    getSettings, updateSettings,
    getSessions, createSession, getSessionAttendance, markAttendance,
    recordAssessmentResult, getAssessmentResults, getEligibility, issueCertificateForRegistration,
    formatMoney, formatDate, formatDateTime, toDateInputValue,
    trainingStatusBadge, cohortStatusBadge, registrationStatusBadge, waitlistStatusBadge, identityStatusBadge, attendanceStatusBadge,
  };
})();
