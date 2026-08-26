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

  function normalizeBranch(branch) {
    if (!branch || typeof branch !== "object") return null;
    const id = branch.id || null;
    const name = String(branch.name || "").trim();
    const address = String(branch.address || "").trim();
    if (!id && !name && !address) return null;
    return { id, name, address };
  }

  function resolveBranch(booking) {
    if (!booking || typeof booking !== "object") return null;
    const branch = normalizeBranch(booking.branch);
    if (branch) return branch;
    if (booking.branchId) {
      return { id: booking.branchId, name: "", address: "" };
    }
    return null;
  }

  function formatBranchLabel(branch, fallback = "—") {
    const normalized = normalizeBranch(branch);
    return normalized && normalized.name ? normalized.name : fallback;
  }

  function formatBranchAddress(branch, fallback = "") {
    const normalized = normalizeBranch(branch);
    return normalized && normalized.address ? normalized.address : fallback;
  }

  function formatBranchTableCell(booking, esc = (value) => String(value || "")) {
    const branch = resolveBranch(booking);
    if (!branch || !branch.name) return '<span class="text-secondary">—</span>';
    let html = `<div class="small fw-semibold">${esc(branch.name)}</div>`;
    if (branch.address) {
      const display = branch.address.length > 48
        ? `${branch.address.slice(0, 45)}…`
        : branch.address;
      html += `<div class="text-secondary small" title="${esc(branch.address)}">${esc(display)}</div>`;
    }
    return html;
  }

  function renderBranchDetailHtml(booking, opts = {}) {
    const esc = opts.esc || ((value) => String(value || ""));
    const branch = resolveBranch(booking);
    if (!branch || (!branch.name && !branch.address)) return "";

    const name = esc(branch.name || "—");
    const address = branch.address ? esc(branch.address) : "";
    const label = esc(opts.label || "Branch");
    const labelClass = opts.labelClass || "detail-field-label";

    if (opts.plain) {
      return '<div class="row g-3">' +
        `<div class="col-12"><div class="${labelClass}">${label}</div>` +
        `<div class="detail-field-value fw-semibold">${name}</div>` +
        (address ? `<div class="text-secondary small mt-1">${address}</div>` : "") +
        "</div></div>";
    }

    if (opts.layout === "section") {
      return '<div class="detail-section">' +
        `<div class="detail-label mb-1">${label}</div>` +
        `<div class="fw-semibold">${name}</div>` +
        (address ? `<div class="text-secondary">${address}</div>` : "") +
        "</div>";
    }

    const legacyLabelClass = opts.labelClass || "mb-1 text-secondary small";
    let colClass = "";
    if (opts.layout === "col-6") colClass = "col-md-6";
    else if (opts.layout === "col-12") colClass = "col-12";

    const open = colClass ? `<div class="${colClass}">` : "";
    const close = colClass ? "</div>" : "";
    return open +
      `<div class="${legacyLabelClass}">${label}</div>` +
      `<div class="fw-semibold">${name}</div>` +
      (address ? `<div class="text-secondary small">${address}</div>` : "") +
      close;
  }

  function normalizeBooking(booking) {
    if (!booking || typeof booking !== "object") return booking;
    return {
      ...booking,
      address: normalizeAddress(booking.address || {}),
      branch: normalizeBranch(booking.branch),
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
   *   idempotencyKey is optional but recommended — auto-generated if omitted.
   */
  async function createManualBooking(payload) {
    const body = {
      idempotencyKey: `admin-book-${crypto.randomUUID()}`,
      ...payload,
    };
    const res = await Auth.fetch("/admin/bookings", {
      method: "POST",
      body: JSON.stringify(body),
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
  /**
   * @param {string} id
   * @param {string} status
   * @param {object|string} [options]  Legacy: reason string. Or { reason, isNoShow }.
   */
  async function updateStatus(id, status, options = {}) {
    if (typeof options === "string") options = { reason: options };
    const body = { status };
    if (options.reason) body.reason = options.reason;
    if (options.isNoShow) body.isNoShow = true;
    const res = await Auth.fetch(`/admin/bookings/${id}/status`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(raw.message || `Failed to update status (${res.status})`);
    return normalizeBooking(raw.data || raw);
  }

  // ─── Cancellation policy ─────────────────────────────────────────────────────
  async function getCancellationPolicy() {
    const res = await Auth.fetch("/admin/bookings/cancellation-policy");
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(raw.message || `Failed to load cancellation policy (${res.status})`);
    return raw.data || raw;
  }

  async function updateCancellationPolicy(payload) {
    const res = await Auth.fetch("/admin/bookings/cancellation-policy", {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(raw.message || `Failed to update cancellation policy (${res.status})`);
    return raw.data || raw;
  }

  const CANCELLATION_SCENARIO_LABELS = {
    WITHIN_CANCELLATION_WINDOW: "Within cancellation window",
    OUTSIDE_CANCELLATION_WINDOW: "Outside cancellation window",
    GRACE_PERIOD: "Grace period",
    AFTER_GRACE_PERIOD: "After grace period",
    DISPATCHED: "Dispatched (en route)",
    NO_SHOW: "No-show",
    ADMIN_CANCELLATION: "Admin cancellation",
  };

  const CANCELLATION_SCENARIO_GUIDES = {
    walkInBranch: {
      WITHIN_CANCELLATION_WINDOW: "Cancel at least this many minutes before the appointment.",
      OUTSIDE_CANCELLATION_WINDOW: "Too close to the appointment. Customer cannot cancel or get a refund.",
      NO_SHOW: "Admin cancels and marks the customer as a no-show.",
      ADMIN_CANCELLATION: "Admin cancels when the customer cannot (not a no-show).",
    },
    homeService: {
      GRACE_PERIOD: "Cancel within this many minutes after the booking was made.",
      AFTER_GRACE_PERIOD: "Grace period ended. Customer cannot cancel or get a refund.",
      DISPATCHED: "Beautician is assigned or on the way. Admin cancels after grace period.",
      NO_SHOW: "Admin marks no-show after grace period ended.",
      ADMIN_CANCELLATION: "Admin cancels after grace period, before beautician is sent.",
    },
  };

  const CANCELLATION_SCENARIOS_WITH_WINDOW = ["WITHIN_CANCELLATION_WINDOW", "GRACE_PERIOD"];

  function scenarioLabel(scenario) {
    return CANCELLATION_SCENARIO_LABELS[scenario] || String(scenario || "").replace(/_/g, " ");
  }

  function scenarioGuide(scenario, category) {
    var guides = CANCELLATION_SCENARIO_GUIDES[category];
    return (guides && guides[scenario]) || "";
  }

  function validateCancellationRule(rule) {
    if (!rule || !rule.scenario) return "Each rule must have a scenario.";
    const refund = Number(rule.refundPercent);
    const forfeiture = Number(rule.forfeiturePercent);
    if (!Number.isFinite(refund) || refund < 0 || refund > 100) {
      return scenarioLabel(rule.scenario) + ": refund % must be 0–100.";
    }
    if (!Number.isFinite(forfeiture) || forfeiture < 0 || forfeiture > 100) {
      return scenarioLabel(rule.scenario) + ": forfeiture % must be 0–100.";
    }
    if (refund + forfeiture !== 100) {
      return scenarioLabel(rule.scenario) + ": refund % + forfeiture % must equal 100.";
    }
    if (CANCELLATION_SCENARIOS_WITH_WINDOW.includes(rule.scenario)) {
      const window = Number(rule.windowMinutes);
      if (!Number.isFinite(window) || window < 1 || window > 10080) {
        return scenarioLabel(rule.scenario) + ": window minutes must be 1–10080.";
      }
    }
    return "";
  }

  function validateCancellationRules(rules) {
    if (!Array.isArray(rules) || !rules.length) return "At least one rule is required.";
    for (let i = 0; i < rules.length; i++) {
      const err = validateCancellationRule(rules[i]);
      if (err) return err;
    }
    return "";
  }

  function renderCancellationDetailHtml(booking, opts = {}) {
    const esc = opts.esc || ((value) => String(value ?? ""));
    if (!booking || booking.status !== "CANCELLED") return "";

    const cancellation = booking.cancellation;
    const parts = [];

    if (booking.cancelReason) {
      parts.push(
        '<div class="col-12"><div class="detail-field-label">Cancel reason</div>' +
        '<div class="detail-prose text-secondary">' + esc(booking.cancelReason) + "</div></div>"
      );
    }

    if (cancellation && typeof cancellation === "object") {
      const scenario = scenarioLabel(cancellation.scenario);
      parts.push(
        '<div class="col-sm-6"><div class="detail-field-label">Policy scenario</div>' +
        '<div class="detail-field-value fw-semibold">' + esc(scenario) + "</div></div>",
        '<div class="col-sm-6"><div class="detail-field-label">Refund</div>' +
        '<div class="detail-field-value">' + esc(cancellation.refundPercent ?? "—") + "% · " +
        esc(formatMoney(cancellation.refundAmount ?? 0)) + "</div></div>",
        '<div class="col-sm-6"><div class="detail-field-label">Forfeiture</div>' +
        '<div class="detail-field-value">' + esc(cancellation.forfeiturePercent ?? "—") + "% · " +
        esc(formatMoney(cancellation.forfeitureAmount ?? 0)) + "</div></div>"
      );
    }

    if (!parts.length) return "";

    const inner = '<div class="row g-3">' + parts.join("") + "</div>";
    if (opts.plain) return inner;
    if (opts.section) return '<div class="detail-section">' + inner + "</div>";
    return '<div class="col-12">' + inner + "</div>";
  }

  // ─── POST /admin/bookings/:id/retry-matching ─────────────────────────────────
  /**
   * Re-trigger beautician matching for a home-service booking awaiting assignment.
   * @param {string} id
   * @param {number} [startAtTier]  1–3 — optional wider-radius restart
   */
  async function retryMatching(id, startAtTier) {
    const qs = startAtTier != null && startAtTier !== ""
      ? `?startAtTier=${encodeURIComponent(startAtTier)}`
      : "";
    const res = await Auth.fetch(`/admin/bookings/${id}/retry-matching${qs}`, {
      method: "POST",
    });
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(raw.message || `Failed to retry matching (${res.status})`);
    return raw.data || raw;
  }

  // ─── GET /admin/bookings/:id/dispatch-trace ──────────────────────────────────
  async function getDispatchTrace(id) {
    const res = await Auth.fetch(`/admin/bookings/${id}/dispatch-trace`);
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(raw.message || `Failed to load dispatch trace (${res.status})`);
    return raw.data || raw;
  }

  // ─── POST /admin/bookings/:id/force-assign ───────────────────────────────────
  async function forceAssign(id, beauticianUserId) {
    const res = await Auth.fetch(`/admin/bookings/${id}/force-assign`, {
      method: "POST",
      body: JSON.stringify({ beauticianUserId }),
    });
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(raw.message || `Failed to force assign (${res.status})`);
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
    PENDING:                  "warning",
    PENDING_ASSIGNMENT:       "warning",
    ASSIGNED:                 "primary",
    EN_ROUTE:                 "azure",
    ARRIVED:                  "azure",
    ARRIVED_VERIFIED:         "azure",
    CONFIRMED:                "primary",
    IN_PROGRESS:              "orange",
    AWAITING_CUSTOMER_CONFIRM: "orange",
    COMPLETED:                "success",
    CANCELLED:                "danger",
  };

  const DISPATCH_STATUS_COLORS = {
    PENDING_MATCH: "warning",
    OFFERING: "info",
    MATCH_EXHAUSTED: "danger",
    ASSIGNED: "success",
    CANCELLED: "secondary",
  };

  const MATCHING_EXHAUSTED_MESSAGES = {
    NO_BEAUTICIANS_ONLINE: "No beauticians were online when matching ran.",
    NO_CANDIDATES_IN_AREA:
      "No available beauticians were found in the customer's area.",
    OFFERS_NOT_ACCEPTED:
      "Beauticians nearby were notified, but none accepted this job.",
    COVERAGE_GAP: "No beauticians cover this service in the customer's area.",
  };

  const DISPATCH_EVENT_LABELS = {
    MATCHING_STARTED: "Matching started",
    CANDIDATES_SEARCHED: "Candidates searched",
    OFFER_SENT: "Offer sent",
    OFFER_EXPIRED: "Offer expired",
    OFFER_DECLINED: "Offer declined",
    OFFER_ACCEPTED: "Offer accepted",
    TIER_ESCALATED: "Tier escalated",
    MATCH_EXHAUSTED: "Match exhausted",
    BEAUTICIAN_ONLINE_RETRIGGER: "Beautician online retrigger",
    EXHAUSTED_WAKE_RETRY: "Exhausted wake retry",
    MANUAL_RETRY: "Manual retry",
    FORCE_ASSIGNED: "Force assigned",
  };

  function isHomeServiceBooking(booking) {
    return (booking && booking.bookingType) === "HOME_SERVICE";
  }

  function isPendingAssignment(booking) {
    return (booking && booking.status) === "PENDING_ASSIGNMENT";
  }

  function isMatchingExhausted(booking) {
    return !!(booking && (
      booking.matchingExhaustedAt
      || booking.matchingExhausted
      || booking.dispatchStatus === "MATCH_EXHAUSTED"
    ));
  }

  function canAdminRetryMatching(booking) {
    return isHomeServiceBooking(booking) && isPendingAssignment(booking);
  }

  function canAdminForceAssign(booking) {
    return canAdminRetryMatching(booking);
  }

  function getAssignmentStatusMessage(booking) {
    if (!isPendingAssignment(booking)) return null;
    if (isMatchingExhausted(booking)) {
      const reason = booking.matchingExhaustedReason;
      return MATCHING_EXHAUSTED_MESSAGES[reason]
        || MATCHING_EXHAUSTED_MESSAGES.NO_CANDIDATES_IN_AREA;
    }
    return "Finding a beautician for this home service booking.";
  }

  function dispatchStatusBadge(status) {
    if (!status) return '<span class="text-secondary small">—</span>';
    const color = DISPATCH_STATUS_COLORS[status] || "secondary";
    const label = String(status).replace(/_/g, " ");
    return `<span class="badge bg-${color}-lt">${label}</span>`;
  }

  function formatIsoDateTime(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    return d.toLocaleDateString("en-NG", { day: "2-digit", month: "short", year: "numeric" })
      + " · "
      + d.toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" });
  }

  function summarizeDispatchEvent(event, esc) {
    const payload = event && event.payload;
    if (!payload || typeof payload !== "object") return "";
    const parts = [];
    if (payload.tier != null) parts.push("tier " + payload.tier);
    if (payload.radiusKm != null) parts.push(payload.radiusKm + " km");
    if (payload.candidateCount != null) parts.push(payload.candidateCount + " candidates");
    if (payload.distanceKm != null) parts.push(payload.distanceKm + " km away");
    if (payload.beauticianUserId) parts.push("beautician " + shortId(payload.beauticianUserId));
    return parts.length ? esc(parts.join(" · ")) : "";
  }

  function formatCustomerRating(rating) {
    if (rating == null) return "";
    const num = Number(rating);
    if (Number.isNaN(num)) return String(rating);
    return num % 1 === 0 ? String(num) : num.toFixed(1);
  }

  /** Filled/empty stars (1–5) from a numeric rating. Rounds to nearest whole star. */
  function renderStarRating(rating, opts = {}) {
    const esc = opts.esc || ((value) => String(value ?? ""));
    let n = Math.round(Number(rating) || 0);
    if (n < 0) n = 0;
    if (n > 5) n = 5;
    const label = formatCustomerRating(rating) || String(n);
    let html = '<span class="detail-review-stars" aria-label="' + esc(label) + ' out of 5">';
    for (let i = 1; i <= 5; i++) {
      html += i <= n ? "★" : '<span class="star-empty">★</span>';
    }
    return html + "</span>";
  }

  function renderCustomerFeedbackHtml(booking, opts = {}) {
    if (!booking) return "";
    const hasRating = booking.customerRating != null;
    const hasReview = booking.customerReview != null;
    if (!hasRating && !hasReview) return "";

    const esc = opts.esc || ((value) => String(value ?? ""));
    const labelClass = opts.labelClass || "detail-field-label";
    const showTitle = opts.showTitle !== false && !opts.plain;
    let inner = (showTitle ? '<div class="mb-2 fw-semibold">Customer Feedback</div>' : "") +
      '<div class="row g-3">';
    if (hasRating) {
      const score = formatCustomerRating(booking.customerRating);
      inner +=
        '<div class="col-12"><div class="' + labelClass + '">Rating</div>' +
        '<div class="detail-field-value">' +
        '<div class="detail-rating-row">' +
        renderStarRating(booking.customerRating, { esc }) +
        '<span class="fw-semibold">' + esc(score) +
        ' <span class="text-secondary fw-normal">/ 5</span></span>' +
        "</div></div></div>";
    }
    if (hasReview) {
      inner +=
        '<div class="col-12"><div class="' + labelClass + '">Review</div>' +
        '<div class="detail-prose text-secondary">' + esc(booking.customerReview) + "</div></div>";
    }
    inner += "</div>";
    if (opts.plain) return inner;
    if (opts.section) return '<div class="detail-section">' + inner + "</div>";
    if (opts.layout) return '<div class="' + opts.layout + '">' + inner + "</div>";
    return '<div class="col-12">' + inner + "</div>";
  }

  function renderHomeServiceTimelineHtml(booking, opts = {}) {
    if (!isHomeServiceBooking(booking)) return "";
    const esc = opts.esc || ((value) => String(value ?? ""));
    const labelClass = opts.labelClass || "detail-field-label";
    const showTitle = opts.showTitle !== false && !opts.plain;
    const fields = [
      ["Arrival verified", booking.arrivalVerifiedAt],
      ["Service started", booking.serviceStartedAt],
      ["Service completed", booking.serviceCompletedAt],
    ];
    const col = opts.plain ? "col-12" : "col-sm-4";
    const inner =
      (showTitle ? '<div class="mb-2 fw-semibold">Service Timeline</div>' : "") +
      '<div class="row g-3">' +
      fields.map(function (pair) {
        return '<div class="' + col + '"><div class="' + labelClass + '">' + esc(pair[0]) + "</div>" +
          '<div class="detail-field-value">' + esc(formatIsoDateTime(pair[1])) + "</div></div>";
      }).join("") +
      "</div>";
    if (opts.plain) return inner;
    if (opts.section) return '<div class="detail-section">' + inner + "</div>";
    if (opts.layout) return '<div class="' + opts.layout + '">' + inner + "</div>";
    return '<div class="col-12">' + inner + "</div>";
  }

  function renderAssignmentAlertHtml(booking, opts = {}) {
    const esc = opts.esc || ((value) => String(value || ""));
    const message = getAssignmentStatusMessage(booking);
    if (!message || !isHomeServiceBooking(booking)) return "";
    const alertClass = isMatchingExhausted(booking) ? "alert-warning" : "alert-info";
    let html = '<div class="alert ' + alertClass + ' mb-0 py-2 small">' + esc(message);
    if (booking.dispatchStatus) {
      html += '<div class="mt-1">Dispatch: ' + dispatchStatusBadge(booking.dispatchStatus) + "</div>";
    }
    if (booking.matchingAttempt != null) {
      html += '<div class="mt-1 text-secondary">Matching tier: ' + esc(booking.matchingAttempt) + "</div>";
    }
    html += "</div>";
    if (opts.plain) return html;
    return '<div class="col-12">' + html + "</div>";
  }

  function renderDispatchTraceHtml(trace, opts = {}) {
    const esc = opts.esc || ((value) => String(value || ""));
    if (!trace) return "";

    const events = Array.isArray(trace.events) ? trace.events : [];
    const offers = Array.isArray(trace.offers) ? trace.offers : [];
    const showTitle = opts.showTitle !== false && !opts.plain;
    const labelClass = "detail-field-label";

    let summary =
      (showTitle ? '<div class="mb-2 fw-semibold">Dispatch Trace</div>' : "") +
      '<div class="row g-3 mb-3">' +
      '<div class="col-sm-6"><div class="' + labelClass + '">Dispatch status</div>' +
      '<div class="detail-field-value">' + dispatchStatusBadge(trace.dispatchStatus) + "</div></div>" +
      '<div class="col-sm-6"><div class="' + labelClass + '">Matching tier</div>' +
      '<div class="detail-field-value">' + esc(trace.matchingAttempt ?? "—") + "</div></div>" +
      '<div class="col-sm-6"><div class="' + labelClass + '">Started</div>' +
      '<div class="detail-field-value">' + esc(formatIsoDateTime(trace.matchingStartedAt)) + "</div></div>" +
      '<div class="col-sm-6"><div class="' + labelClass + '">Exhausted</div>' +
      '<div class="detail-field-value">' + esc(formatIsoDateTime(trace.matchingExhaustedAt)) + "</div></div>" +
      "</div>";

    const eventRows = events.length
      ? events.map(function (ev) {
        const label = DISPATCH_EVENT_LABELS[ev.eventType] || ev.eventType || "Event";
        const detail = summarizeDispatchEvent(ev, esc);
        return '<div class="detail-trace-event d-flex gap-2 py-2 border-bottom small">' +
          '<span class="text-secondary text-nowrap" style="min-width:7rem">' + esc(formatIsoDateTime(ev.createdAt)) + "</span>" +
          '<span class="fw-semibold">' + esc(label) + "</span>" +
          (detail ? '<span class="text-secondary ms-auto text-end">' + detail + "</span>" : "") +
          "</div>";
      }).join("")
      : '<div class="text-secondary small py-2">No dispatch events yet.</div>';

    const offerRows = offers.length
      ? '<div class="table-responsive mt-3"><table class="table table-sm table-vcenter mb-0">' +
        "<thead><tr><th>Beautician</th><th>Status</th><th>Tier</th><th>Distance</th><th>Offered</th></tr></thead><tbody>" +
        offers.map(function (o) {
          const b = o.beautician || {};
          const bName = [b.firstName, b.lastName].filter(Boolean).join(" ") || shortId(o.beauticianUserId);
          return "<tr>" +
            "<td>" + esc(bName) + "</td>" +
            '<td><span class="badge bg-secondary-lt">' + esc((o.status || "—").replace(/_/g, " ")) + "</span></td>" +
            "<td>" + esc(o.tier ?? "—") + "</td>" +
            "<td>" + (o.distanceKmAtOffer != null ? esc(o.distanceKmAtOffer + " km") : "—") + "</td>" +
            '<td class="text-secondary small">' + esc(formatIsoDateTime(o.offeredAt)) + "</td>" +
            "</tr>";
        }).join("") +
        "</tbody></table></div>"
      : '<div class="text-secondary small py-2">No job offers recorded.</div>';

    const body = summary +
      '<div class="detail-field-label mb-1">Events</div>' +
      '<div class="detail-trace-events border rounded px-2 mb-3" style="max-height:220px;overflow-y:auto">' + eventRows + "</div>" +
      '<div class="detail-field-label mb-1">Job offers</div>' + offerRows;

    if (opts.plain) return body;
    return '<div class="detail-section">' + body + "</div>";
  }

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
    getCancellationPolicy,
    updateCancellationPolicy,
    CANCELLATION_SCENARIO_LABELS,
    CANCELLATION_SCENARIOS_WITH_WINDOW,
    scenarioLabel,
    scenarioGuide,
    validateCancellationRule,
    validateCancellationRules,
    renderCancellationDetailHtml,
    retryMatching,
    getDispatchTrace,
    forceAssign,
    isHomeServiceBooking,
    isPendingAssignment,
    isMatchingExhausted,
    canAdminRetryMatching,
    canAdminForceAssign,
    getAssignmentStatusMessage,
    dispatchStatusBadge,
    formatIsoDateTime,
    renderAssignmentAlertHtml,
    renderHomeServiceTimelineHtml,
    renderCustomerFeedbackHtml,
    formatCustomerRating,
    renderStarRating,
    renderDispatchTraceHtml,
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
    normalizeBranch,
    resolveBranch,
    formatBranchLabel,
    formatBranchAddress,
    formatBranchTableCell,
    renderBranchDetailHtml,
    formatAddress,
    getGoogleMapsPlaceUrl,
  };
})();
