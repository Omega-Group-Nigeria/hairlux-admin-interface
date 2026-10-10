/**
 * Hairlux: ad booking balance by transfer (check-in screens).
 *
 * An ad landing page booking (book-now.html) paid with a deposit settles the
 * rest only by bank transfer to the customer's own Hairlux account number:
 * the Paystack dedicated account on their wallet, the same number they see
 * on the customer dashboard once they log in. The transfer lands in their
 * wallet and check-in takes the balance from there.
 *
 * This panel shows the account, how much has arrived, and re-checks every
 * 10 seconds (and on "Check again") until the balance is covered. Used by
 * the admin Verify Reservation page, the admin Salon Bookings verify modal
 * and the staff portal.
 *
 * Usage:
 *   BalanceTransfer.isTransferOnly(booking)            // source AD with a balance
 *   var panel = BalanceTransfer.mount(el, function () { return api(code); }, {
 *     onChange: function (covered, data) { confirmBtn.disabled = !covered; },
 *   });
 *   panel.covered();  // last known state
 *   panel.stop();     // stop re-checking (also stops when el leaves the page)
 */
(function () {
  'use strict';

  var POLL_MS = 10000;
  var POLL_LIMIT = 90; // 15 minutes

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function naira(v) {
    return '₦' + (Number(v) || 0).toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }

  function injectStyles() {
    if (document.getElementById('hlx-bt-styles')) return;
    var css =
      '.hlx-bt{border:1px solid rgba(201,168,114,.55);border-radius:10px;padding:14px 16px;margin:12px 0;background:rgba(201,168,114,.08);text-align:left}' +
      '.hlx-bt-title{font-weight:700;margin-bottom:4px}' +
      '.hlx-bt-sub{font-size:13px;opacity:.8;margin-bottom:10px;line-height:1.45}' +
      '.hlx-bt-acct{display:flex;align-items:center;gap:10px;flex-wrap:wrap}' +
      '.hlx-bt-num{font-size:24px;font-weight:700;letter-spacing:2px;font-variant-numeric:tabular-nums}' +
      '.hlx-bt-bank{font-size:13px;opacity:.85;margin-top:2px}' +
      '.hlx-bt-status{margin-top:12px;font-size:14px;line-height:1.5}' +
      '.hlx-bt-ok{color:#2fb344;font-weight:700}' +
      '.hlx-bt-wait{color:#d97706;font-weight:600}' +
      '.hlx-bt-err{color:#d63939}' +
      '.hlx-bt-actions{margin-top:10px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-size:12px;opacity:.9}' +
      '.hlx-bt button{cursor:pointer;border:1px solid rgba(127,127,127,.45);background:transparent;color:inherit;border-radius:6px;padding:5px 10px;font-size:13px}' +
      '.hlx-bt button:disabled{opacity:.5;cursor:default}';
    var el = document.createElement('style');
    el.id = 'hlx-bt-styles';
    el.textContent = css;
    document.head.appendChild(el);
  }

  function isTransferOnly(booking) {
    if (!booking || booking.source !== 'AD' || booking.reservationUsed) return false;
    return Number(booking.balanceDue) > 0;
  }

  function mount(el, fetcher, opts) {
    opts = opts || {};
    injectStyles();
    var state = { data: null, error: null, loading: false, polls: 0, timer: null, stopped: false, covered: false };

    function render() {
      var d = state.data;
      var html = '<div class="hlx-bt">';
      html += '<div class="hlx-bt-title">Balance' + (d ? ' of ' + naira(d.balanceDue) : '') + ': bank transfer only</div>';
      html += '<div class="hlx-bt-sub">This is an ad booking. The customer pays the balance by transfer to their own Hairlux account below. ' +
        'Cash, POS and card are not taken for it. The account stays theirs and shows on their dashboard when they log in.</div>';

      if (!d && state.loading) {
        html += '<div class="hlx-bt-status">Getting the customer’s account number…</div>';
      } else if (state.error && !d) {
        html += '<div class="hlx-bt-status hlx-bt-err">' + esc(state.error) + '</div>';
      } else if (d) {
        if (d.account && d.account.accountNumber) {
          html += '<div class="hlx-bt-acct"><span class="hlx-bt-num">' + esc(d.account.accountNumber) + '</span>' +
            '<button type="button" data-bt="copy">Copy</button></div>' +
            '<div class="hlx-bt-bank">' + esc([d.account.bankName, d.account.accountName].filter(Boolean).join(' · ')) + '</div>';
        } else {
          html += '<div class="hlx-bt-status hlx-bt-err">Could not issue the transfer account: ' + esc(d.accountError || 'unknown error') + '</div>';
        }
        if (d.covered) {
          html += '<div class="hlx-bt-status hlx-bt-ok">Transfer received. ' + naira(d.walletBalance) + ' is in the customer’s account, enough for the ' +
            naira(d.balanceDue) + ' balance. You can check in now.</div>';
        } else {
          html += '<div class="hlx-bt-status">Received so far: <strong>' + naira(d.walletBalance) + '</strong>. ' +
            '<span class="hlx-bt-wait">Still to come: ' + naira(d.shortfall) + '</span></div>';
        }
        if (state.error) html += '<div class="hlx-bt-status hlx-bt-err">' + esc(state.error) + '</div>';
      }

      if (!state.covered) {
        html += '<div class="hlx-bt-actions"><button type="button" data-bt="refresh"' + (state.loading ? ' disabled' : '') + '>' +
          (state.loading ? 'Checking…' : 'Check again') + '</button>' +
          (state.stopped ? '<span>Automatic checking stopped. Use Check again.</span>' : '<span>Checks automatically every 10 seconds.</span>') +
          '</div>';
      }
      html += '</div>';
      el.innerHTML = html;
    }

    function schedule() {
      clearTimeout(state.timer);
      if (state.covered || state.stopped) return;
      if (state.polls >= POLL_LIMIT) { state.stopped = true; render(); return; }
      state.timer = setTimeout(function () {
        // Closed or hidden (modal dismissed): stop until shown and checked again.
        if (!document.body.contains(el) || el.offsetParent === null) { state.stopped = true; return; }
        state.polls++;
        load();
      }, POLL_MS);
    }

    async function load() {
      if (state.loading) return;
      state.loading = true;
      render();
      try {
        var res = await fetcher();
        state.data = res && res.data !== undefined && res.balanceDue === undefined ? res.data : res;
        state.error = null;
      } catch (e) {
        state.error = (e && e.message) || 'Could not check the transfer.';
      }
      state.loading = false;
      var was = state.covered;
      state.covered = !!(state.data && state.data.covered);
      render();
      if (typeof opts.onChange === 'function' && (state.covered !== was || state.polls === 0)) {
        opts.onChange(state.covered, state.data);
      }
      schedule();
    }

    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-bt]');
      if (!b) return;
      var act = b.getAttribute('data-bt');
      if (act === 'refresh') {
        state.stopped = false;
        state.polls = 0;
        load();
      } else if (act === 'copy' && state.data && state.data.account) {
        var n = state.data.account.accountNumber;
        var done = function () { b.textContent = 'Copied'; setTimeout(function () { b.textContent = 'Copy'; }, 1500); };
        if (navigator.clipboard) navigator.clipboard.writeText(n).then(done, done); else done();
      }
    });

    if (typeof opts.onChange === 'function') opts.onChange(false, null);
    load();

    return {
      covered: function () { return state.covered; },
      refresh: function () { state.polls = 0; state.stopped = false; return load(); },
      stop: function () { state.stopped = true; clearTimeout(state.timer); },
    };
  }

  window.BalanceTransfer = { isTransferOnly: isTransferOnly, mount: mount };
})();
