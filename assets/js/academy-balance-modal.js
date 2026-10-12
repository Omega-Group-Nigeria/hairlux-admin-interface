/**
 * "Record balance payment" modal for Academy deposit registrations, shared by
 * Academy Enrolments (academy-enrolments.html) and Cohorts
 * (academy-cohorts.html). Adds its own modal to the page on first use.
 *
 *   AcademyBalanceModal.open({ id, registrationCode, name, balanceDue }, onDone)
 *
 * Requires: AcademyEnrolments (api-utils/academy-enrolments.js), Bootstrap (tabler.min.js).
 */
const AcademyBalanceModal = (function () {
    let current = null;
    let onDone = null;

    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }
    function ngn(v) {
        return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(Number(v || 0));
    }
    function el(id) { return document.getElementById(id); }

    function ensure() {
        if (el('modal-academy-balance')) return;
        document.body.insertAdjacentHTML('beforeend', `
<div class="modal modal-blur fade" id="modal-academy-balance" tabindex="-1">
  <div class="modal-dialog modal-dialog-centered">
    <div class="modal-content">
      <div class="modal-header">
        <h5 class="modal-title">Record balance payment</h5>
        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
      </div>
      <div class="modal-body">
        <div class="alert alert-danger d-none" id="ab-error"></div>
        <div class="mb-3" id="ab-who"></div>
        <div class="row g-3">
          <div class="col-md-6">
            <label class="form-label" for="ab-method">Paid by</label>
            <select class="form-select" id="ab-method">
              <option value="CASH">Cash</option>
              <option value="BANK_TRANSFER">Bank transfer</option>
              <option value="POS">POS</option>
              <option value="CARD">Card</option>
            </select>
          </div>
          <div class="col-md-6">
            <label class="form-label" for="ab-amount">Amount received</label>
            <div class="input-group">
              <span class="input-group-text">&#8358;</span>
              <input type="number" class="form-control" id="ab-amount" min="1" step="0.01" />
            </div>
            <div class="form-hint" id="ab-amount-hint"></div>
          </div>
          <div class="col-12">
            <label class="form-label" for="ab-note">Receipt number or note (optional)</label>
            <input type="text" class="form-control" id="ab-note" maxlength="300" />
          </div>
        </div>
        <div class="form-hint mt-3">This records money taken at the branch. It is added to Financial Transactions under this branch, and the learner gets a receipt by email.</div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-link link-secondary" data-bs-dismiss="modal">Cancel</button>
        <button class="btn btn-primary" id="ab-save">Record payment</button>
      </div>
    </div>
  </div>
</div>`);
        el('ab-save').addEventListener('click', save);
        el('ab-amount').addEventListener('input', hint);
    }

    function modal() {
        const bs = window.bootstrap || (window.tabler && window.tabler.bootstrap);
        return bs.Modal.getOrCreateInstance(el('modal-academy-balance'));
    }

    function hint() {
        const amount = Number(el('ab-amount').value) || 0;
        const left = Math.max(0, current.balanceDue - amount);
        el('ab-amount-hint').textContent = amount > current.balanceDue
            ? 'More than the balance of ' + ngn(current.balanceDue) + '.'
            : left > 0 ? ngn(left) + ' will still be owed.' : 'Clears the balance.';
    }

    function open(reg, done) {
        ensure();
        current = { id: reg.id, registrationCode: reg.registrationCode, name: reg.name, balanceDue: Number(reg.balanceDue) || 0 };
        onDone = done;
        el('ab-error').classList.add('d-none');
        el('ab-who').innerHTML = '<div class="fw-semibold">' + esc(current.name) + '</div><div class="text-secondary small">' +
            '<span class="font-monospace">' + esc(current.registrationCode) + '</span> &middot; balance ' + ngn(current.balanceDue) + '</div>';
        el('ab-method').value = 'CASH';
        el('ab-amount').value = current.balanceDue;
        el('ab-note').value = '';
        hint();
        modal().show();
    }

    async function save() {
        const err = el('ab-error');
        err.classList.add('d-none');
        const amount = Number(el('ab-amount').value);
        if (!(amount > 0) || amount > current.balanceDue) {
            err.textContent = 'Enter an amount between ' + ngn(1) + ' and ' + ngn(current.balanceDue) + '.';
            err.classList.remove('d-none');
            return;
        }
        const btn = el('ab-save');
        btn.disabled = true;
        try {
            const res = await AcademyEnrolments.recordBalance(current.id, {
                method: el('ab-method').value,
                amount: amount,
                note: el('ab-note').value.trim() || undefined,
            });
            modal().hide();
            if (onDone) onDone(res);
        } catch (e) {
            err.textContent = e.message || 'Could not record the payment.';
            err.classList.remove('d-none');
        } finally {
            btn.disabled = false;
        }
    }

    return { open };
})();
