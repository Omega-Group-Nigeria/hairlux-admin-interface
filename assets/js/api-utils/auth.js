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

  const ALLOWED_ROLES = ["ADMIN", "SUPER_ADMIN"];

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

  async function login(email, password) {
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
    const role    = payload.user?.role || payload.role || "";

    if (!ALLOWED_ROLES.includes(role)) {
      throw new Error("Access denied. You are not authorized to access the admin panel.");
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

  /** Resolve login.html relative to current page (root vs bookings/). */
  function loginPath() {
    return window.location.pathname.includes("/bookings/") ? "../login.html" : "./login.html";
  }

  /**
   * Full-page session check overlay so protected pages never flash content
   * while auth is unresolved or while redirecting to login.
   */
  function showAuthBootScreen(message) {
    if (typeof document === "undefined") return;
    if (document.getElementById("auth-boot-screen")) return;
    var style = document.createElement("style");
    style.id = "auth-boot-style";
    style.textContent =
      "#auth-boot-screen{position:fixed;inset:0;z-index:99999;display:flex;flex-direction:column;" +
      "align-items:center;justify-content:center;gap:1rem;background:var(--tblr-bg-surface,#fff);" +
      "color:var(--tblr-body-color,#1e293b);font-family:inherit}" +
      "#auth-boot-screen .auth-boot-spinner{width:2rem;height:2rem;border:2px solid rgba(0,0,0,.12);" +
      "border-top-color:var(--tblr-primary,#206bc4);border-radius:50%;animation:auth-boot-spin .7s linear infinite}" +
      "@keyframes auth-boot-spin{to{transform:rotate(360deg)}}" +
      "#auth-boot-screen .auth-boot-msg{font-size:.875rem;opacity:.7}";
    var el = document.createElement("div");
    el.id = "auth-boot-screen";
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
    el.innerHTML =
      '<div class="auth-boot-spinner" aria-hidden="true"></div>' +
      '<div class="auth-boot-msg">' + (message || "Checking session…") + "</div>";
    // Prefer early inject so content behind never paints meaningfully
    (document.head || document.documentElement).appendChild(style);
    (document.body || document.documentElement).appendChild(el);
  }

  function hideAuthBootScreen() {
    var el = document.getElementById("auth-boot-screen");
    var style = document.getElementById("auth-boot-style");
    if (el && el.parentNode) el.parentNode.removeChild(el);
    if (style && style.parentNode) style.parentNode.removeChild(style);
  }

  /**
   * Drop-in fetch() wrapper for authenticated API calls.
   *   • Proactively refreshes the access token when it is near expiry.
   *   • Adds  Authorization: Bearer <token>  automatically.
   *   • On 401, attempts one token refresh then retries once.
   *   • On second 401 (refresh also failed) → logout + throw (never returns undefined).
   *
   * @param {string} path  — API path, e.g. "/admin/bookings"
   * @param {RequestInit} [options]
   * @returns {Promise<Response>}
   */
  async function authFetch(path, options = {}) {
    if (isTokenExpired()) {
      try { await refreshAccessToken(); }
      catch {
        logout();
        throw new Error("Session expired. Please log in again.");
      }
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
        throw new Error("Session expired. Please log in again.");
      }
    }

    return res;
  }

  // ─── Logout / Guard ───────────────────────────────────────────────────────────

  function logout() {
    clearSession();
    showAuthBootScreen("Redirecting to login…");
    window.location.replace(loginPath());
  }

  /**
   * Call at the top of every protected page.
   * Redirects to login.html if not authenticated (with a boot spinner, no page flash).
   * Proactively refreshes a near-expiry token so the page starts with a fresh one.
   *
   * @returns {Promise<boolean>} true when session is ready; false if redirecting to login
   */
  async function requireAuth() {
    if (!isLoggedIn()) {
      showAuthBootScreen("Redirecting to login…");
      window.location.replace(loginPath());
      return false;
    }
    if (isTokenExpired()) {
      showAuthBootScreen("Checking session…");
      try {
        await refreshAccessToken();
        hideAuthBootScreen();
        return true;
      } catch {
        logout();
        return false;
      }
    }
    return true;
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
    loginPath,
    showAuthBootScreen,
    hideAuthBootScreen,
  };
})();
