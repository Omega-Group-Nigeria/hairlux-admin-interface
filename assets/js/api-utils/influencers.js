// ── Influencers API Utility ───────────────────────────────────────────────────
// Endpoints: /admin/influencers
// ─────────────────────────────────────────────────────────────────────────────
const Influencers = (() => {
  const BASE = () => "/admin/influencers";

  // GET /admin/influencers
  // params: { page, limit, search, isActive }
  async function getAll(params = {}) {
    const qs = new URLSearchParams();
    if (params.page)     qs.set("page",     params.page);
    if (params.limit)    qs.set("limit",    params.limit);
    if (params.search)   qs.set("search",   params.search);
    if (params.isActive !== undefined && params.isActive !== "")
      qs.set("isActive", params.isActive);
    const res = await Auth.fetch(`${BASE()}?${qs.toString()}`);
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(raw.message || `Failed to load influencers (${res.status})`);
    return raw.data || raw;
  }

  // POST /admin/influencers
  // payload: { name, phone, email?, notes?, isActive? }
  async function create(payload) {
    const res = await Auth.fetch(BASE(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(raw.message || `Failed to create influencer (${res.status})`);
    return raw.data || raw;
  }

  // GET /admin/influencers/:id
  async function getOne(id) {
    const res = await Auth.fetch(`${BASE()}/${id}`);
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(raw.message || `Failed to load influencer (${res.status})`);
    return raw.data || raw;
  }

  // PATCH /admin/influencers/:id
  async function update(id, payload) {
    const res = await Auth.fetch(`${BASE()}/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(raw.message || `Failed to update influencer (${res.status})`);
    return raw.data || raw;
  }

  // DELETE /admin/influencers/:id
  async function remove(id) {
    const res = await Auth.fetch(`${BASE()}/${id}`, { method: "DELETE" });
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(raw.message || `Failed to delete influencer (${res.status})`);
    return raw.data || raw;
  }

  // ── Helpers ─────────────────────────────────────────────────────────────
  function formatMoney(n) {
    const num = parseFloat(n) || 0;
    return "₦" + num.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function formatDate(dateStr) {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    if (isNaN(d)) return "—";
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  }

  function statusBadge(isActive) {
    return isActive
      ? '<span class="badge bg-success-lt">Active</span>'
      : '<span class="badge bg-secondary-lt">Inactive</span>';
  }

  return {
    getAll, create, getOne, update, remove,
    formatMoney, formatDate, statusBadge,
  };
})();
