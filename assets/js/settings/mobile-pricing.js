/**
 * Settings > Home Service > Mobile Pricing (2026-10-23).
 * Travel fee rates by area, trip multiplier, travel share, customer service
 * fee % and caps, deposit and payment options, road-distance method.
 * Saved with PUT /admin/settings/home-service; the API enforces all of it.
 * Requires: auth.js (Auth.fetch), rbac.js
 */
(function () {
    'use strict';

    function $(id) { return document.getElementById(id); }
    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }
    function alertBox(msg, type) {
        var el = $('mp-alert');
        if (!el) return;
        el.className = 'alert alert-' + (type || 'success');
        el.textContent = msg;
        el.classList.remove('d-none');
    }
    async function api(path, opts) {
        var res = await Auth.fetch(path, opts);
        if (!res) throw new Error('Your session has ended. Please sign in again.');
        var raw = await res.json().catch(function () { return {}; });
        if (!res.ok) {
            var m = Array.isArray(raw.message) ? raw.message.join('. ') : raw.message;
            throw new Error(m || 'Request failed (' + res.status + ')');
        }
        return raw.data !== undefined ? raw.data : raw;
    }

    var canEdit = false;

    // States and cities: the same bundled list as Home Service Areas
    // (assets/js/data/nigeria-cities.js). A saved value missing from the list
    // (e.g. "Ibadan", set before this list) is kept as its own option.
    function ngCities() { return window.NG_CITIES || {}; }
    function findKey(list, value) {
        var v = String(value || '').trim().toLowerCase();
        return list.find(function (x) { return x.toLowerCase() === v; });
    }
    function stateOptions(current) {
        var states = Object.keys(ngCities()).sort();
        var match = findKey(states, current);
        var html = '<option value="">Select state\u2026</option>';
        if (current && !match) html += '<option value="' + esc(current) + '" selected>' + esc(current) + '</option>';
        return html + states.map(function (s) {
            return '<option value="' + esc(s) + '"' + (s === match ? ' selected' : '') + '>' + esc(s) + '</option>';
        }).join('');
    }
    function cityOptions(state, current) {
        var key = findKey(Object.keys(ngCities()), state);
        var cities = key ? (ngCities()[key] || []).slice().sort() : [];
        var cur = String(current || '*').trim() || '*';
        var match = cur === '*' ? '*' : findKey(cities, cur);
        var html = '<option value="*"' + (match === '*' ? ' selected' : '') + '>All cities</option>';
        if (!match) html += '<option value="' + esc(cur) + '" selected>' + esc(cur) + '</option>';
        return html + cities.map(function (c) {
            return '<option value="' + esc(c) + '"' + (c === match ? ' selected' : '') + '>' + esc(c) + '</option>';
        }).join('');
    }

    function rateRow(r) {
        return '<tr><td style="min-width:130px"><select class="form-select form-select-sm" data-f="state">' + stateOptions(r.state) + '</select></td>' +
            '<td style="min-width:150px"><select class="form-select form-select-sm" data-f="city">' + cityOptions(r.state, r.city) + '</select></td>' +
            '<td><input type="number" class="form-control form-control-sm" data-f="ratePerKm" min="0" step="10" value="' + esc(r.ratePerKm) + '"></td>' +
            '<td><button type="button" class="btn btn-sm btn-ghost-danger" data-rm>&times;</button></td></tr>';
    }
    function bandRow(b) {
        return '<tr><td><input type="number" class="form-control form-control-sm" data-f="upTo" min="0" step="0.01" placeholder="No limit" value="' + (b.upTo == null ? '' : esc(b.upTo)) + '"></td>' +
            '<td><input type="number" class="form-control form-control-sm" data-f="cap" min="0" step="50" value="' + esc(b.cap) + '"></td>' +
            '<td><button type="button" class="btn btn-sm btn-ghost-danger" data-rm>&times;</button></td></tr>';
    }

    function fill(s) {
        $('mp-rates-tbody').innerHTML = (s.travelFeeRates || []).map(rateRow).join('') ||
            '<tr class="mp-empty"><td colspan="4" class="text-secondary small">No rates yet: mobile bookings cannot be priced until an area has a rate.</td></tr>';
        $('mp-bands-tbody').innerHTML = (s.serviceFeeTiers || []).map(bandRow).join('');
        $('mp-multiplier').value = s.travelTripMultiplier;
        $('mp-travel-share').value = Math.round(Number(s.travelBeauticianShare) * 10000) / 100;
        $('mp-fee-percent').value = s.serviceFeePercent;
        $('mp-full-on').checked = !!s.fullPaymentEnabled;
        $('mp-deposit-on').checked = !!s.depositEnabled;
        $('mp-deposit-percent').value = s.depositPercent;
        $('mp-quote-minutes').value = s.quoteValidityMinutes;
        $('mp-routing').value = s.routingProvider || 'GOOGLE';
        $('mp-road-factor').value = s.roadFactor;
        $('mp-service-share').textContent = Math.round(Number(s.commissionRate) * 10000) / 100;
        lock();
    }

    function lock() {
        document.querySelectorAll('#mobile-pricing-card input, #mobile-pricing-card select, #mobile-pricing-card button').forEach(function (el) {
            el.disabled = !canEdit;
        });
    }

    function collect() {
        var rates = [];
        document.querySelectorAll('#mp-rates-tbody tr:not(.mp-empty)').forEach(function (tr) {
            var state = tr.querySelector('[data-f="state"]').value.trim();
            var city = tr.querySelector('[data-f="city"]').value.trim() || '*';
            var rate = Number(tr.querySelector('[data-f="ratePerKm"]').value);
            if (state) rates.push({ state: state, city: city, ratePerKm: rate });
        });
        var seen = {};
        rates.forEach(function (r) {
            var k = r.state.toLowerCase() + '|' + r.city.toLowerCase();
            if (seen[k]) throw new Error(r.state + ', ' + (r.city === '*' ? 'All cities' : r.city) + ' has more than one rate. Keep one.');
            seen[k] = true;
        });
        var bands = [];
        document.querySelectorAll('#mp-bands-tbody tr').forEach(function (tr) {
            var upRaw = tr.querySelector('[data-f="upTo"]').value.trim();
            var cap = tr.querySelector('[data-f="cap"]').value.trim();
            if (cap !== '') bands.push({ upTo: upRaw === '' ? null : Number(upRaw), cap: Number(cap) });
        });
        if (bands.filter(function (b) { return b.upTo === null; }).length > 1) throw new Error('Only the last band can have no upper limit.');
        return {
            travelFeeRates: rates,
            travelTripMultiplier: Number($('mp-multiplier').value),
            travelBeauticianShare: Number($('mp-travel-share').value) / 100,
            serviceFeePercent: Number($('mp-fee-percent').value),
            serviceFeeTiers: bands,
            fullPaymentEnabled: $('mp-full-on').checked,
            depositEnabled: $('mp-deposit-on').checked,
            depositPercent: Number($('mp-deposit-percent').value),
            quoteValidityMinutes: Number($('mp-quote-minutes').value),
            routingProvider: $('mp-routing').value,
            roadFactor: Number($('mp-road-factor').value),
        };
    }

    async function save() {
        var btn = $('btn-save-mobile-pricing');
        btn.disabled = true;
        try {
            var s = await api('/admin/settings/home-service', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(collect()) });
            fill(s);
            alertBox('Mobile pricing saved. New price quotes use it straight away; bookings already made keep their price.', 'success');
        } catch (e) {
            alertBox(e.message, 'danger');
        } finally {
            btn.disabled = !canEdit;
        }
    }

    document.addEventListener('DOMContentLoaded', async function () {
        if (!$('mobile-pricing-card')) return;
        if (typeof RBAC !== 'undefined' && RBAC.isAdminOnlyAccount && RBAC.isAdminOnlyAccount()) return;
        canEdit = typeof RBAC === 'undefined' || !RBAC.can || RBAC.can('settings:manage');
        $('btn-save-mobile-pricing').addEventListener('click', save);
        $('mp-add-rate').addEventListener('click', function () {
            var empty = document.querySelector('#mp-rates-tbody .mp-empty');
            if (empty) empty.remove();
            $('mp-rates-tbody').insertAdjacentHTML('beforeend', rateRow({ state: '', city: '*', ratePerKm: '' }));
        });
        $('mp-add-band').addEventListener('click', function () {
            $('mp-bands-tbody').insertAdjacentHTML('beforeend', bandRow({ upTo: null, cap: '' }));
        });
        // A new state reloads that row's city list (back to All cities).
        $('mp-rates-tbody').addEventListener('change', function (e) {
            if (e.target.getAttribute('data-f') !== 'state') return;
            var tr = e.target.closest('tr');
            tr.querySelector('[data-f="city"]').innerHTML = cityOptions(e.target.value, '*');
        });
        document.getElementById('mobile-pricing-card').addEventListener('click', function (e) {
            var rm = e.target.closest('[data-rm]');
            if (rm) rm.closest('tr').remove();
        });
        try {
            fill(await api('/admin/settings/home-service'));
        } catch (e) {
            alertBox(e.message, 'danger');
        }
    });
})();
