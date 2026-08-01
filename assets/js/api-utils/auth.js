/**
 * auth.js — Hairlux Admin
 * Authentication helper: login, logout, token refresh, auth guard, authed fetch.
 *
 * Requires:
 *   - config.js loaded first (sets window.API_BASE)
 *
 * API response shape expected:
 *   { success, message, data: { user, accessToken, refreshToken } }
 */

const Auth = (() => {
  const TOKEN_KEY   = "hairlux_token";
  const REFRESH_KEY = "hairlux_refresh_token";
  const USER_KEY    = "hairlux_user";

  const ROLE_REQUIREMENTS = {
  admin: ["ADMIN", "SUPER_ADMIN"],
  staff: ["STAFF"],
  };

  function getBase() {
    return (window.API_BASE || "").replace(/\/$/, "");
  }

  // ─── Session helpers ──────────────────────────────────────────────────────────

  /**
   * Persist tokens and user from the API response.
   * Handles both flat { accessToken, user } and the nested
   * { success, data: { accessToken, refreshToken, user } } shape.
   */
  function saveSession(raw) {
    const payload = raw.data || raw;                         // unwrap wrapper
    const token   = payload.accessToken  || payload.token   || payload.access_token  || "";
    const refresh = payload.refreshToken || payload.refresh_token || "";
    const user    = payload.user || null;

    if (token)   localStorage.setItem(TOKEN_KEY,   token);
    if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
    if (user)    localStorage.setItem(USER_KEY,    JSON.stringify(user));

    // Hydrate RBAC permissions immediately when a session is established.
    // RBAC module may not be loaded on the login page, so guard with typeof.
    if (user && typeof RBAC !== 'undefined') RBAC.hydrate(user);

    return token;
  }

  function clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
  }

  function getToken()        { return localStorage.getItem(TOKEN_KEY)   || ""; }
  function getRefreshToken() { return localStorage.getItem(REFRESH_KEY) || ""; }

  function getUser() {
    try { return JSON.parse(localStorage.getItem(USER_KEY)) || null; }
    catch { return null; }
  }

  function isLoggedIn() { return !!getToken(); }

  // ─── JWT expiry ───────────────────────────────────────────────────────────────

  /** Decode the JWT payload without signature verification. */
  function decodePayload(token) {
    try {
      const b64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
      return JSON.parse(atob(b64));
    } catch { return null; }
  }

  /**
   * Returns true when the access token is absent or will expire
   * within the next `bufferSeconds` seconds (default: 60 s).
   */
  function isTokenExpired(bufferSeconds = 60) {
    const token = getToken();
    if (!token) return true;
    const p = decodePayload(token);
    if (!p?.exp) return true;
    return Date.now() / 1000 >= p.exp - bufferSeconds;
  }

  // ─── POST /auth/login ─────────────────────────────────────────────────────────

  /**
   * @param {string} email
   * @param {string} password
   * @param {'admin'|'staff'} [loginType='admin']
   *   Which login tab was used — determines which role(s) are acceptable
   *   for this session and produces a tab-specific error otherwise.
   */
  async function login(email, password, loginType = "admin") {
    const res = await fetch(`${getBase()}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const raw = await res.json().catch(() => ({}));

    if (!res.ok) {
      const msg =
        raw.message ||
        (res.status === 401
          ? "Invalid email or password."
          : `Login failed (${res.status}). Please try again.`);
      throw new Error(msg);
    }

    // Unwrap { success, data: { user, accessToken, ... } }
    const payload = raw.data || raw;

    // `roles` is the union of the account's legacy single role plus every
    // UserRoleAssignment row (e.g. a customer who was later hired shows up
    // as ["USER", "STAFF"]). Falls back to the single `role` field for
    // backward compatibility if the backend hasn't shipped `roles` yet —
    // that fallback only ever satisfies the "admin" tab correctly; a
    // dual-role account won't be recognized as staff until the backend
    // actually returns the array.
    const roles = payload.user?.roles || payload.roles ||
      [payload.user?.role || payload.role || ""];

    const required = ROLE_REQUIREMENTS[loginType] || ROLE_REQUIREMENTS.admin;
    const allowed  = roles.some((r) => required.includes(r));

    if (!allowed) {
      const other = loginType === "admin" ? "staff" : "admin";
      throw new Error(
        `This account doesn't have ${loginType} access. If you're ${other === "staff" ? "a hired team member" : "an administrator"}, try the "For ${other === "staff" ? "Staff" : "Admin"}" tab instead.`
      );
    }

    saveSession(raw);
    return raw;
  }

  // ─── POST /auth/refresh-token ────────────────────────────────────────────────

  /**
   * Exchange the stored refresh token for a fresh access/refresh token pair.
   * Updates localStorage in-place and returns the new access token string.
   * Throws (and clears session) if the server rejects the refresh token.
   */
  async function refreshAccessToken() {
    const refreshToken = getRefreshToken();
    if (!refreshToken) throw new Error("No refresh token stored.");

    const res = await fetch(`${getBase()}/auth/refresh-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });

    const raw = await res.json().catch(() => ({}));

    if (!res.ok) {
      clearSession();
      throw new Error(raw.message || "Session expired. Please log in again.");
    }

    return saveSession(raw);
  }

  // ─── Authenticated fetch ──────────────────────────────────────────────────────

  /**
   * Drop-in fetch() wrapper for authenticated API calls.
   *   • Proactively refreshes the access token when it is near expiry.
   *   • Adds  Authorization: Bearer <token>  automatically.
   *   • On 401, attempts one token refresh then retries once.
   *   • On second 401 (refresh also failed) → logout.
   *
   * @param {string} path  — API path, e.g. "/admin/bookings"
   * @param {RequestInit} [options]
   * @returns {Promise<Response>}
   *
   * Usage:
   *   const res  = await Auth.fetch("/admin/bookings");
   *   const data = await res.json();
   */
  async function authFetch(path, options = {}) {
    if (isTokenExpired()) {
      try { await refreshAccessToken(); }
      catch { logout(); return; }
    }

    const buildRequest = () =>
      fetch(`${getBase()}${path}`, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...(options.headers || {}),
          Authorization: `Bearer ${getToken()}`,
        },
      });

    let res = await buildRequest();

    if (res.status === 401) {
      try {
        await refreshAccessToken();
        res = await buildRequest();
      } catch {
        logout();
        return;
      }
    }

    return res;
  }

  // ─── Logout / Guard ───────────────────────────────────────────────────────────

  function logout() {
    clearSession();
    window.location.href = "./login.html";
  }

  /**
   * Call at the top of every protected page.
   * Redirects to login.html if not authenticated.
   * Proactively refreshes a near-expiry token so the page starts with a fresh one.
   */
  async function requireAuth() {
    if (!isLoggedIn()) {
      window.location.href = "./login.html";
      return;
    }
    if (isTokenExpired()) {
      try { await refreshAccessToken(); }
      catch { logout(); }
    }
  }

  // ─── Expose ───────────────────────────────────────────────────────────────────
  return {
    login,
    logout,
    requireAuth,
    refreshAccessToken,
    fetch: authFetch,
    getToken,
    getRefreshToken,
    getUser,
    isLoggedIn,
    isTokenExpired,
    clearSession,
  };
})();
