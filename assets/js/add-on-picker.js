/**
 * add-on-picker.js: optional service add-ons under a booking's service line
 * (Service add-on module, 2026-10-24).
 *
 * When the chosen service offers add-ons on this channel, an "Add-ons"
 * button appears under its line. It opens a checklist of the add-ons with
 * their add-on prices; nothing is ticked by default. The page adds the
 * ticked add-ons to the booking as extra lines with addOnOf = the main
 * service, and the API checks and prices them again.
 *
 * Usage (one picker per service line element):
 *   AddOnPicker.attach(rowEl, { mode: 'WALK_IN', getServiceId: fn, getBranchId: fn, onChange: fn });
 *   AddOnPicker.refresh(rowEl)            // after the line's service or branch changed
 *   AddOnPicker.preselect(rowEl, [ids])   // edit forms: tick saved add-ons
 *   AddOnPicker.lines(rowEl)              // [{ serviceId, quantity: 1, addOnOf }] to send
 *   AddOnPicker.total(rowEl)              // ticked add-ons total, for the estimate
 *   AddOnPicker.remove(rowEl)             // when the line is removed
 * Requires: auth.js (Auth.fetch).
 */
(function (global) {
    'use strict';

    var cache = {};

    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }
    function money(n) {
        return '₦' + Number(n || 0).toLocaleString('en-NG', { maximumFractionDigits: 2 });
    }

    async function fetchOptions(serviceId, mode, branchId) {
        var key = serviceId + '|' + mode + '|' + (branchId || '');
        if (cache[key]) return cache[key];
        cache[key] = (async function () {
            var res = await Auth.fetch('/services/add-on-options', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ serviceIds: [serviceId], mode: mode, branchId: branchId || undefined }),
            });
            if (!res || !res.ok) throw new Error('Could not load add-ons');
            var raw = await res.json();
            var data = raw && raw.data !== undefined ? raw.data : raw;
            var group = (data.byService || []).find(function (g) { return g.serviceId === serviceId; });
            return group ? group.addOns : [];
        })();
        try { return await cache[key]; } catch (e) { delete cache[key]; throw e; }
    }

    function state(row) { return row && row._addOnPicker; }

    function render(st) {
        var box = st.box;
        if (!st.serviceId || !st.addOns.length) {
            box.innerHTML = '';
            box.style.display = 'none';
            return;
        }
        box.style.display = '';
        var picked = st.addOns.filter(function (a) { return st.selected[a.id]; });
        var label = picked.length
            ? 'Add-ons: ' + picked.map(function (a) { return esc(a.name); }).join(', ') + ' (+' + money(picked.reduce(function (s, a) { return s + a.price; }, 0)) + ')'
            : 'Add-ons (' + st.addOns.length + ' available, optional)';
        // Inline styles as well as classes: also used on the staff portal, which has its own stylesheet.
        box.innerHTML =
            '<button type="button" class="aop-toggle" style="background:none;border:0;padding:2px 0;cursor:pointer;color:inherit;font-size:.85rem;text-decoration:underline;text-align:left">' +
            (st.open ? '▾ ' : '▸ ') + label + '</button>' +
            (st.open ? '<div class="aop-list" style="border:1px solid rgba(128,128,128,.35);border-radius:6px;padding:8px 10px;margin-top:4px">' + st.addOns.map(function (a) {
                var saving = a.standardPrice > a.price ? ' <span style="opacity:.6;text-decoration:line-through">' + money(a.standardPrice) + '</span>' : '';
                return '<label style="display:flex;gap:8px;align-items:center;margin:0 0 4px;font-size:.875rem;cursor:pointer;font-weight:400">' +
                    '<input type="checkbox" data-addon="' + esc(a.id) + '"' + (st.selected[a.id] ? ' checked' : '') + '>' +
                    '<span>' + esc(a.name) + ' <strong>' + money(a.price) + '</strong>' + saving +
                    (a.duration ? ' <span style="opacity:.65;font-size:.8rem">' + a.duration + ' min</span>' : '') + '</span></label>';
            }).join('') + '</div>' : '');
    }

    function attach(row, opts) {
        if (!row || state(row)) return;
        var box = document.createElement('div');
        box.className = 'aop-box';
        box.style.margin = '-4px 0 8px';
        box.style.display = 'none';
        row.insertAdjacentElement('afterend', box);
        var st = { row: row, box: box, opts: opts || {}, serviceId: null, addOns: [], selected: {}, open: false, seq: 0 };
        row._addOnPicker = st;
        box.addEventListener('click', function (e) {
            if (e.target.closest('.aop-toggle')) { st.open = !st.open; render(st); }
        });
        box.addEventListener('change', function (e) {
            var cb = e.target.closest('input[data-addon]');
            if (!cb) return;
            st.selected[cb.getAttribute('data-addon')] = cb.checked;
            render(st);
            if (st.opts.onChange) st.opts.onChange();
        });
        return refresh(row);
    }

    async function refresh(row) {
        var st = state(row);
        if (!st) return;
        var serviceId = st.opts.getServiceId ? st.opts.getServiceId() : null;
        var branchId = st.opts.getBranchId ? st.opts.getBranchId() : null;
        var mode = st.opts.mode || 'WALK_IN';
        if (serviceId !== st.serviceId) { st.selected = {}; st.open = false; }
        st.serviceId = serviceId || null;
        var seq = ++st.seq;
        if (!serviceId) { st.addOns = []; render(st); if (st.opts.onChange) st.opts.onChange(); return; }
        try {
            var list = await fetchOptions(serviceId, mode, branchId);
            if (seq !== st.seq) return;
            st.addOns = list;
            Object.keys(st.selected).forEach(function (id) {
                if (!list.some(function (a) { return a.id === id; })) delete st.selected[id];
            });
        } catch (_) {
            if (seq !== st.seq) return;
            st.addOns = [];
        }
        render(st);
        if (st.opts.onChange) st.opts.onChange();
    }

    async function preselect(row, ids) {
        var st = state(row);
        if (!st) return;
        await refresh(row);
        (ids || []).forEach(function (id) { st.selected[id] = true; });
        st.open = (ids || []).length > 0;
        render(st);
        if (st.opts.onChange) st.opts.onChange();
    }

    function picked(row) {
        var st = state(row);
        if (!st || !st.serviceId) return [];
        return st.addOns.filter(function (a) { return st.selected[a.id]; });
    }

    function lines(row) {
        var st = state(row);
        return picked(row).map(function (a) { return { serviceId: a.id, quantity: 1, addOnOf: st.serviceId }; });
    }

    function total(row) {
        return picked(row).reduce(function (s, a) { return s + Number(a.price || 0); }, 0);
    }

    function remove(row) {
        var st = state(row);
        if (st && st.box && st.box.parentNode) st.box.parentNode.removeChild(st.box);
        if (row) row._addOnPicker = null;
    }

    global.AddOnPicker = { attach: attach, refresh: refresh, preselect: preselect, lines: lines, picked: picked, total: total, remove: remove };
})(window);
