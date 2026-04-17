/**
 * bookings.js — Hairlux Admin
 * All /admin/bookings/* API calls.
 *
 * Requires:
 *   - config.js  (window.API_BASE)
 *   - auth.js    (Auth.fetch)
 */

const Bookings = (() => {

  function normalizeAddress(address) {
    if (!address || typeof address !== "object") return {};

    const sourceComponents = address.addressComponents && typeof address.addressComponents === "object"
      ? address.addressComponents
      : {};

    const streetAddress = address.streetAddress || sourceComponents.streetAddress || "";
    const city = address.city || sourceComponents.city || "";
    const state = address.state || sourceComponents.state || "";
    const country = address.country || sourceComponents.country || "";
    const fullAddress = address.fullAddress || [streetAddress, city, state, country].filter(Boolean).join(", ");

    return {
      ...address,
      streetAddress,
      city,
      state,
      country,
      fullAddress,
      placeId: address.placeId || "",
      addressComponents: {
        streetAddress,
        city,
        state,
        country,
      },
    };
  }

  function normalizeBooking(booking) {
    if (!booking || typeof booking !== "object") return booking;
    return {
      ...booking,
      address: normalizeAddress(booking.address || {}),
    };
  }

  function normalizeBookingCollection(payload) {
    if (Array.isArray(payload)) {
      return payload.map(normalizeBooking);
    }
    if (!payload || typeof payload !== "object") {
      return payload;
    }
    if (Array.isArray(payload.data)) {
      return {
        ...payload,
        data: payload.data.map(normalizeBooking),
      };
    }
    if (Array.isArray(payload.bookings)) {
      return {
        ...payload,
        bookings: payload.bookings.map(normalizeBooking),
      };
    }
    return payload;
  }

  function normalizeCalendarPayload(payload) {
    if (!payload || typeof payload !== "object") return payload;

    if (payload.bookings && typeof payload.bookings === "object") {
      const normalizedBookings = {};
      Object.keys(payload.bookings).forEach((key) => {
        const value = payload.bookings[key];
        normalizedBookings[key] = Array.isArray(value) ? value.map(normalizeBooking) : value;
      });
      return { ...payload, bookings: normalizedBookings };
    }

    const normalized = {};
    let hasArrayValues = false;
    Object.keys(payload).forEach((key) => {
      const value = payload[key];
      if (Array.isArray(value)) {
        hasArrayValues = true;
        normalized[key] = value.map(normalizeBooking);
      } else {
        normalized[key] = value;
      }
    });

    return hasArrayValues ? normalized : payload;
  }

  function formatAddress(address, fallback = "—") {
    const normalized = normalizeAddress(address);
    return normalized.fullAddress
      || [normalized.streetAddress, normalized.city, normalized.state, normalized.country].filter(Boolean).join(", ")
      || fallback;
  }

  function getGoogleMapsPlaceUrl(address, fallbackQuery = "Service location") {
    const normalized = normalizeAddress(address);
    if (!normalized.placeId) return "";

    const query = normalized.fullAddress
      || [normalized.streetAddress, normalized.city, normalized.state, normalized.country].filter(Boolean).join(", ")
      || fallbackQuery;

    return "https://www.google.com/maps/search/?api=1&query="
      + encodeURIComponent(query)
      + "&query_place_id="
      + encodeURIComponent(normalized.placeId);
  }

  function getBase() {
    return (window.API_BASE || "").replace(/\/$/, "");
  }

  async function publicFetch(path, options = {}) {
    return fetch(`${getBase()}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });
  }

  // ─── GET /admin/bookings ──────────────────────────────────────────────────────
  /**
   * @param {object} params  Optional filters: status, startDate, endDate,
   *                         userId, search, page, limit
   */
  async function getAll(params = {}) {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== "" && v != null) qs.set(k, v); });
    const url = "/admin/bookings" + (qs.toString() ? "?" + qs.toString() : "");
    const res = await Auth.fetch(url);
    const raw = await res.json().catch(() => ({}));
    // unwrap: { data: [...], meta: {...} } or wrapped in { data: { data, meta } }
    const payload = raw.data && raw.data.data ? raw.data : raw;
    return normalizeBookingCollection(payload);
  }

  // ─── POST /admin/bookings ─────────────────────────────────────────────────────
  /**
   * Create a manual booking on behalf of a user (walk-in / phone booking).
   * @param {object} payload  AdminCreateBookingDto
   */
  async function createManualBooking(payload) {
    const res = await Auth.fetch("/admin/bookings", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(raw.message || `Failed to create booking (${res.status})`);
    return normalizeBooking(raw.data || raw);
  }

  // ─── GET /admin/bookings/calendar ─────────────────────────────────────────────
  /**
   * @param {number} month  1–12
   * @param {number} year   e.g. 2026
   */
  async function getCalendar(month, year) {
    const res = await Auth.fetch(`/admin/bookings/calendar?month=${month}&year=${year}`);
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(raw.message || `Failed to load calendar (${res.status})`);
    return normalizeCalendarPayload(raw.data || raw);
  }

  // ─── GET /admin/bookings/stats ────────────────────────────────────────────────
  async function getStats(startDate, endDate) {
    const params = new URLSearchParams();
    if (startDate) params.set('startDate', startDate);
    if (endDate)   params.set('endDate', endDate);
    const qs = params.toString() ? '?' + params.toString() : '';
    const res = await Auth.fetch(`/admin/bookings/stats${qs}`);
    const raw = await res.json().catch(() => ({}));
    return raw.data || raw;
  }

  // ─── GET /admin/bookings/reservation/:code ────────────────────────────────────
  /**
   * Look up full booking details by reservation code.
   * Returns booking data with an `isValid` flag.
   */
  async function getByReservationCode(code) {
    const res = await Auth.fetch(`/admin/bookings/reservation/${encodeURIComponent(code)}`);
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(raw.message || `Reservation not found (${res.status})`);
    return normalizeBooking(raw.data || raw);
  }

  // ─── PATCH /admin/bookings/reservation/:code/use ──────────────────────────────
  /**
   * Mark a reservation as used → sets booking status to IN_PROGRESS. Irreversible.
   */
  async function useReservation(code) {
    const res = await Auth.fetch(`/admin/bookings/reservation/${encodeURIComponent(code)}/use`, {
      method: "PATCH",
    });
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(raw.message || `Failed to mark reservation used (${res.status})`);
    return normalizeBooking(raw.data || raw);
  }

  // ─── GET /admin/bookings/:id ──────────────────────────────────────────────────
  async function getOne(id) {
    const res = await Auth.fetch(`/admin/bookings/${id}`);
    const raw = await res.json().catch(() => ({}));
    return normalizeBooking(raw.data || raw);
  }

  // ─── PUT /admin/bookings/:id/status ──────────────────────────────────────────
  async function updateStatus(id, status, reason = "") {
    const body = { status };
    if (reason) body.reason = reason;
    const res = await Auth.fetch(`/admin/bookings/${id}/status`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(raw.message || `Failed to update status (${res.status})`);
    return raw.data || raw;
  }

  // ─── Business hours (public/admin) ───────────────────────────────────────────
  async function getBusinessHours() {
    const res = await publicFetch("/bookings/business-hours");
    const raw = await res.json().catch(() => ({}));
    return raw.data || raw;
  }

  async function getBusinessExceptions() {
    const res = await publicFetch("/bookings/business-exceptions");
    const raw = await res.json().catch(() => ({}));
    return raw.data || raw;
  }

  async function setBusinessHours(hours) {
    const res = await Auth.fetch("/admin/bookings/business-hours", {
      method: "POST",
      body: JSON.stringify({ hours }),
    });
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(raw.message || `Failed to save hours (${res.status})`);
    return raw.data || raw;
  }

  async function updateBusinessHoursDay(dayOfWeek, payload) {
    const res = await Auth.fetch(`/admin/bookings/business-hours/${dayOfWeek}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(raw.message || `Failed to update day (${res.status})`);
    return raw.data || raw;
  }

  async function createBusinessException(payload) {
    const res = await Auth.fetch("/admin/bookings/business-exceptions", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(raw.message || `Failed to create exception (${res.status})`);
    return raw.data || raw;
  }

  async function deleteBusinessException(id) {
    const res = await Auth.fetch(`/admin/bookings/business-exceptions/${id}`, {
      method: "DELETE",
    });
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(raw.message || `Failed to delete exception (${res.status})`);
    return raw.data || raw;
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────────

  const STATUS_COLORS = {
    PENDING:     "warning",
    CONFIRMED:   "primary",
    IN_PROGRESS: "orange",
    COMPLETED:   "success",
    CANCELLED:   "danger",
  };

  function statusBadge(status) {
    const color = STATUS_COLORS[status] || "secondary";
    const label = status.replace(/_/g, " ");
    return `<span class="badge bg-${color}-lt">${label}</span>`;
  }

  function formatMoney(n) {
    return "₦" + Number(n || 0).toLocaleString("en-NG", { minimumFractionDigits: 2 });
  }

  function formatDateTime(dateStr, timeStr) {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    const date = d.toLocaleDateString("en-NG", { day: "2-digit", month: "short", year: "numeric" });
    return timeStr ? `${date} · ${timeStr}` : date;
  }

  function shortId(id = "") {
    return id.length > 10 ? "…" + id.slice(-8) : id;
  }

  return {
    getAll,
    createManualBooking,
    getCalendar,
    getStats,
    getByReservationCode,
    useReservation,
    getOne,
    updateStatus,
    getBusinessHours,
    getBusinessExceptions,
    setBusinessHours,
    updateBusinessHoursDay,
    createBusinessException,
    deleteBusinessException,
    statusBadge,
    formatMoney,
    formatDateTime,
    shortId,
    normalizeAddress,
    formatAddress,
    getGoogleMapsPlaceUrl,
  };
})();
