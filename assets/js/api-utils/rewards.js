/**
 * rewards.js — Hairlux Admin
 * All /admin/rewards/* API calls -- Frontend Build Roadmap Phase 3
 * (Rewards & Loyalty Core): Tiers, Settings, Birthday Settings, Reports
 * (Dashboard), manual Adjustments, and staff-applied
 * transfer/redeem/profile/transactions for the Customer Lookup tab.
 *
 * Requires:
 *   - config.js  (window.API_BASE)
 *   - auth.js    (Auth.fetch)
 */
const Rewards = (() => {

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

  // ─── TIERS ───────────────────────────────────────────────────────────────

  function getTiers() {
    return apiFetch("/admin/rewards/tiers");
  }
  function createTier(payload) {
    return apiFetch("/admin/rewards/tiers", { method: "POST", body: JSON.stringify(payload) });
  }
  function updateTier(id, payload) {
    return apiFetch(`/admin/rewards/tiers/${id}`, { method: "PUT", body: JSON.stringify(payload) });
  }
  // DELETE tiers/:id -- Frontend Build Roadmap Phase 3 addition; the
  // service's deactivate-if-in-use logic existed before this build, but
  // nothing on the controller exposed it.
  function deleteTier(id) {
    return apiFetch(`/admin/rewards/tiers/${id}`, { method: "DELETE" });
  }

  // ─── SETTINGS (singleton) ────────────────────────────────────────────────

  function getSettings() {
    return apiFetch("/admin/rewards/settings");
  }
  function updateSettings(payload) {
    return apiFetch("/admin/rewards/settings", { method: "PUT", body: JSON.stringify(payload) });
  }
  function getBirthdaySettings() {
    return apiFetch("/admin/rewards/birthday-settings");
  }
  function updateBirthdaySettings(payload) {
    return apiFetch("/admin/rewards/birthday-settings", { method: "PUT", body: JSON.stringify(payload) });
  }

  // ─── REPORTS (Dashboard) ─────────────────────────────────────────────────

  function getReports(filters) {
    return apiFetch("/admin/rewards/reports" + buildQuery(filters));
  }

  // ─── MANUAL ADJUSTMENT ───────────────────────────────────────────────────

  function adjust(payload) {
    return apiFetch("/admin/rewards/adjustments", { method: "POST", body: JSON.stringify(payload) });
  }

  // ─── CUSTOMER LOOKUP (staff-applied) ─────────────────────────────────────

  function getCustomerProfile(userId) {
    return apiFetch(`/admin/rewards/customers/${userId}/profile`);
  }
  // GET customers/:userId/transactions -- Frontend Build Roadmap Phase 3
  // addition; listTransactions() was already exposed to a customer for
  // their OWN account, but nothing let staff pull a SPECIFIC customer's
  // ledger history for a support/front-desk lookup.
  function getCustomerTransactions(userId, page, limit) {
    return apiFetch(`/admin/rewards/customers/${userId}/transactions` + buildQuery({ page, limit }));
  }
  function transferCashback(userId, amount) {
    return apiFetch(`/admin/rewards/customers/${userId}/transfer`, { method: "POST", body: JSON.stringify({ amount }) });
  }
  function redeemPoints(userId, points) {
    return apiFetch(`/admin/rewards/customers/${userId}/redeem-points`, { method: "POST", body: JSON.stringify({ points }) });
  }

  // ─── HELPERS ─────────────────────────────────────────────────────────────

  function formatMoney(n) {
    return "₦" + Number(n || 0).toLocaleString("en-NG", { minimumFractionDigits: 2 });
  }
  function formatNumber(n) {
    return Number(n || 0).toLocaleString("en-NG");
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

  function transactionTypeBadge(type) {
    const map = {
      EARNED: "bg-success-lt text-success",
      TRANSFERRED: "bg-info-lt text-info",
      REDEEMED: "bg-info-lt text-info",
      ADJUSTED: "bg-warning-lt text-warning",
      BIRTHDAY: "bg-pink-lt text-pink",
      EXPIRED: "bg-secondary-lt text-secondary",
      REVERSED: "bg-danger-lt text-danger",
    };
    return '<span class="badge ' + (map[type] || "bg-secondary-lt") + '">' + (type || "—") + "</span>";
  }
  function rewardTypeBadge(type) {
    const map = { CASHBACK: "bg-green-lt text-green", POINTS: "bg-azure-lt text-azure" };
    return '<span class="badge ' + (map[type] || "bg-secondary-lt") + '">' + (type || "—") + "</span>";
  }

  return {
    getTiers, createTier, updateTier, deleteTier,
    getSettings, updateSettings, getBirthdaySettings, updateBirthdaySettings,
    getReports,
    adjust,
    getCustomerProfile, getCustomerTransactions, transferCashback, redeemPoints,
    formatMoney, formatNumber, formatDate, formatDateTime,
    transactionTypeBadge, rewardTypeBadge,
  };
})();
