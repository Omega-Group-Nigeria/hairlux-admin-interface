/**
 * adverts/utils.js — alerts, escaping, table loading helpers
 */
(function (global) {
    'use strict';

    var State = global.Adverts.State;

    function esc(s) {
        return String(s == null ? "" : s)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    function escAttr(s) {
        return String(s == null ? "" : s).replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    }

    function setPageAlert(type, message) {
        var el = document.getElementById("adverts-page-alert");
        if (!el) return;
        if (!message) {
            el.className = "alert d-none mb-3";
            el.textContent = "";
            return;
        }
        el.className = "alert alert-" + type + " mb-3";
        el.textContent = message;
    }

    function flashPageAlert(type, message) {
        if (State.pageAlertTimer) clearTimeout(State.pageAlertTimer);
        setPageAlert(type, message);
        if (!message) return;
        var el = document.getElementById("adverts-page-alert");
        if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest" });
        State.pageAlertTimer = setTimeout(function () {
            setPageAlert("", "");
            State.pageAlertTimer = null;
        }, 5000);
    }

    function setFormAlert(type, message) {
        var el = document.getElementById("banner-form-alert");
        if (!el) return;
        if (!message) {
            el.className = "alert d-none";
            el.textContent = "";
            return;
        }
        el.className = "alert alert-" + type;
        el.textContent = message;
    }

    function setTableLoading() {
        document.getElementById("adverts-tbody").innerHTML =
            '<tr><td colspan="5" class="text-center py-5"><div class="spinner-border text-primary" role="status"></div></td></tr>';
    }

    function showEmpty(show) {
        var empty = document.getElementById("adverts-empty");
        if (empty) empty.classList.toggle("d-none", !show);
    }

    function setBtnLoading(btnId, spinnerId, loading, labelEl, label) {
        var btn = document.getElementById(btnId);
        var spin = document.getElementById(spinnerId);
        if (!btn) return;
        btn.disabled = loading;
        if (spin) spin.classList.toggle("d-none", !loading);
        if (labelEl && label !== undefined) labelEl.textContent = label;
    }

    global.Adverts.Utils = {
        esc: esc,
        escAttr: escAttr,
        setPageAlert: setPageAlert,
        flashPageAlert: flashPageAlert,
        setFormAlert: setFormAlert,
        setTableLoading: setTableLoading,
        showEmpty: showEmpty,
        setBtnLoading: setBtnLoading,
    };
})(window);