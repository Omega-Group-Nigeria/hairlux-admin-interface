/**
 * academy-resources.js: Hairlux Admin
 * Academy Free Resources & Leads: /admin/academy/free-resources/*
 *
 * Requires:
 *   - config.js  (window.API_BASE)
 *   - auth.js    (Auth.fetch, Auth.getToken)
 */
const AcademyResources = (() => {
  const BASE = "/admin/academy/free-resources";
  /** Public Academy site -- used for "Copy link" to a resource. */
  const ACADEMY_SITE_URL = (window.ACADEMY_SITE_URL || "https://academy.hairlux.com.ng").replace(/\/$/, "");

  async function apiFetch(path, options = {}) {
    const res = await Auth.fetch(path, options);
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = Array.isArray(raw.message) ? raw.message.join(", ") : raw.message;
      throw new Error(msg || `Request failed (${res.status})`);
    }
    return raw.data !== undefined ? raw.data : raw;
  }

  function buildQuery(params) {
    const qs = new URLSearchParams();
    Object.entries(params || {}).forEach(([k, v]) => { if (v !== "" && v != null) qs.set(k, v); });
    const s = qs.toString();
    return s ? "?" + s : "";
  }

  /**
   * Multipart upload with progress (XMLHttpRequest -- fetch has no upload
   * progress). Bypasses Auth.fetch because multipart needs its own boundary.
   */
  function upload(path, field, file, onProgress) {
    return new Promise((resolve, reject) => {
      const base = (window.API_BASE || "").replace(/\/$/, "");
      const xhr = new XMLHttpRequest();
      xhr.open("POST", base + path);
      xhr.setRequestHeader("Authorization", "Bearer " + Auth.getToken());
      if (onProgress) xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100)); };
      xhr.onload = () => {
        let raw = {};
        try { raw = JSON.parse(xhr.responseText || "{}"); } catch (_) { /* ignore */ }
        if (xhr.status >= 200 && xhr.status < 300) resolve(raw.data !== undefined ? raw.data : raw);
        else if (xhr.status === 413) reject(new Error("File is too large (max 50MB)."));
        else reject(new Error((Array.isArray(raw.message) ? raw.message.join(", ") : raw.message) || `Upload failed (${xhr.status})`));
      };
      xhr.onerror = () => reject(new Error("Network error during upload."));
      const fd = new FormData();
      fd.append(field, file);
      xhr.send(fd);
    });
  }

  // ─── Resources ─────────────────────────────────────────────────────────
  const list = (includeArchived) => apiFetch(BASE + buildQuery({ includeArchived: includeArchived ? "true" : "" }));
  const get = (id) => apiFetch(`${BASE}/${id}`);
  const create = (payload) => apiFetch(BASE, { method: "POST", body: JSON.stringify(payload) });
  const update = (id, payload) => apiFetch(`${BASE}/${id}`, { method: "PUT", body: JSON.stringify(payload) });
  const setPublished = (id, isPublished) => apiFetch(`${BASE}/${id}/publish`, { method: "PATCH", body: JSON.stringify({ isPublished }) });
  const archive = (id) => apiFetch(`${BASE}/${id}/archive`, { method: "POST" });
  const restore = (id) => apiFetch(`${BASE}/${id}/restore`, { method: "POST" });
  const downloadUrl = (id) => apiFetch(`${BASE}/${id}/download-url`);
  const uploadFile = (file, onProgress) => upload(`${BASE}/file/upload`, "file", file, onProgress);
  const uploadCover = (file) => upload(`${BASE}/cover-image/upload`, "image", file);
  const stats = () => apiFetch(`${BASE}/stats`);

  // ─── Leads ─────────────────────────────────────────────────────────────
  const listLeads = (params) => apiFetch(`${BASE}/leads` + buildQuery(params));
  const unsubscribeLead = (id) => apiFetch(`${BASE}/leads/${id}/unsubscribe`, { method: "POST" });

  /** Downloads the CSV through Auth.fetch (the token can't go in a plain link). */
  async function exportLeads(params) {
    const res = await Auth.fetch(`${BASE}/leads/export` + buildQuery(params));
    if (!res.ok) {
      const raw = await res.json().catch(() => ({}));
      throw new Error(raw.message || `Export failed (${res.status})`);
    }
    const blob = await res.blob();
    const cd = res.headers.get("Content-Disposition") || "";
    const m = /filename="([^"]+)"/.exec(cd);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = m ? m[1] : "academy-leads.csv";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  // ─── Formatting ────────────────────────────────────────────────────────
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function formatBytes(n) {
    n = Number(n) || 0;
    if (n < 1024) return n + " B";
    if (n < 1024 * 1024) return (n / 1024).toFixed(0) + " KB";
    return (n / (1024 * 1024)).toFixed(1) + " MB";
  }
  function fileExt(name) {
    const m = /\.([A-Za-z0-9]+)$/.exec(name || "");
    return m ? m[1].toUpperCase() : "FILE";
  }
  function formatDate(d, withTime) {
    if (!d) return "-";
    const dt = new Date(d);
    const opts = { day: "numeric", month: "short", year: "numeric" };
    if (withTime) Object.assign(opts, { hour: "2-digit", minute: "2-digit" });
    return dt.toLocaleString("en-GB", opts);
  }
  function publicLink(resource) {
    return `${ACADEMY_SITE_URL}/resources.html?r=${encodeURIComponent(resource.slug)}`;
  }

  return {
    list, get, create, update, setPublished, archive, restore, downloadUrl, uploadFile, uploadCover, stats,
    listLeads, unsubscribeLead, exportLeads,
    esc, formatBytes, fileExt, formatDate, publicLink, ACADEMY_SITE_URL,
  };
})();
window.AcademyResources = AcademyResources;
