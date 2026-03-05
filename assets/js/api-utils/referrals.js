/**
 * referrals.js — Hairlux Admin
 * All /admin/referrals/* API calls.
 *
 * Requires:
 *   - config.js  (window.API_BASE)
 *   - auth.js    (Auth.fetch)
 */

const Referrals = (() => {

  // ─── GET /admin/referrals/stats ───────────────────────────────────────────────
  async function getStats() {
    const res = await Auth.fetch("/admin/referrals/stats");
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(raw.message || `Failed to load stats (${res.status})`);
    return raw.data || raw;
  }

  // ─── GET /admin/referrals/settings ───────────────────────────────────────────
  async function getSettings() {
    const res = await Auth.fetch("/admin/referrals/settings");
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(raw.message || `Failed to load settings (${res.status})`);
    return raw.data || raw;
  }

  // ─── PUT /admin/referrals/settings ───────────────────────────────────────────
  async function updateSettings(payload) {
    const res = await Auth.fetch("/admin/referrals/settings", {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(raw.message || `Failed to save settings (${res.status})`);
    return raw.data || raw;
  }

  // ─── GET /admin/referrals ─────────────────────────────────────────────────────
  /**
   * @param {object} params Optional: page, limit, search, status
   */
  async function getAll(params = {}) {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== "" && v != null) qs.set(k, v); });
    const url = "/admin/referrals" + (qs.toString() ? "?" + qs.toString() : "");
    const res = await Auth.fetch(url);
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(raw.message || `Failed to load referrals (${res.status})`);
    // Response shape: { data: [...], meta: { total, page, limit, totalPages } }
    return raw;
  }

  // ─── GET /admin/referrals/:userId ─────────────────────────────────────────────
  async function getByUser(userId) {
    const res = await Auth.fetch(`/admin/referrals/${userId}`);
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(raw.message || `Failed to load user referrals (${res.status})`);
    return raw.data || raw;
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────────
  function formatMoney(n) {
    return "₦" + Number(n || 0).toLocaleString("en-NG", { minimumFractionDigits: 2 });
  }

  function formatDate(dateStr) {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-NG", { day: "2-digit", month: "short", year: "numeric" });
  }

  const REWARD_STATUS_COLORS = {
    PENDING:  "warning",
    REWARDED: "success",
    FAILED:   "danger",
  };

  function rewardBadge(status) {
    if (!status) return '<span class="badge bg-secondary-lt">—</span>';
    const color = REWARD_STATUS_COLORS[status] || "secondary";
    return `<span class="badge bg-${color}-lt">${status}</span>`;
  }

  return {
    getStats,
    getSettings,
    updateSettings,
    getAll,
    getByUser,
    formatMoney,
    formatDate,
    rewardBadge,
  };
})();
