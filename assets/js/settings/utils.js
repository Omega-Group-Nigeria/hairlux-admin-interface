/**
 * settings/utils.js — alerts, escape, fuzzy search helpers
 */
(function (global) {
    'use strict';

    var SP = (global.SettingsPage = global.SettingsPage || {});
    var State = SP.State;

function showAlert(type, msg) {
    const el  = document.getElementById('global-alert');
    const ico = document.getElementById('global-alert-icon');
    const txt = document.getElementById('global-alert-msg');
    el.className = 'alert alert-' + type + ' mb-3';
    ico.innerHTML = type === 'success'
        ? '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon"><path d="M5 12l5 5l10 -10"/></svg>'
        : '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon"><path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>';
    txt.textContent = msg;
    el.classList.remove('d-none');
    clearTimeout(el._timer);
    el._timer = setTimeout(function() { el.classList.add('d-none'); }, 5000);
}

function dismissAlert() { document.getElementById('global-alert').classList.add('d-none'); }

function setSpinner(id, on) { var el = document.getElementById(id); if (el) el.classList.toggle('d-none', !on); }

function _esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function showAdminAlert(type, msg) {
    var el  = document.getElementById('admin-alert');
    var ico = document.getElementById('admin-alert-icon');
    var txt = document.getElementById('admin-alert-msg');
    el.className = 'alert alert-' + type + ' mb-3';
    ico.innerHTML = type === 'success'
        ? '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon"><path d="M5 12l5 5l10 -10"/></svg>'
        : '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon"><path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>';
    txt.textContent = msg;
    el.classList.remove('d-none');
    clearTimeout(el._timer);
    el._timer = setTimeout(function() { el.classList.add('d-none'); }, 6000);
}

function showHomeServiceAlert(type, msg) {
    var el  = document.getElementById('home-service-alert');
    var ico = document.getElementById('home-service-alert-icon');
    var txt = document.getElementById('home-service-alert-msg');
    el.className = 'alert alert-' + type + ' mb-3';
    ico.innerHTML = type === 'success'
        ? '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon"><path d="M5 12l5 5l10 -10"/></svg>'
        : '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon"><path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>';
    txt.textContent = msg;
    el.classList.remove('d-none');
    clearTimeout(el._timer);
    el._timer = setTimeout(function() { el.classList.add('d-none'); }, 6000);
}

function fuzzyScore(str, query) {
    str   = str.toLowerCase();
    query = query.toLowerCase().trim();
    if (!query) return 1;
    // Exact or substring match gets top score
    if (str.indexOf(query) !== -1) return 100 + query.length;
    var qi = 0, si = 0, matches = 0, gaps = 0;
    while (si < str.length && qi < query.length) {
        if (str.charAt(si) === query.charAt(qi)) {
            matches++;
            qi++;
        } else if (matches > 0) {
            gaps++;
        }
        si++;
    }
    if (qi < query.length) return 0; // couldn't match all query chars
    // Score: more matches, fewer gaps = better
    return matches - gaps * 0.5;
}

    SP.Utils = {
        showAlert: showAlert,
        dismissAlert: dismissAlert,
        setSpinner: setSpinner,
        _esc: _esc,
        showAdminAlert: showAdminAlert,
        showHomeServiceAlert: showHomeServiceAlert,
        fuzzyScore: fuzzyScore,
    };
})(window);
