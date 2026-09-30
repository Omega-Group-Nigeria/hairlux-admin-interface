/**
 * searchable-select.js
 * Turns a native <select> into a type-to-filter combobox, without changing
 * how the rest of the page reads its value — the underlying <select> stays
 * the source of truth (its .value updates, and a real 'change' event fires),
 * so any existing code doing `document.getElementById('x').value` or
 * `.addEventListener('change', ...)` keeps working untouched.
 *
 * Usage:
 *   SearchableSelect.attach('my-select-id');           // once, after the element exists
 *   SearchableSelect.refresh('my-select-id');           // after repopulating its <option>s
 *
 * Deliberately dependency-free (no external library), matching the rest of
 * this codebase's approach.
 */
const SearchableSelect = (function () {
    const registry = {}; // selectId -> { select, wrap, input, list, options: [{value, label}] }

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

    function closeList(state) {
        state.list.style.display = 'none';
    }

    function openList(state) {
       
        renderList(state, '');
        state.list.style.display = state.list.children.length ? 'block' : 'none';
    }

    function renderList(state, query) {
        const q = (query || '').trim().toLowerCase();
        const matches = state.options.filter(function (o) {
            return o.value !== '' && !o.disabled && o.label.toLowerCase().indexOf(q) !== -1;
        });

        if (!matches.length) {
            state.list.innerHTML = q
                ? '<div class="ss-empty">No matches for "' + escapeHtml(query) + '"</div>'
                : '';
            return;
        }

        state.list.innerHTML = matches.map(function (o) {
            return '<div class="ss-item" data-value="' + escapeHtml(o.value) + '">' + escapeHtml(o.label) + '</div>';
        }).join('');
    }

    function selectValue(state, value) {
        state.select.value = value;
        const match = state.options.find(function (o) { return o.value === value; });
        state.input.value = match ? match.label : '';
        state.select.dispatchEvent(new Event('change', { bubbles: true }));
        closeList(state);
    }

    function attach(selectId) {
        const select = document.getElementById(selectId);
        if (!select) return;

        // If a previous attach() wrapped an element that's since been
        // destroyed (e.g. a form rebuilt via innerHTML replacement), the
        // registry entry is stale — clean it up and attach fresh instead of
        // silently no-oping against a detached node.
        const existing = registry[selectId];
        if (existing && !existing.select.isConnected) {
            delete registry[selectId];
        } else if (existing) {
            return;
        }

        // Hide the native select visually but keep it in the DOM/tab order
        // as the real form control — screen readers and existing code both
        // still see a normal <select>.
        select.style.position = 'absolute';
        select.style.opacity = '0';
        select.style.height = '0';
        select.style.width = '0';
        select.style.pointerEvents = 'none';
        select.tabIndex = -1;

        const wrap = document.createElement('div');
        wrap.className = 'ss-wrap';
        wrap.style.position = 'relative';

        const input = document.createElement('input');
        input.type = 'text';
        input.className = select.className || 'form-control';
        input.placeholder = 'Type to search\u2026';
        input.autocomplete = 'off';

        const list = document.createElement('div');
        list.className = 'ss-list';
        list.style.display = 'none';

        select.parentNode.insertBefore(wrap, select);
        wrap.appendChild(select);
        wrap.appendChild(input);
        wrap.appendChild(list);

        const state = { select: select, wrap: wrap, input: input, list: list, options: readOptions(select) };
        registry[selectId] = state;

        // Pre-fill the input if the select already has a selected value (e.g. edit forms).
        const current = state.options.find(function (o) { return o.value === select.value; });
        if (current && current.value !== '') input.value = current.label;

        input.addEventListener('focus', function () { openList(state); });
        input.addEventListener('input', function () { renderList(state, input.value); state.list.style.display = 'block'; });
        input.addEventListener('blur', function () {
            // Delay so a click on a list item registers before the list disappears.
            setTimeout(function () { closeList(state); }, 150);
        });
        list.addEventListener('mousedown', function (e) {
            const item = e.target.closest('.ss-item');
            if (!item) return;
            e.preventDefault();
            selectValue(state, item.getAttribute('data-value'));
        });

        ensureStylesInjected();
    }

    /** Call after repopulating the underlying <select>'s options (e.g. once an async staff list loads). */
    function refresh(selectId) {
        const state = registry[selectId];
        if (!state) return;
        state.options = readOptions(state.select);
        const current = state.options.find(function (o) { return o.value === state.select.value; });
        state.input.value = current && current.value !== '' ? current.label : '';
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
            '.ss-list{position:absolute;top:calc(100% + 4px);left:0;right:0;max-height:220px;overflow-y:auto;' +
            'background:var(--tblr-bg-surface,#fff);border:1px solid var(--tblr-border-color,#dde1e6);border-radius:6px;' +
            'box-shadow:0 8px 24px rgba(0,0,0,.12);z-index:2000;font-size:.875rem;}' +
            '.ss-item{padding:8px 12px;cursor:pointer;}' +
            '.ss-item:hover{background:var(--tblr-primary-lt,#f1f5f9);}' +
            '.ss-empty{padding:8px 12px;color:var(--tblr-secondary,#6c757d);}';
        document.head.appendChild(style);
    }

    return { attach: attach, refresh: refresh, detach: detach };
})();