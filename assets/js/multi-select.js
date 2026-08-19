/**
 * multi-select.js
 * Turns a native <select multiple> into a type-to-filter multi-select with
 * removable chips, without changing how the page reads its value — the
 * underlying <select> stays the source of truth (selectedOptions update,
 * a real 'change' event fires), so existing code like
 * `document.getElementById('x').selectedOptions` keeps working.
 *
 * Usage:
 *   MultiSelect.attach('my-select-id');           // once, after the element exists
 *   MultiSelect.refresh('my-select-id');          // after repopulating its <option>s
 *   MultiSelect.clear('my-select-id');            // deselect everything
 *   MultiSelect.detach('my-select-id');
 *
 * Deliberately dependency-free (no external library), matching the rest of
 * this codebase's approach.
 */
(function (global) {
'use strict';
const MultiSelect = (function () {
    const registry = {}; // selectId -> { select, wrap, field, chips, input, clearBtn, list, options }

    function readOptions(select) {
        return Array.from(select.options).map(function (opt) {
            return { value: opt.value, label: opt.textContent, disabled: opt.disabled };
        });
    }

    function selectedValues(select) {
        return Array.from(select.selectedOptions).map(function (opt) { return opt.value; }).filter(function (v) { return v !== ''; });
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
        if (state.select.disabled) return;
        renderList(state, state.input.value);
        state.list.style.display = state.list.children.length ? 'block' : 'none';
    }

    function renderList(state, query) {
        const q = (query || '').trim().toLowerCase();
        const values = selectedValues(state.select);
        const matches = state.options.filter(function (o) {
            return o.value !== '' && !o.disabled &&
                values.indexOf(o.value) === -1 &&
                o.label.toLowerCase().indexOf(q) !== -1;
        });

        if (!matches.length) {
            state.list.innerHTML = q
                ? '<div class="ms-empty">No matches for "' + escapeHtml(query) + '"</div>'
                : '<div class="ms-empty">No more cities to add</div>';
            return;
        }
        state.list.innerHTML = matches.map(function (o) {
            return '<div class="ms-item" data-value="' + escapeHtml(o.value) + '">' + escapeHtml(o.label) + '</div>';
        }).join('');
    }

    function renderChips(state) {
        const values = selectedValues(state.select);
        state.input.style.display = 'inline-block';
        if (!values.length) {
            state.chips.innerHTML = '';
            state.input.value = '';
        } else {
            state.chips.innerHTML = values.map(function (v) {
                const opt = state.options.find(function (o) { return o.value === v; });
                const label = opt ? opt.label : v;
                return '<span class="ms-chip">' + escapeHtml(label) +
                    '<button type="button" class="ms-chip-x" data-value="' + escapeHtml(v) + '" aria-label="Remove ' + escapeHtml(label) + '">&times;</button>' +
                    '</span>';
            }).join('');
            state.input.value = '';
        }
        state.clearBtn.style.display = values.length ? 'block' : 'none';
        state.input.placeholder = values.length ? 'Add more\u2026' : 'Search\u2026';
    }

    function notifyChange(state) {
        state.select.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function toggle(state, value) {
        const opt = Array.from(state.select.options).find(function (o) { return o.value === value; });
        if (!opt) return;
        opt.selected = !opt.selected;
        renderChips(state);
        closeList(state);
        notifyChange(state);
        state.input.focus();
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
        // still see a normal <select multiple>.
        select.style.position = 'absolute';
        select.style.opacity = '0';
        select.style.height = '0';
        select.style.width = '0';
        select.style.pointerEvents = 'none';
        select.tabIndex = -1;

        const wrap = document.createElement('div');
        wrap.className = 'ms-wrap';
        wrap.style.position = 'relative';

        const field = document.createElement('div');
        field.className = 'form-control ms-field';
        field.setAttribute('data-ms-field', '');

        const chips = document.createElement('div');
        chips.className = 'ms-chips';

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'ms-input';
        input.placeholder = 'Search\u2026';
        input.autocomplete = 'off';

        const clearBtn = document.createElement('button');
        clearBtn.type = 'button';
        clearBtn.className = 'btn btn-icon btn-sm ms-clear-all';
        clearBtn.title = 'Clear all';
        clearBtn.setAttribute('aria-label', 'Clear all selected');
        clearBtn.style.display = 'none';
        clearBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon"><path d="M18 6l-12 12"/><path d="M6 6l12 12"/></svg>';

        const list = document.createElement('div');
        list.className = 'ms-list';
        list.style.display = 'none';

        select.parentNode.insertBefore(wrap, select);
        wrap.appendChild(select);
        wrap.appendChild(field);
        wrap.appendChild(list);
        field.appendChild(chips);
        field.appendChild(input);
        field.appendChild(clearBtn);

        const state = { select: select, wrap: wrap, field: field, chips: chips, input: input, clearBtn: clearBtn, list: list, options: readOptions(select) };
        registry[selectId] = state;

        input.disabled = select.disabled;
        renderChips(state);
        if (select.disabled) input.placeholder = 'Select a state first\u2026';

        field.addEventListener('mousedown', function (e) {
            if (e.target.closest('.ms-chip-x') || e.target.closest('.ms-clear-all')) return;
            e.preventDefault();
            input.focus();
            openList(state);
        });

        input.addEventListener('focus', function () { openList(state); });
        input.addEventListener('input', function () {
            renderList(state, input.value);
            state.list.style.display = 'block';
        });
        input.addEventListener('blur', function () {
            setTimeout(function () { closeList(state); }, 150);
        });

        list.addEventListener('mousedown', function (e) {
            const item = e.target.closest('.ms-item');
            if (!item) return;
            e.preventDefault();
            toggle(state, item.getAttribute('data-value'));
        });

        chips.addEventListener('mousedown', function (e) {
            const x = e.target.closest('.ms-chip-x');
            if (!x) return;
            e.preventDefault();
            e.stopPropagation();
            toggle(state, x.getAttribute('data-value'));
        });
        chips.addEventListener('click', function (e) {
            const x = e.target.closest('.ms-chip-x');
            if (x) notifyChange(state);
        });

        clearBtn.addEventListener('mousedown', function (e) { e.preventDefault(); e.stopPropagation(); });
        clearBtn.addEventListener('click', function () {
            Array.from(state.select.options).forEach(function (o) { o.selected = false; });
            renderChips(state);
            closeList(state);
            notifyChange(state);
            input.focus();
        });

        ensureStylesInjected();
    }

    /** Call after repopulating the underlying <select>'s options (or toggling disabled). */
    function refresh(selectId) {
        const state = registry[selectId];
        if (!state) return;
        state.options = readOptions(state.select);
        renderChips(state);
        if (state.select.disabled) {
            state.input.disabled = true;
            state.input.placeholder = 'Select a state first\u2026';
            closeList(state);
        } else {
            state.input.disabled = false;
        }
    }

    function clear(selectId) {
        const state = registry[selectId];
        if (!state) return;
        Array.from(state.select.options).forEach(function (o) { o.selected = false; });
        renderChips(state);
        closeList(state);
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
            '.ms-field{display:flex;align-items:center;gap:6px;flex-wrap:wrap;min-height:38px;height:auto;cursor:text;padding:4px 8px;}' +
            '.ms-input{flex:1;min-width:90px;border:0;outline:0;background:transparent;font-size:.875rem;}' +
            '.ms-clear-all{border:0;color:var(--tblr-secondary,#6c757d);' +
            'background:transparent;padding:0;line-height:1;cursor:pointer;flex-shrink:0;}' +
            '.ms-clear-all:hover{color:var(--tblr-danger,#d63939);}' +
            '.ms-chip{display:inline-flex;align-items:center;gap:4px;background:var(--tblr-primary-lt,#f1f5f9);' +
            'color:var(--tblr-primary,#4299e1);border-radius:16px;padding:2px 4px 2px 10px;font-size:.8125rem;}' +
            '.ms-chip-x{display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;' +
            'border:0;border-radius:50%;background:transparent;color:inherit;cursor:pointer;font-size:.8125rem;line-height:1;}' +
            '.ms-chip-x:hover{background:rgba(0,0,0,.12);}' +
            '.ms-list{position:absolute;top:calc(100% + 4px);left:0;right:0;max-height:220px;overflow-y:auto;' +
            'background:var(--tblr-bg-surface,#fff);border:1px solid var(--tblr-border-color,#dde1e6);border-radius:6px;' +
            'box-shadow:0 8px 24px rgba(0,0,0,.12);z-index:2000;font-size:.875rem;}' +
            '.ms-item{padding:8px 12px;cursor:pointer;}' +
            '.ms-item:hover{background:var(--tblr-primary-lt,#f1f5f9);}' +
            '.ms-empty{padding:8px 12px;color:var(--tblr-secondary,#6c757d);}';
        document.head.appendChild(style);
    }

    return { attach: attach, refresh: refresh, clear: clear, detach: detach };
})();

    global.MultiSelect = MultiSelect;
})(window);