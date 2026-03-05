/**
 * analytics.js — Hairlux Admin
 * Helper module for all /admin/analytics/* API calls.
 * Import this file on any page that needs analytics data.
 *
 * Requires:
 *   - window.API_BASE  (e.g. "https://api.hairlux.com")
 *   - window.AUTH_TOKEN or localStorage key "hairlux_token"
 */

const Analytics = (() => {
  // ─── Chart instance cache (so we can destroy before re-rendering) ───────────
  let _revenueChart       = null;
  let _bookingTrendsChart = null;

  // ─── Config ─────────────────────────────────────────────────────────────────
  // Read at call time so config.js is always guaranteed to have run first
  function getBase() {
    return (window.API_BASE || "").replace(/\/$/, "");
  }

  function getToken() {
    return (
      window.AUTH_TOKEN ||
      localStorage.getItem("hairlux_token") ||
      ""
    );
  }

  function authHeaders() {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
    };
  }

  // ─── Generic fetch wrapper ───────────────────────────────────────────────────
  async function apiFetch(path) {
    const res = await fetch(`${getBase()}${path}`, { headers: authHeaders() });
    if (!res.ok) throw new Error(`API error ${res.status}: ${path}`);
    const raw = await res.json();
    // Unwrap { success, message, data: {...} } if present
    return raw.data !== undefined && !Array.isArray(raw) && !Array.isArray(raw.data)
      ? raw.data
      : raw;
  }

  // ─── Date helpers ────────────────────────────────────────────────────────────
  function today() {
    return new Date().toISOString().slice(0, 10);
  }

  function daysAgo(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().slice(0, 10);
  }

  // ─── API calls ───────────────────────────────────────────────────────────────

  /**
   * GET /admin/analytics/dashboard
   * Returns today's bookings, revenue, pending and overall totals.
   */
  async function getDashboard() {
    return apiFetch("/admin/analytics/dashboard");
  }

  /**
   * GET /admin/analytics/revenue
   * @param {string} startDate  YYYY-MM-DD
   * @param {string} endDate    YYYY-MM-DD
   */
  async function getRevenue(startDate, endDate) {
    return apiFetch(
      `/admin/analytics/revenue?startDate=${startDate}&endDate=${endDate}`
    );
  }

  /**
   * GET /admin/analytics/bookings
   * @param {string} startDate  YYYY-MM-DD
   * @param {string} endDate    YYYY-MM-DD
   */
  async function getBookingTrends(startDate, endDate) {
    return apiFetch(
      `/admin/analytics/bookings?startDate=${startDate}&endDate=${endDate}`
    );
  }

  /**
   * GET /admin/bookings
   * Fetches the most recent bookings for the dashboard table.
   * Uses Auth.fetch so token refresh is handled automatically.
   * @param {number} limit
   */
  async function getRecentBookings(limit = 5) {
    const res = await Auth.fetch(`/admin/bookings?limit=${limit}&page=1`);
    if (!res) return [];
    const raw = await res.json().catch(() => ({}));
    // Response shape: { data: [...], meta: {...} }
    // or wrapped:     { success, data: { data: [...], meta: {...} } }
    const payload = raw.data || raw;
    return Array.isArray(payload) ? payload : (payload.data || []);
  }

  // ─── Currency formatter ──────────────────────────────────────────────────────
  function formatCurrency(amount) {
    if (amount == null) return "—";
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      maximumFractionDigits: 0,
    }).format(amount);
  }

  // ─── KPI card renderer ───────────────────────────────────────────────────────
  /**
   * Populate the four KPI stat cards on the dashboard.
   * Reads from GET /admin/analytics/dashboard response.
   */
  function renderKpiCards(data) {
    const set = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    set("stat-today-bookings", data.today?.bookings ?? "—");
    set("stat-today-revenue",  formatCurrency(data.today?.revenue));
    set("stat-total-users",    data.overall?.totalUsers ?? "—");
    set("stat-pending-bookings", data.overall?.pendingBookings ?? "—");
  }

  // ─── Revenue Trend chart ─────────────────────────────────────────────────────
  /**
   * Render an ApexCharts area chart into #chart-revenue.
   * @param {{ byDate: { date: string, revenue: number }[] }} data
   */
  function renderRevenueChart(data) {
    const el = document.getElementById("chart-revenue");
    if (!el || !window.ApexCharts) return;

    const dates    = (data.byDate || []).map((d) => d.date);
    const revenues = (data.byDate || []).map((d) => d.revenue);

    // Destroy previous instance so resize observers / event listeners are removed
    if (_revenueChart) { _revenueChart.destroy(); _revenueChart = null; }
    el.innerHTML = "";

    _revenueChart = new ApexCharts(el, {
      chart: {
        type: "area",
        fontFamily: "inherit",
        height: 240,
        animations: { enabled: false },
        toolbar: { show: false },
        zoom: { enabled: false },
      },
      dataLabels: { enabled: false },
      fill: {
        type: "gradient",
        gradient: {
          shadeIntensity: 1,
          opacityFrom: 0.4,
          opacityTo: 0.05,
          stops: [0, 100],
        },
      },
      stroke: {
        width: 2,
        lineCap: "round",
        curve: "smooth",
      },
      series: [
        {
          name: "Revenue (₦)",
          data: revenues,
        },
      ],
      xaxis: {
        type: "datetime",
        categories: dates,
        labels: { padding: 0, datetimeUTC: false },
        tooltip: { enabled: false },
        axisBorder: { show: false },
      },
      yaxis: {
        labels: {
          formatter: (v) => "₦" + (v / 1000).toFixed(0) + "k",
          padding: 4,
        },
      },
      tooltip: {
        theme: "dark",
        x: { format: "dd MMM yyyy" },
        y: { formatter: (v) => formatCurrency(v) },
      },
      grid: { strokeDashArray: 4, padding: { top: -20, right: 0 } },
      colors: ["color-mix(in srgb, transparent, var(--tblr-primary) 100%)"],
      legend: { show: false },
    });
    _revenueChart.render();
  }

  // ─── Recent Bookings table ──────────────────────────────────────────────────
  /**
   * Render the last N bookings into #recent-bookings-tbody.
   * @param {object[]} bookings — array from getRecentBookings()
   */
  function renderRecentBookings(bookings) {
    const tbody = document.getElementById("recent-bookings-tbody");
    if (!tbody) return;

    if (!bookings || bookings.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center text-secondary py-4">No recent bookings.</td></tr>';
      return;
    }

    const hasBk = typeof Bookings !== 'undefined';

    tbody.innerHTML = bookings.map(function (b) {
      const customer  = b.user || b.customer || {};
      const custName  = customer.firstName
        ? customer.firstName + ' ' + customer.lastName
        : (b.guestName || customer.name || '\u2014');
      const custSub   = customer.email
        ? '<div class="text-secondary small mt-1">' + customer.email + '</div>'
        : (b.guestPhone ? '<div class="text-secondary small mt-1">' + b.guestPhone + '</div>' : '');

      // Reservation code cell
      const resCode  = b.reservationCode || '\u2014';
      const resBadge = b.reservationUsed
        ? '<span class="badge bg-secondary-lt ms-1" style="font-size:.65rem">used</span>'
        : '';
      const resCell  = '<div class="res-code">' + resCode + resBadge + '</div>' +
                       '<div class="text-secondary small mt-1">' + custName + '</div>' + custSub;

      // Services stacked list
      const services = b.services || (b.service ? [b.service] : []);
      const svcCell  = services.length
        ? '<ul class="svc-list">' + services.map(function (s) {
            let dur = null;
            if (s.duration && s.duration < 60) { dur = s.duration + 'min'; }
            else if (s.duration) { const h = Math.floor(s.duration / 60), m = s.duration % 60; dur = h + 'h' + (m ? m + 'm' : ''); }
            const price = s.price != null ? (hasBk ? Bookings.formatMoney(s.price) : ('\u20a6' + Number(s.price).toLocaleString())) : '';
            return '<li>' +
              '<span class="svc-name">' + (s.name || s.serviceName || 'Service') + '</span>' +
              '<span class="svc-meta">' + price + (dur ? ' &middot; ' + dur : '') + '</span>' +
              '</li>';
          }).join('') + '</ul>'
        : '<span class="text-secondary">\u2014</span>';

      // Booking type badge
      const bookingType = b.bookingType || '';
      const typeCell = bookingType === 'HOME_SERVICE'
        ? '<span class="badge bg-azure-lt">Home</span>'
        : bookingType === 'WALK_IN'
          ? '<span class="badge bg-teal-lt">Walk-in</span>'
          : '<span class="text-secondary small">\u2014</span>';

      const dateTime = hasBk && Bookings.formatDateTime
        ? Bookings.formatDateTime(b.bookingDate || b.date, b.bookingTime || b.time)
        : ((b.bookingDate || b.date || '') + (b.bookingTime || b.time ? ' ' + (b.bookingTime || b.time) : '')) || '\u2014';

      const amount = hasBk
        ? Bookings.formatMoney(b.totalAmount != null ? b.totalAmount : (b.amount != null ? b.amount : (b.price != null ? b.price : 0)))
        : '\u20a6' + Number(b.totalAmount || 0).toLocaleString();

      const statusBadge = hasBk && Bookings.statusBadge
        ? Bookings.statusBadge(b.status || 'PENDING')
        : '<span class="badge bg-secondary-lt">' + (b.status || 'PENDING').replace(/_/g, ' ') + '</span>';

      return '<tr>' +
        '<td>' + resCell + '</td>' +
        '<td class="td-services">' + svcCell + '</td>' +
        '<td class="text-secondary small text-nowrap">' + dateTime + '</td>' +
        '<td>' + typeCell + '</td>' +
        '<td class="fw-semibold text-nowrap">' + amount + '</td>' +
        '<td>' + statusBadge + '</td>' +
        '<td><button class="btn btn-sm btn-outline-secondary" onclick="openDetail(\'' + (b.id || '').replace(/'/g, "\\'") + '\')" type="button">View</button></td>' +
        '</tr>';
    }).join('');
  }

  // ─── Booking Trends area chart (chart-completion-tasks-3 style) ──────────────
  /**
   * Render an area chart of daily booking counts into #chart-booking-trends.
   * Uses byDate from GET /admin/analytics/bookings.
   * Also renders a status-count legend row if byStatus is present.
   * @param {{ byDate: { date: string, count: number }[], byStatus?: { status: string, count: number }[] }} data
   */
  function renderBookingTrendsChart(data) {
    const el = document.getElementById("chart-booking-trends");
    if (!el || !window.ApexCharts) return;

    const byDate = data.byDate || [];
    const dates  = byDate.map((d) => d.date);
    const counts = byDate.map((d) => d.count ?? d.total ?? 0);

    const STATUS_COLORS = {
      COMPLETED:   "#2fb344",
      CONFIRMED:   "#206bc4",
      PENDING:     "#f59f00",
      CANCELLED:   "#d63939",
      IN_PROGRESS: "#4299e1",
    };

    // Build compact status pill legend
    const byStatus = data.byStatus || [];
    let legendHtml = "";
    if (byStatus.length) {
      legendHtml = byStatus.map((s) => {
        const color = STATUS_COLORS[s.status] || "#adb5bd";
        const label = s.status.replace(/_/g, " ");
        return `<span class="me-3 small" style="color:${color}">` +
               `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color};margin-right:4px"></span>` +
               `${label} <strong>${s.count}</strong></span>`;
      }).join("");
    }

    const innerHeight = legendHtml ? 196 : 240;
    el.innerHTML = legendHtml
      ? `<div class="px-3 pt-2">${legendHtml}</div><div id="chart-booking-trends-inner"></div>`
      : "";
    const chartEl = legendHtml
      ? document.getElementById("chart-booking-trends-inner")
      : el;

    // Destroy previous instance
    if (_bookingTrendsChart) { _bookingTrendsChart.destroy(); _bookingTrendsChart = null; }

    _bookingTrendsChart = new ApexCharts(chartEl, {
      chart: {
        type: "area",
        fontFamily: "inherit",
        height: innerHeight,
        parentHeightOffset: 0,
        animations: { enabled: false },
        toolbar: { show: false },
        zoom: { enabled: false },
      },
      dataLabels: { enabled: false },
      fill: {
        colors: ["color-mix(in srgb, transparent, var(--tblr-primary) 16%)"],
        type: "solid",
      },
      stroke: {
        width: 2,
        lineCap: "round",
        curve: "smooth",
      },
      series: [{ name: "Bookings", data: counts }],
      labels: dates,
      xaxis: {
        type: "datetime",
        labels: { padding: 0, datetimeUTC: false },
        tooltip: { enabled: false },
        axisBorder: { show: false },
      },
      yaxis: {
        min: 0,
        labels: { formatter: (v) => Math.round(v), padding: 4 },
      },
      tooltip: {
        theme: "dark",
        x: { format: "dd MMM yyyy" },
        y: { formatter: (v) => v + " booking" + (v !== 1 ? "s" : "") },
      },
      grid: {
        strokeDashArray: 4,
        padding: { top: -20, right: 0, left: -4, bottom: -4 },
      },
      colors: ["color-mix(in srgb, transparent, var(--tblr-primary) 100%)"],
      legend: { show: false },
    });
    _bookingTrendsChart.render();
  }

  // ─── Public initialiser ──────────────────────────────────────────────────────
  /**
   * loadDashboard()
   * Fetches all needed data and renders KPI cards + both charts.
   * Call this once on DOMContentLoaded.
   *
   * @param {{ days?: number }} options
   *   days  – how many days back for revenue/booking range (default 30)
   */
  async function loadDashboard({ days = 30 } = {}) {
    const start = daysAgo(days);
    const end   = today();

    try {
      const [dashData, revenueData, bookingData, recentBookings] = await Promise.all([
        getDashboard(),
        getRevenue(start, end),
        getBookingTrends(start, end),
        getRecentBookings(5),
      ]);

      renderKpiCards(dashData);
      renderRevenueChart(revenueData);
      renderBookingTrendsChart(bookingData);
      renderRecentBookings(recentBookings);
    } catch (err) {
      console.error("[Analytics] Failed to load dashboard data:", err);
    }
  }

  // ─── Expose ──────────────────────────────────────────────────────────────────
  return {
    getDashboard,
    getRevenue,
    getBookingTrends,
    getRecentBookings,
    renderKpiCards,
    renderRevenueChart,
    renderBookingTrendsChart,
    renderRecentBookings,
    loadDashboard,
    formatCurrency,
    daysAgo,
    today,
  };
})();
