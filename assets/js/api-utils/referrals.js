/**
 * referrals.js — Hairlux Admin
 * All /admin/referrals/* API calls.
 *
 * Requires:
 *   - config.js  (window.API_BASE)
 *   - auth.js    (Auth.fetch)
 */

const Referrals = (() => {

  function getErrorMessage(raw, fallback) {
    if (!raw) return fallback;
    if (Array.isArray(raw.message)) return raw.message.join(", ");
    if (typeof raw.message === "string") return raw.message;
    return fallback;
  }

  function normalizeCampaignCode(item) {
    if (!item || typeof item !== "object") return item;
    return {
      ...item,
      code: String(item.code || "").toUpperCase(),
      usedCount: item.usedCount ?? (item._count && item._count.usages) ?? 0,
    };
  }

  // ─── GET /admin/referrals/stats ───────────────────────────────────────────────
  async function getStats() {
    const res = await Auth.fetch("/admin/referrals/stats");
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(getErrorMessage(raw, `Failed to load stats (${res.status})`));
    return raw.data || raw;
  }

  // ─── GET /admin/referrals/settings ───────────────────────────────────────────
  async function getSettings() {
    const res = await Auth.fetch("/admin/referrals/settings");
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(getErrorMessage(raw, `Failed to load settings (${res.status})`));
    return raw.data || raw;
  }

  // ─── PUT /admin/referrals/settings ───────────────────────────────────────────
  async function updateSettings(payload) {
    const res = await Auth.fetch("/admin/referrals/settings", {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(getErrorMessage(raw, `Failed to save settings (${res.status})`));
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
    if (!res.ok) throw new Error(getErrorMessage(raw, `Failed to load referrals (${res.status})`));
    // Response shape: { data: [...], meta: { total, page, limit, totalPages } }
    return raw;
  }

  // ─── GET /admin/referrals/:userId ─────────────────────────────────────────────
  async function getByUser(userId) {
    const res = await Auth.fetch(`/admin/referrals/${userId}`);
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(getErrorMessage(raw, `Failed to load user referrals (${res.status})`));
    return raw.data || raw;
  }

  // ─── Campaign codes: GET /admin/referrals/campaign-codes ────────────────────
  /**
   * @param {object} params Optional: page, limit, isActive, code
   */
  async function getCampaignCodes(params = {}) {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v === "" || v == null) return;
      if (k === "isActive") {
        qs.set(k, String(v));
        return;
      }
      qs.set(k, v);
    });

    const url = "/admin/referrals/campaign-codes" + (qs.toString() ? "?" + qs.toString() : "");
    const res = await Auth.fetch(url);
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(getErrorMessage(raw, `Failed to load campaign codes (${res.status})`));

    const payload = raw.data !== undefined ? raw : { data: raw, meta: {} };
    return {
      data: Array.isArray(payload.data) ? payload.data.map(normalizeCampaignCode) : [],
      meta: payload.meta || {},
    };
  }

  // ─── Campaign codes: GET /admin/referrals/campaign-codes/:id ────────────────
  async function getCampaignCode(id) {
    const res = await Auth.fetch(`/admin/referrals/campaign-codes/${id}`);
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(getErrorMessage(raw, `Failed to load campaign code (${res.status})`));
    return normalizeCampaignCode(raw.data || raw);
  }

  // ─── Campaign codes: POST /admin/referrals/campaign-codes ───────────────────
  async function createCampaignCode(payload) {
    const res = await Auth.fetch("/admin/referrals/campaign-codes", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(getErrorMessage(raw, `Failed to create campaign code (${res.status})`));
    return normalizeCampaignCode(raw.data || raw);
  }

  // ─── Campaign codes: PATCH /admin/referrals/campaign-codes/:id ──────────────
  async function updateCampaignCode(id, payload) {
    const res = await Auth.fetch(`/admin/referrals/campaign-codes/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(getErrorMessage(raw, `Failed to update campaign code (${res.status})`));
    return normalizeCampaignCode(raw.data || raw);
  }

  // ─── Campaign codes: DELETE /admin/referrals/campaign-codes/:id ─────────────
  async function deleteCampaignCode(id) {
    const res = await Auth.fetch(`/admin/referrals/campaign-codes/${id}`, {
      method: "DELETE",
    });
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(getErrorMessage(raw, `Failed to delete campaign code (${res.status})`));

    // Keep top-level action/message as documented while tolerating wrapped responses.
    if (raw && (raw.action !== undefined || raw.message !== undefined)) return raw;
    if (raw && raw.data && (raw.data.action !== undefined || raw.data.message !== undefined)) return raw.data;
    return raw;
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

  function formatDateTime(dateStr) {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-NG", { day: "2-digit", month: "short", year: "numeric" })
      + " · " + d.toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" });
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

  function activeBadge(isActive) {
    return isActive
      ? '<span class="badge bg-success-lt">Active</span>'
      : '<span class="badge bg-secondary-lt">Inactive</span>';
  }

  return {
    getStats,
    getSettings,
    updateSettings,
    getAll,
    getByUser,
    getCampaignCodes,
    getCampaignCode,
    createCampaignCode,
    updateCampaignCode,
    deleteCampaignCode,
    formatMoney,
    formatDate,
    formatDateTime,
    rewardBadge,
    activeBadge,
  };
})();
