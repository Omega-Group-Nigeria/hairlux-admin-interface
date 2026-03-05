// ── Influencers API Utility ───────────────────────────────────────────────────
// Endpoints: /admin/influencers, /admin/users/:id/make-influencer, etc.
//
// Breaking changes (March 2026):
//   - POST /admin/influencers removed → use promoteUser()
//   - name/email/phone no longer on influencer record → live on influencer.user.*
//   - influencerUserId in create-code payload now correctly expects the USER uuid
// ─────────────────────────────────────────────────────────────────────────────
const Influencers = (() => {
  const BASE = () => "/admin/influencers";

  // ── GET /admin/influencers ────────────────────────────────────────────────
  // params: { page, limit, search, isActive }
  async function getAll(params = {}) {
    const qs = new URLSearchParams();
    if (params.page)   qs.set("page",   params.page);
    if (params.limit)  qs.set("limit",  params.limit);
    if (params.search) qs.set("search", params.search);
    if (params.isActive !== undefined && params.isActive !== "")
      qs.set("isActive", params.isActive);
    const res = await Auth.fetch(`${BASE()}?${qs.toString()}`);
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(raw.message || `Failed to load influencers (${res.status})`);
    return raw.data || raw;
  }

  // ── GET /admin/influencers/:id ────────────────────────────────────────────
  async function getOne(id) {
    const res = await Auth.fetch(`${BASE()}/${id}`);
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(raw.message || `Failed to load influencer (${res.status})`);
    return raw.data || raw;
  }

  // ── PATCH /admin/influencers/:id ──────────────────────────────────────────
  // Only accepts: { notes, isActive }  — name/phone/email live on the user record
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

  // ── DELETE /admin/influencers/:id ─────────────────────────────────────────
  // Deactivates the influencer record and all their discount codes.
  async function remove(id) {
    const res = await Auth.fetch(`${BASE()}/${id}`, { method: "DELETE" });
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(raw.message || `Failed to demote influencer (${res.status})`);
    return raw.data || raw;
  }

  // ── POST /admin/users/:userId/make-influencer ─────────────────────────────
  // Promote a regular user account to influencer status.
  // payload: { notes? }
  async function promoteUser(userId, payload = {}) {
    const res = await Auth.fetch(`/admin/users/${userId}/make-influencer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(raw.message || `Failed to promote user (${res.status})`);
    return raw.data || raw;
  }

  // ── DELETE /admin/users/:userId/remove-influencer ─────────────────────────
  // Demote by user ID (also deactivates all their codes).
  async function demoteUser(userId) {
    const res = await Auth.fetch(`/admin/users/${userId}/remove-influencer`, {
      method: "DELETE",
    });
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(raw.message || `Failed to demote user (${res.status})`);
    return raw;
  }

  // ── GET /admin/users/search?email=... ─────────────────────────────────────
  // Search users by partial email to find a candidate to promote.
  // Response includes an `influencer` field ({ id, isActive } or null).
  async function searchUsers(email) {
    const res = await Auth.fetch(`/admin/users/search?email=${encodeURIComponent(email)}`);
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(raw.message || `User search failed (${res.status})`);
    return raw.data || raw;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
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

  // Convenience: extract display name from influencer record (new shape)
  function displayName(inf) {
    const u = inf.user || {};
    return [u.firstName, u.lastName].filter(Boolean).join(" ") || u.email || "—";
  }

  return {
    getAll, getOne, update, remove,
    promoteUser, demoteUser, searchUsers,
    formatMoney, formatDate, statusBadge, displayName,
  };
})();

