/**
 * jobs.js — Hairlux Admin
 * All /admin/jobs/* API calls.
 *
 * Requires: auth.js (Auth.fetch)
 */

const Jobs = (() => {

  /**
   * List all job postings (admin — includes drafts).
   * @param {object} opts  { type?, page?, limit? }
   */
  async function getAll({ type = '', page = 1, limit = 20 } = {}) {
    const params = new URLSearchParams();
    if (type)  params.set('type', type);
    if (page)  params.set('page', page);
    if (limit) params.set('limit', limit);
    const qs = params.toString() ? '?' + params.toString() : '';
    const res = await Auth.fetch(`/admin/jobs${qs}`);
    const raw = await res.json().catch(() => ({}));
    return raw.data || raw;
  }

  /**
   * Get a single job posting.
   * @param {string} id
   */
  async function getOne(id) {
    const res = await Auth.fetch(`/admin/jobs/${id}`);
    const raw = await res.json().catch(() => ({}));
    return raw.data || raw;
  }

  /**
   * Create a job posting.
   * @param {object} payload  { title, type, location, description, responsibilities, isActive?, closingDate? }
   */
  async function create(payload) {
    const res = await Auth.fetch('/admin/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(raw.message || 'Failed to create job');
    return raw.data || raw;
  }

  /**
   * Update a job posting (partial).
   * @param {string} id
   * @param {object} payload
   */
  async function update(id, payload) {
    const res = await Auth.fetch(`/admin/jobs/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(raw.message || 'Failed to update job');
    return raw.data || raw;
  }

  /**
   * Toggle publish / unpublish.
   * @param {string} id
   */
  async function toggle(id) {
    const res = await Auth.fetch(`/admin/jobs/${id}/toggle`, { method: 'PATCH' });
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(raw.message || 'Failed to toggle job');
    return raw.data || raw;
  }

  /**
   * Permanently delete a job posting.
   * @param {string} id
   */
  async function remove(id) {
    const res = await Auth.fetch(`/admin/jobs/${id}`, { method: 'DELETE' });
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(raw.message || 'Failed to delete job');
    return raw.data || raw;
  }

  // ─── Display helpers ──────────────────────────────────────────────────────────

  const TYPE_LABELS = {
    FULL_TIME: 'Full-time',
    PART_TIME: 'Part-time',
    CONTRACT:  'Contract',
    FREELANCE: 'Freelance',
  };

  const TYPE_COLORS = {
    FULL_TIME: 'bg-primary-lt',
    PART_TIME: 'bg-cyan-lt',
    CONTRACT:  'bg-yellow-lt',
    FREELANCE: 'bg-purple-lt',
  };

  function typeBadge(type) {
    const label = TYPE_LABELS[type] || type;
    const cls   = TYPE_COLORS[type] || 'bg-secondary-lt';
    return `<span class="badge ${cls}">${label}</span>`;
  }

  function statusBadge(isActive) {
    return isActive
      ? `<span class="badge bg-success-lt">Published</span>`
      : `<span class="badge bg-secondary-lt">Draft</span>`;
  }

  function formatDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  return { getAll, getOne, create, update, toggle, remove, typeBadge, statusBadge, formatDate, TYPE_LABELS };
})();
