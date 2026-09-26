/**
 * rich-text-editor.js -- Hairlux Admin
 *
 * The LMS rich-text editor (Quill 1.3.7, same toolbar: H1-H3, bold/italic/
 * underline, lists, link, clear formatting), reusable on any <textarea>.
 *
 *   RichTextEditor.attach('course-description');            // by id
 *   RichTextEditor.attach(el, { placeholder: '...' });      // by element
 *   RichTextEditor.attachAll('textarea.task-body');         // many at once
 *
 * The textarea stays in the DOM (hidden) and keeps working as the field's
 * source of truth, so existing page code needs no changes:
 *   - reading   el.value         -> the editor's HTML ('' when empty)
 *   - writing   el.value = x     -> loads x into the editor (plain text
 *                                   from before the editor existed is
 *                                   converted to paragraphs)
 *   - form.reset()               -> also clears the editor
 * Needs Quill's CSS + JS on the page before this file.
 */
var RichTextEditor = window.RichTextEditor || (function () {
    var TOOLBAR = [
        [{ header: [1, 2, 3, false] }],
        ['bold', 'italic', 'underline'],
        [{ list: 'ordered' }, { list: 'bullet' }],
        ['link'],
        ['clean'],
    ];
    var nativeValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');

    function esc(s) {
        return String(s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    function isHtml(s) { return /<\/?[a-z][\s\S]*>/i.test(s); }

    /** Plain text (older records) -> paragraphs; HTML passes through. */
    function toHtml(v) {
        v = v == null ? '' : String(v);
        if (!v.trim()) return '';
        if (isHtml(v)) return v;
        return v.split(/\n{2,}/).map(function (p) {
            return '<p>' + esc(p).replace(/\n/g, '<br>') + '</p>';
        }).join('');
    }

    function injectStyles() {
        if (document.getElementById('rte-styles')) return;
        var css =
            '.rte-wrap{margin-bottom:0}' +
            '.rte-wrap .ql-toolbar.ql-snow{border-radius:var(--tblr-border-radius,4px) var(--tblr-border-radius,4px) 0 0;border-color:var(--tblr-border-color,#dadfe5)}' +
            '.rte-wrap .ql-container.ql-snow{border-radius:0 0 var(--tblr-border-radius,4px) var(--tblr-border-radius,4px);border-color:var(--tblr-border-color,#dadfe5);font-family:inherit;font-size:14px}' +
            '.rte-wrap .ql-editor{min-height:var(--rte-min-height,120px);background:var(--tblr-bg-forms,#fff);color:var(--tblr-body-color,inherit)}' +
            '.rte-wrap .ql-editor.ql-blank::before{color:var(--tblr-secondary,#6c7a91);font-style:normal}' +
            '[data-bs-theme="dark"] .rte-wrap .ql-toolbar.ql-snow{background:var(--tblr-bg-surface-secondary,#1f2937)}' +
            '[data-bs-theme="dark"] .rte-wrap .ql-snow .ql-stroke{stroke:#cbd5e1}' +
            '[data-bs-theme="dark"] .rte-wrap .ql-snow .ql-fill{fill:#cbd5e1}' +
            '[data-bs-theme="dark"] .rte-wrap .ql-snow .ql-picker{color:#cbd5e1}' +
            '[data-bs-theme="dark"] .rte-wrap .ql-snow .ql-picker-options{background:var(--tblr-bg-surface,#111827)}';
        var style = document.createElement('style');
        style.id = 'rte-styles';
        style.textContent = css;
        document.head.appendChild(style);
    }

    function attach(target, opts) {
        opts = opts || {};
        var ta = typeof target === 'string' ? document.getElementById(target) : target;
        if (!ta || typeof Quill === 'undefined') return null;
        if (ta._rte) return ta._rte;
        injectStyles();

        var wrap = document.createElement('div');
        wrap.className = 'rte-wrap';
        var rows = Number(ta.getAttribute('rows')) || 3;
        wrap.style.setProperty('--rte-min-height', (opts.minHeight || Math.max(100, rows * 32)) + 'px');
        var holder = document.createElement('div');
        wrap.appendChild(holder);
        ta.parentNode.insertBefore(wrap, ta.nextSibling);
        ta.style.display = 'none';
        ta.removeAttribute('maxlength'); // counts HTML markup, not visible text -- the API enforces its own limit

        var quill = new Quill(holder, {
            theme: 'snow',
            placeholder: opts.placeholder || ta.getAttribute('placeholder') || '',
            modules: { toolbar: TOOLBAR },
        });

        function read() {
            return quill.getText().trim().length ? quill.root.innerHTML.trim() : '';
        }
        function load(v) {
            quill.setContents([]);
            var html = toHtml(v);
            if (html) quill.clipboard.dangerouslyPasteHTML(html);
            nativeValue.set.call(ta, read());
        }

        var initial = nativeValue.get.call(ta);

        Object.defineProperty(ta, 'value', {
            configurable: true,
            get: read,
            set: load,
        });

        quill.on('text-change', function () {
            nativeValue.set.call(ta, read());
            ta.dispatchEvent(new Event('input', { bubbles: true }));
        });

        if (ta.form) {
            ta.form.addEventListener('reset', function () {
                setTimeout(function () { load(ta.defaultValue || ''); }, 0);
            });
        }

        if (initial) load(initial);
        ta._rte = quill;
        return quill;
    }

    function attachAll(selector, opts) {
        return Array.prototype.map.call(document.querySelectorAll(selector), function (el) {
            return attach(el, opts);
        });
    }

    /** HTML -> short plain-text preview (for tables/cards). */
    function toText(html) {
        var d = document.createElement('div');
        d.innerHTML = toHtml(html);
        return (d.textContent || '').replace(/\s+/g, ' ').trim();
    }

    return { attach: attach, attachAll: attachAll, toHtml: toHtml, toText: toText };
})();
window.RichTextEditor = RichTextEditor;
