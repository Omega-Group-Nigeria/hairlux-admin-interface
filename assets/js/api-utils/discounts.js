/**
 * discounts.js — Hairlux Admin
 * All /admin/discounts/* API calls.
 *
 * Requires:
 *   - config.js  (window.API_BASE)
 *   - auth.js    (Auth.fetch)
 */

const Discounts = (() => {

  // ─── DISCOUNT CODES ────────────────────────────────────────────────────────

  // GET /admin/discounts
  async function getAll(params = {}) {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== "" && v != null) qs.set(k, v); });
    const url = "/admin/discounts" + (qs.toString() ? "?" + qs.toString() : "");
    const res = await Auth.fetch(url);
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(raw.message || `Failed to load discounts (${res.status})`);
    return raw.data || raw;
  }

  // POST /admin/discounts
  // body: { code, name, percentage, isActive?, expiresAt?, maxUses? }
  async function create(payload) {
    const res = await Auth.fetch("/admin/discounts", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(raw.message || `Failed to create discount (${res.status})`);
    return raw.data || raw;
  }

  // GET /admin/discounts/:id
  async function getOne(id) {
    const res = await Auth.fetch(`/admin/discounts/${id}`);
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(raw.message || `Failed to load discount (${res.status})`);
    return raw.data || raw;
  }

  // PATCH /admin/discounts/:id
  async function update(id, payload) {
    const res = await Auth.fetch(`/admin/discounts/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(raw.message || `Failed to update discount (${res.status})`);
    return raw.data || raw;
  }

  // DELETE /admin/discounts/:id
  async function remove(id) {
    const res = await Auth.fetch(`/admin/discounts/${id}`, { method: "DELETE" });
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(raw.message || `Failed to delete discount (${res.status})`);
    return raw;
  }

  // ─── INFLUENCER CODES ──────────────────────────────────────────────────────

  // GET /admin/discounts/influencer
  async function getAllInfluencer(params = {}) {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== "" && v != null) qs.set(k, v); });
    const url = "/admin/discounts/influencer" + (qs.toString() ? "?" + qs.toString() : "");
    const res = await Auth.fetch(url);
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(raw.message || `Failed to load influencer discounts (${res.status})`);
    return raw.data || raw;
  }

  // POST /admin/discounts/influencer
  // body: { code, influencerUserId, percentage }
  async function createInfluencer(payload) {
    const res = await Auth.fetch("/admin/discounts/influencer", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(raw.message || `Failed to create influencer code (${res.status})`);
    return raw.data || raw;
  }

  // GET /admin/discounts/influencer/:id
  async function getOneInfluencer(id) {
    const res = await Auth.fetch(`/admin/discounts/influencer/${id}`);
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(raw.message || `Failed to load influencer discount (${res.status})`);
    return raw.data || raw;
  }

  // DELETE /admin/discounts/influencer/:id
  async function removeInfluencer(id) {
    const res = await Auth.fetch(`/admin/discounts/influencer/${id}`, { method: "DELETE" });
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(raw.message || `Failed to delete influencer code (${res.status})`);
    return raw;
  }

  // ─── INFLUENCER REWARD SETTINGS ────────────────────────────────────────────

  // GET /admin/discounts/influencer-settings
  async function getInfluencerSettings() {
    const res = await Auth.fetch("/admin/discounts/influencer-settings");
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(raw.message || `Failed to load influencer settings (${res.status})`);
    return raw.data || raw;
  }

  // PUT /admin/discounts/influencer-settings
  async function updateInfluencerSettings(payload) {
    const res = await Auth.fetch("/admin/discounts/influencer-settings", {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(raw.message || `Failed to update influencer settings (${res.status})`);
    return raw.data || raw;
  }

  // ─── HELPERS ───────────────────────────────────────────────────────────────

  function formatMoney(n) {
    return "₦" + Number(n || 0).toLocaleString("en-NG", { minimumFractionDigits: 2 });
  }

  function formatDate(dateStr) {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-NG", { day: "2-digit", month: "short", year: "numeric" });
  }

  function formatDateInput(dateStr) {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    return d.toISOString().split("T")[0];
  }

  function statusBadge(isActive) {
    return isActive
      ? '<span class="badge bg-success-lt text-success">Active</span>'
      : '<span class="badge bg-secondary-lt text-secondary">Inactive</span>';
  }

  return {
    getAll, create, getOne, update, remove,
    getAllInfluencer, createInfluencer, getOneInfluencer, removeInfluencer,
    getInfluencerSettings, updateInfluencerSettings,
    formatMoney, formatDate, formatDateInput, statusBadge,
  };
})();
