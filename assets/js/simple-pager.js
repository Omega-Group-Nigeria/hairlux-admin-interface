/**
 * SimplePager — a small "Per page / Previous / Next" control for long lists.
 *
 * Client-side (you already hold the whole array):
 *   var pager = SimplePager.attach("#my-table-pager", { onChange: render });
 *   function render() {
 *     var rows = pager.slice(allRows);           // current page only
 *     tbody.innerHTML = rows.map(rowHtml).join("");
 *   }
 *   // when the data or a filter changes: pager.reset(); render();
 *
 * Server-side (the API pages for you):
 *   var pager = SimplePager.attach("#pager", { onChange: load });
 *   function load() {
 *     api.list({ page: pager.page, limit: pager.perPage }).then(function (res) {
 *       pager.setTotal(res.meta.total);
 *       ...
 *     });
 *   }
 *
 * The container may be an empty <div>; the control renders itself into it.
 * It hides itself when everything fits on one page at the smallest size.
 */
(function (global) {
  "use strict";

  var SIZES = [10, 25, 50, 100];

  function attach(target, opts) {
    opts = opts || {};
    var el = typeof target === "string" ? document.querySelector(target) : target;
    if (!el) return null;

    var state = {
      page: 1,
      perPage: opts.perPage || 25,
      total: 0,
    };

    el.classList.add("simple-pager", "d-flex", "align-items-center", "flex-wrap", "gap-2", "px-3", "py-2", "border-top");
    el.innerHTML =
      '<div class="d-flex align-items-center gap-1 text-secondary small">' +
      '<span>Per page</span>' +
      '<select class="form-select form-select-sm sp-size" style="width:auto">' +
      SIZES.map(function (s) { return '<option value="' + s + '">' + s + "</option>"; }).join("") +
      "</select></div>" +
      '<span class="text-secondary small sp-info ms-auto"></span>' +
      '<div class="btn-group btn-group-sm">' +
      '<button type="button" class="btn btn-outline-secondary sp-prev">&lsaquo; Previous</button>' +
      '<button type="button" class="btn btn-outline-secondary sp-next">Next &rsaquo;</button>' +
      "</div>";

    var sizeSel = el.querySelector(".sp-size");
    var info = el.querySelector(".sp-info");
    var prev = el.querySelector(".sp-prev");
    var next = el.querySelector(".sp-next");
    sizeSel.value = String(state.perPage);

    function pages() { return Math.max(1, Math.ceil(state.total / state.perPage)); }

    function paint() {
      if (state.page > pages()) state.page = pages();
      var from = state.total ? (state.page - 1) * state.perPage + 1 : 0;
      var to = Math.min(state.total, state.page * state.perPage);
      info.textContent = state.total
        ? "Showing " + from + "–" + to + " of " + state.total.toLocaleString()
        : "No records";
      prev.disabled = state.page <= 1;
      next.disabled = state.page >= pages();
      el.classList.toggle("d-none", state.total <= SIZES[0]);
    }

    function go(p) {
      state.page = Math.min(Math.max(1, p), pages());
      paint();
      if (typeof opts.onChange === "function") opts.onChange(api);
    }

    prev.addEventListener("click", function () { go(state.page - 1); });
    next.addEventListener("click", function () { go(state.page + 1); });
    sizeSel.addEventListener("change", function () {
      state.perPage = Number(sizeSel.value) || 25;
      go(1);
    });

    var api = {
      get page() { return state.page; },
      get perPage() { return state.perPage; },
      get total() { return state.total; },
      /** Server-side paging: tell the pager how many records exist. */
      setTotal: function (n) { state.total = Number(n) || 0; paint(); },
      /** Client-side paging: returns the rows for the current page and updates the total. */
      slice: function (rows) {
        rows = rows || [];
        state.total = rows.length;
        paint();
        var start = (state.page - 1) * state.perPage;
        return rows.slice(start, start + state.perPage);
      },
      /** Back to page 1 (call when a filter or search changes). Does not fire onChange. */
      reset: function () { state.page = 1; },
      goTo: go,
    };
    paint();
    return api;
  }

  global.SimplePager = { attach: attach };
})(window);
