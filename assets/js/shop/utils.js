/**
 * shop/utils.js — alerts, escaping, table loading helpers
 */
(function (global) {
    'use strict';

    var SP = (global.ShopPage = global.ShopPage || {});
    var State = SP.State;

function setPageAlert(type, message) {
    var el = document.getElementById("shop-page-alert");
    if (!message) {
        el.className = "alert d-none mb-3";
        el.textContent = "";
        return;
    }
    el.className = "alert alert-" + type + " mb-3";
    el.textContent = message;
}

function flashPageAlert(type, message) {
    if (State.pageAlertTimer) {
        clearTimeout(State.pageAlertTimer);
        State.pageAlertTimer = null;
    }
    setPageAlert(type, message);
    if (!message) return;
    var el = document.getElementById("shop-page-alert");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    State.pageAlertTimer = setTimeout(function () {
        setPageAlert("", "");
        State.pageAlertTimer = null;
    }, 5000);
}

function setTableLoading(tbodyId, colspan, padding) {
    var tbody = document.getElementById(tbodyId);
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="' + colspan + '" class="text-center ' + (padding || "py-5") + '"><div class="spinner-border text-primary" role="status"></div></td></tr>';
}

function showSectionTableLoading(section) {
    if (section === "products") {
        setTableLoading("products-tbody", 7);
        document.getElementById("products-results-label").textContent = "Loading…";
        document.getElementById("products-pagination").textContent = "Loading…";
    } else if (section === "categories") {
        setTableLoading("categories-tbody", 4, "py-4");
    } else if (section === "delivery") {
        setTableLoading("delivery-tbody", 5, "py-4");
    } else if (section === "orders") {
        setTableLoading("orders-tbody", 6);
        document.getElementById("orders-results-label").textContent = "Loading…";
    }
}

function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function escAttr(s) {
    return String(s == null ? "" : s).replace(/'/g, "&#39;").replace(/"/g, "&quot;");
}

function buildStateSelectOptions(selected, includePlaceholder) {
    var html = includePlaceholder ? '<option value="">Select state…</option>' : "";
    (State.nigerianStates || []).forEach(function (state) {
        html += '<option value="' + escAttr(state) + '"' + (state === selected ? " selected" : "") + ">" + esc(state) + "</option>";
    });
    return html;
}

function populateStateSelect(el, selected) {
    if (!el) return;
    el.innerHTML = buildStateSelectOptions(selected, true);
}

function regionActiveBadge(isActive) {
    return isActive !== false
        ? '<span class="badge bg-success-lt text-success">Active</span>'
        : '<span class="badge bg-secondary-lt text-secondary">Inactive</span>';
}

    SP.Utils = {
        setPageAlert: setPageAlert,
        flashPageAlert: flashPageAlert,
        setTableLoading: setTableLoading,
        showSectionTableLoading: showSectionTableLoading,
        esc: esc,
        escAttr: escAttr,
        buildStateSelectOptions: buildStateSelectOptions,
        populateStateSelect: populateStateSelect,
        regionActiveBadge: regionActiveBadge,
    };
})(window);
