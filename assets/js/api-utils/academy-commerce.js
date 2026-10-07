/**
 * academy-commerce.js: Hairlux Admin
 * All /admin/academy-commerce/* API calls -- Frontend Build Roadmap Phase 1
 * (Shared Commerce Core): Orders, Refunds, Certificates.
 *
 * Requires:
 *   - config.js  (window.API_BASE)
 *   - auth.js    (Auth.fetch)
 */
const AcademyCommerce = (() => {

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

  // ─── ORDERS ────────────────────────────────────────────────────────────────
  // No pagination on this endpoint yet (capped server-side at 200 rows,
  // newest first) -- see the page's own note on this.

  // GET /admin/academy-commerce/orders
  function getOrders(filters) {
    return apiFetch("/admin/academy-commerce/orders" + buildQuery(filters));
  }

  // GET /admin/academy-commerce/orders/:id
  function getOrder(id) {
    return apiFetch(`/admin/academy-commerce/orders/${id}`);
  }

  // ─── REFUNDS ───────────────────────────────────────────────────────────────

  // GET /admin/academy-commerce/refunds
  function getRefunds(filters) {
    return apiFetch("/admin/academy-commerce/refunds" + buildQuery(filters));
  }

  // POST /admin/academy-commerce/refunds/:id/approve
  // Management-or-above only (academy_commerce:approve_refund) -- the one
  // call that can move a refund to PROCESSING.
  function approveRefund(id, payload) {
    return apiFetch(`/admin/academy-commerce/refunds/${id}/approve`, {
      method: "POST",
      body: JSON.stringify(payload || {}),
    });
  }

  // POST /admin/academy-commerce/refunds/:id/reject
  function rejectRefund(id, payload) {
    return apiFetch(`/admin/academy-commerce/refunds/${id}/reject`, {
      method: "POST",
      body: JSON.stringify(payload || {}),
    });
  }

  // ─── CERTIFICATES ──────────────────────────────────────────────────────────

  // GET /admin/academy-commerce/certificates
  function getCertificates(filters) {
    return apiFetch("/admin/academy-commerce/certificates" + buildQuery(filters));
  }

  // POST /admin/academy-commerce/certificates
  // body: { holderId, programType, programId, completionDate? }
  function issueCertificate(payload) {
    return apiFetch("/admin/academy-commerce/certificates", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  // POST /admin/academy-commerce/certificates/:id/revoke
  function revokeCertificate(id) {
    return apiFetch(`/admin/academy-commerce/certificates/${id}/revoke`, { method: "POST" });
  }

  // ─── REPORTS (Dashboard) ───────────────────────────────────────────────────
  // Frontend Build Roadmap Phase 5 -- GET /admin/academy-commerce/reports
  // already existed server-side (registered into the BI/KPI Engine
  // Registry, per-card permission redacted); this is just the client call.

  function getReports(filters) {
    return apiFetch("/admin/academy-commerce/reports" + buildQuery(filters));
  }

  // ─── HELPERS ───────────────────────────────────────────────────────────────
  // Same formatting convention as discounts.js / financial-transactions.js.

  function formatMoney(n) {
    return "₦" + Number(n || 0).toLocaleString("en-NG", { minimumFractionDigits: 2 });
  }

  function formatNumber(n) {
    return Number(n || 0).toLocaleString("en-NG");
  }

  function formatDate(dateStr) {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-NG", { day: "2-digit", month: "short", year: "numeric" });
  }

  function formatDateTime(dateStr) {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleString("en-NG", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  function programLabel(programType) {
    return programType === "TRAINING" ? "Training" : programType === "COURSE" ? "Digital Course" : (programType || "-");
  }

  function orderStatusBadge(status) {
    const map = {
      PENDING: "bg-warning-lt text-warning",
      PAID: "bg-success-lt text-success",
      EXPIRED: "bg-secondary-lt text-secondary",
      CANCELLED: "bg-danger-lt text-danger",
    };
    return '<span class="badge ' + (map[status] || "bg-secondary-lt") + '">' + (status || "-") + "</span>";
  }

  function refundStatusBadge(status) {
    const map = {
      REQUESTED: "bg-warning-lt text-warning",
      PENDING: "bg-warning-lt text-warning",
      APPROVED: "bg-info-lt text-info",
      PROCESSING: "bg-info-lt text-info",
      REFUNDED: "bg-success-lt text-success",
      REJECTED: "bg-danger-lt text-danger",
    };
    return '<span class="badge ' + (map[status] || "bg-secondary-lt") + '">' + (status || "-") + "</span>";
  }

  function certificateStatusBadge(status) {
    const map = {
      NOT_ELIGIBLE: "bg-secondary-lt text-secondary",
      ELIGIBLE: "bg-info-lt text-info",
      ISSUED: "bg-success-lt text-success",
      REVOKED: "bg-danger-lt text-danger",
    };
    const label = status === "NOT_ELIGIBLE" ? "Not Eligible" : (status || "-");
    return '<span class="badge ' + (map[status] || "bg-secondary-lt") + '">' + label + "</span>";
  }

  return {
    getOrders, getOrder,
    getRefunds, approveRefund, rejectRefund,
    getCertificates, issueCertificate, revokeCertificate,
    getReports,
    formatMoney, formatNumber, formatDate, formatDateTime, programLabel,
    orderStatusBadge, refundStatusBadge, certificateStatusBadge,
  };
})();
