/**
 * Front-desk QR scanner: open booking verification straight from a scan.
 *
 * The scanner acts like a keyboard: it "types" the code inside the QR (a
 * reservation code such as HLX-A3K9, or HLS-... for salon bookings) and
 * presses Enter, all within a few milliseconds. This listens on the whole
 * page for that burst and hands the code to the page (admin dashboard or
 * staff portal), which opens the right verification screen for whoever is
 * signed in there.
 *
 * Normal typing is left alone: keys typed into a text box, or typed at
 * human speed, are never taken as a scan. On the verify page itself the
 * code box keeps working as before.
 *
 * Usage: ReservationScanner.start(function (code) { ... });
 */
var ReservationScanner = (function () {
    'use strict';

    var CODE = /^HL[XS]-[A-Z0-9]{3,12}$/;
    var MAX_GAP_MS = 60;     // scanners send keys a few ms apart; people type far slower
    var MIN_LENGTH = 7;      // "HLX-ABC" is the shortest code
    var VERIFY_TAB = 'hairlux-verify'; // later scans reuse this tab instead of opening more

    var buffer = '';
    var lastAt = 0;
    var started = false;

    function isEditable(el) {
        if (!el || el === document.body) return false;
        if (el.isContentEditable) return true;
        var tag = (el.tagName || '').toLowerCase();
        if (tag === 'textarea' || tag === 'select') return true;
        if (tag !== 'input') return false;
        var type = (el.type || 'text').toLowerCase();
        return ['text', 'search', 'email', 'number', 'tel', 'url', 'password', 'date', 'time', 'datetime-local'].indexOf(type) !== -1;
    }

    /** A reservation code, or null. */
    function asCode(raw) {
        var code = String(raw || '').trim().toUpperCase();
        return CODE.test(code) ? code : null;
    }

    function start(onScan) {
        if (started || typeof onScan !== 'function') return;
        started = true;
        document.addEventListener('keydown', function (e) {
            if (e.ctrlKey || e.altKey || e.metaKey) { buffer = ''; return; }
            // Typing into a box: that box gets the keys, as always.
            if (isEditable(e.target)) { buffer = ''; return; }
            var now = Date.now();
            if (now - lastAt > MAX_GAP_MS) buffer = '';
            lastAt = now;
            if (e.key === 'Enter') {
                var code = buffer.length >= MIN_LENGTH ? asCode(buffer) : null;
                buffer = '';
                if (code) {
                    e.preventDefault();
                    onScan(code);
                }
                return;
            }
            if (e.key && e.key.length === 1) buffer += e.key;
        }, true);
    }

    /**
     * Open (or reuse) the verification tab. Called from the scan's own key
     * press, so the browser allows it. Returns false if it was blocked.
     */
    function openVerifyTab(url) {
        if (window.name === VERIFY_TAB) { window.location.href = url; return true; }
        var w = window.open(url, VERIFY_TAB);
        if (w) { try { w.focus(); } catch (e) { /* ignore */ } return true; }
        return false;
    }

    /** A short notice at the bottom of the page (no page library needed). */
    function notice(html, ms) {
        var el = document.getElementById('hx-scan-notice');
        if (!el) {
            el = document.createElement('div');
            el.id = 'hx-scan-notice';
            el.setAttribute('role', 'status');
            el.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:3000;max-width:92vw;' +
                'background:#1f1f1f;color:#fff;padding:12px 18px;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.25);font:500 14px/1.4 system-ui,sans-serif';
            document.body.appendChild(el);
        }
        el.innerHTML = html;
        el.style.display = 'block';
        clearTimeout(el._t);
        el._t = setTimeout(function () { el.style.display = 'none'; }, ms || 6000);
    }

    return { start: start, asCode: asCode, openVerifyTab: openVerifyTab, notice: notice, VERIFY_TAB: VERIFY_TAB };
})();
