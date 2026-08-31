/**
 * multi-select-dropdown.js
 * Turns a native <select multiple> into a searchable dropdown with
 * checkboxes, for option lists too long for a plain <select multiple> to
 * be usable (scrolling through 100+ options with no search, Ctrl/Cmd-click
 * to multi-select). The underlying <select> stays the source of truth --
 * its .selectedOptions update and a real 'change' event fires -- so any
 * existing code reading select.selectedOptions or listening for
 * 'change' keeps working untouched. Same philosophy as
 * searchable-select.js (this codebase's single-select equivalent);
 * deliberately a separate utility rather than extending that one, so the
 * already-working single-select behavior everywhere else stays untouched.
 *
 * Usage:
 *   MultiSelectDropdown.attach('my-select-id');   // once, after the element exists (with its <option>s already populated)
 *   MultiSelectDropdown.refresh('my-select-id');  // after repopulating its <option>s
 */
const MultiSelectDropdown = (function () {
    const registry = {}; // selectId -> { select, wrap, trigger, panel, search, list, options: [{value, label}] }

    function readOptions(select) {
        return Array.from(select.options).map(function (opt) {
            return { value: opt.value, label: opt.textContent, disabled: opt.disabled };
        });
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str == null ? '' : String(str);
        return div.innerHTML;
    }

    function selectedValues(select) {
        return Array.from(select.selectedOptions).map(function (o) { return o.value; });
    }

    function updateTrigger(state) {
        const selected = selectedValues(state.select);
        if (!selected.length) {
            state.trigger.textContent = state.placeholder;
            state.trigger.classList.add('msd-placeholder');
            return;
        }
        state.trigger.classList.remove('msd-placeholder');
        if (selected.length <= 2) {
            const labels = selected.map(function (v) {
                const match = state.options.find(function (o) { return o.value === v; });
                return match ? match.label : v;
            });
            state.trigger.textContent = labels.join(', ');
        } else {
            state.trigger.textContent = selected.length + ' selected';
        }
    }

    function renderList(state, query) {
        const q = (query || '').trim().toLowerCase();
        const selected = new Set(selectedValues(state.select));
        const matches = state.options.filter(function (o) {
            return !o.disabled && o.label.toLowerCase().indexOf(q) !== -1;
        });

        if (!matches.length) {
            state.list.innerHTML = q
                ? '<div class="msd-empty">No matches for "' + escapeHtml(query) + '"</div>'
                : '<div class="msd-empty">No options available</div>';
            return;
        }

        state.list.innerHTML = matches.map(function (o) {
            const checked = selected.has(o.value) ? ' checked' : '';
            const id = 'msd-opt-' + Math.random().toString(36).slice(2);
            return '<label class="msd-item" for="' + id + '">' +
                '<input type="checkbox" id="' + id + '" data-value="' + escapeHtml(o.value) + '"' + checked + '>' +
                '<span>' + escapeHtml(o.label) + '</span>' +
                '</label>';
        }).join('');
    }

    function toggleValue(state, value) {
        const opt = Array.from(state.select.options).find(function (o) { return o.value === value; });
        if (!opt) return;
        opt.selected = !opt.selected;
        state.select.dispatchEvent(new Event('change', { bubbles: true }));
        updateTrigger(state);
    }

    function openPanel(state) {
        state.panel.style.display = 'block';
        state.search.value = '';
        renderList(state, '');
        state.search.focus();
    }

    function closePanel(state) {
        state.panel.style.display = 'none';
    }

    function attach(selectId, options) {
        options = options || {};
        const select = document.getElementById(selectId);
        if (!select) return;

        const existing = registry[selectId];
        if (existing && !existing.select.isConnected) {
            delete registry[selectId];
        } else if (existing) {
            return;
        }

        select.style.position = 'absolute';
        select.style.opacity = '0';
        select.style.height = '0';
        select.style.width = '0';
        select.style.pointerEvents = 'none';
        select.tabIndex = -1;

        const wrap = document.createElement('div');
        wrap.className = 'msd-wrap';
        wrap.style.position = 'relative';

        const trigger = document.createElement('button');
        trigger.type = 'button';
        trigger.className = select.className || 'form-select';
        trigger.style.textAlign = 'left';

        const panel = document.createElement('div');
        panel.className = 'msd-panel';
        panel.style.display = 'none';

        const search = document.createElement('input');
        search.type = 'text';
        search.className = 'form-control form-control-sm msd-search';
        search.placeholder = 'Type to search\u2026';
        search.autocomplete = 'off';

        const list = document.createElement('div');
        list.className = 'msd-list';

        panel.appendChild(search);
        panel.appendChild(list);

        select.parentNode.insertBefore(wrap, select);
        wrap.appendChild(select);
        wrap.appendChild(trigger);
        wrap.appendChild(panel);

        const state = {
            select: select, wrap: wrap, trigger: trigger, panel: panel, search: search, list: list,
            options: readOptions(select),
            placeholder: options.placeholder || 'Select\u2026',
        };
        registry[selectId] = state;
        updateTrigger(state);

        trigger.addEventListener('click', function (e) {
            e.stopPropagation();
            if (panel.style.display === 'block') closePanel(state);
            else openPanel(state);
        });

        search.addEventListener('input', function () { renderList(state, search.value); });

        list.addEventListener('click', function (e) {
            const item = e.target.closest('.msd-item');
            if (!item) return;
            const checkbox = item.querySelector('input');
            toggleValue(state, checkbox.getAttribute('data-value'));
        });

        document.addEventListener('click', function (e) {
            if (!wrap.contains(e.target)) closePanel(state);
        });

        ensureStylesInjected();
    }

    /** Call after repopulating the underlying select's options (e.g. once an async list loads). */
    function refresh(selectId) {
        const state = registry[selectId];
        if (!state) return;
        state.options = readOptions(state.select);
        updateTrigger(state);
    }

    /** Call after changing .selected on the underlying select's options programmatically (e.g. pre-filling an edit form). */
    function sync(selectId) {
        const state = registry[selectId];
        if (!state) return;
        updateTrigger(state);
    }

    function detach(selectId) {
        const state = registry[selectId];
        if (!state) return;
        state.select.style.position = '';
        state.select.style.opacity = '';
        state.select.style.height = '';
        state.select.style.width = '';
        state.select.style.pointerEvents = '';
        state.select.tabIndex = 0;
        if (state.wrap.parentNode) {
            state.wrap.parentNode.insertBefore(state.select, state.wrap);
            state.wrap.remove();
        }
        delete registry[selectId];
    }

    let stylesInjected = false;
    function ensureStylesInjected() {
        if (stylesInjected) return;
        stylesInjected = true;
        const style = document.createElement('style');
        style.textContent =
            '.msd-wrap .msd-panel{position:absolute;top:calc(100% + 4px);left:0;right:0;min-width:260px;' +
            'background:var(--tblr-bg-surface,#fff);border:1px solid var(--tblr-border-color,#dde1e6);border-radius:6px;' +
            'box-shadow:0 8px 24px rgba(0,0,0,.12);z-index:2000;padding:8px;}' +
            '.msd-wrap button.msd-placeholder{color:var(--tblr-secondary,#6c757d);}' +
            '.msd-search{margin-bottom:6px;}' +
            '.msd-list{max-height:220px;overflow-y:auto;font-size:.875rem;}' +
            '.msd-item{display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:4px;cursor:pointer;margin:0;font-weight:400;}' +
            '.msd-item:hover{background:var(--tblr-primary-lt,#f1f5f9);}' +
            '.msd-item input{margin:0;flex-shrink:0;}' +
            '.msd-empty{padding:8px;color:var(--tblr-secondary,#6c757d);font-size:.875rem;}';
        document.head.appendChild(style);
    }

    return { attach: attach, refresh: refresh, sync: sync, detach: detach };
})();