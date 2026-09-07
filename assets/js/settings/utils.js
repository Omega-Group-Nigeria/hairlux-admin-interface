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

// ── Home service area coverage helpers ────────────────────────────────────

function normalizeAreaPart(value) {
    if (value == null) return '';
    return String(value).trim().toLowerCase();
}

function normalizeArea(area) {
    return {
        state: normalizeAreaPart(area && area.state),
        city: normalizeAreaPart(area && area.city),
    };
}

/** True when `covering` includes `target` (same state; * or exact city). */
function areaCovers(covering, target) {
    var c = normalizeArea(covering);
    var t = normalizeArea(target);
    if (!c.state || !t.state || c.state !== t.state) return false;
    return c.city === '*' || c.city === t.city;
}

function areasEqual(a, b) {
    var x = normalizeArea(a);
    var y = normalizeArea(b);
    return x.state === y.state && x.city === y.city;
}

/** Whether `area` is already included by any entry in `existing`. */
function isAreaCoveredBy(area, existing) {
    return (existing || []).some(function (entry) {
        return areaCovers(entry, area);
    });
}

/** Index of the first entry that makes `area` redundant, or -1. */
function findCoveringIndex(area, areas, skipIndex) {
    var target = normalizeArea(area);
    for (var i = 0; i < areas.length; i++) {
        if (i === skipIndex) continue;
        if (areaCovers(areas[i], target)) return i;
    }
    return -1;
}

function isAreaRedundant(area, areas, index) {
    return findCoveringIndex(area, areas, index) !== -1;
}

function analyzeServiceableAreas(areas) {
    areas = areas || [];
    var effective = 0;
    var redundant = 0;
    var coverage = areas.map(function (area, i) {
        var coverIdx = findCoveringIndex(area, areas, i);
        var redundantEntry = coverIdx !== -1;
        if (redundantEntry) redundant++;
        else effective++;
        return {
            area: area,
            index: i,
            redundant: redundantEntry,
            coveredBy: redundantEntry ? areas[coverIdx] : null,
        };
    });
    return { areas: areas, coverage: coverage, effective: effective, redundant: redundant };
}

/** Drop entries that add no coverage beyond what is already listed. */
function dedupeServiceableAreas(areas) {
    var sorted = (areas || []).slice().sort(function (a, b) {
        var aWild = normalizeArea(a).city === '*' ? 0 : 1;
        var bWild = normalizeArea(b).city === '*' ? 0 : 1;
        return aWild - bWild;
    });
    var kept = [];
    sorted.forEach(function (area) {
        if (!isAreaCoveredBy(area, kept)) kept.push(area);
    });
    return kept;
}

/**
 * Merge new areas into existing, respecting wildcards:
 * - Adding state+* replaces all specific cities for that state.
 * - Skips cities already covered (exact dup or wildcard).
 */
function mergeServiceableAreas(existing, toAdd) {
    var result = (existing || []).slice();
    var added = [];
    var skipped = [];
    var replaced = 0;

    (toAdd || []).forEach(function (newArea) {
        var norm = normalizeArea(newArea);
        if (!norm.state || !norm.city) return;

        if (isAreaCoveredBy(newArea, result)) {
            skipped.push(newArea);
            return;
        }

        if (norm.city === '*') {
            var before = result.length;
            result = result.filter(function (a) {
                return normalizeArea(a).state !== norm.state;
            });
            replaced += before - result.length;
            result.push({ state: newArea.state, city: '*' });
            added.push({ state: newArea.state, city: '*' });
            return;
        }

        if (!result.some(function (a) { return areasEqual(a, newArea); })) {
            result.push({ state: newArea.state, city: newArea.city });
            added.push(newArea);
        } else {
            skipped.push(newArea);
        }
    });

    return { areas: result, added: added, skipped: skipped, replaced: replaced };
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
        normalizeAreaPart: normalizeAreaPart,
        normalizeArea: normalizeArea,
        areaCovers: areaCovers,
        areasEqual: areasEqual,
        isAreaCoveredBy: isAreaCoveredBy,
        findCoveringIndex: findCoveringIndex,
        isAreaRedundant: isAreaRedundant,
        analyzeServiceableAreas: analyzeServiceableAreas,
        dedupeServiceableAreas: dedupeServiceableAreas,
        mergeServiceableAreas: mergeServiceableAreas,
    };
})(window);
