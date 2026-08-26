/**
 * booking-cancel-modal.js — shared admin cancel booking modal
 * Requires: Bookings, tabler.bootstrap
 */
const BookingCancelModal = (() => {
  let onSuccess = null;
  let pendingId = null;
  let initialized = false;

  const MODAL_HTML =
    '<div class="modal modal-blur fade" id="modal-cancel-booking" tabindex="-1" role="dialog" aria-hidden="true">' +
    '<div class="modal-dialog modal-dialog-centered" role="document">' +
    '<div class="modal-content">' +
    '<div class="modal-header">' +
    '<h5 class="modal-title">Cancel Booking</h5>' +
    '<button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>' +
    "</div>" +
    '<div class="modal-body">' +
    '<div class="alert alert-danger d-none mb-3 py-2 small" id="cancel-booking-error"></div>' +
    '<div class="mb-3">' +
    '<label class="form-label" for="cancel-booking-reason">Reason</label>' +
    '<textarea class="form-control" id="cancel-booking-reason" rows="3" placeholder="Customer requested cancellation"></textarea>' +
    '<div class="form-hint">Optional — stored as the cancel reason.</div>' +
    "</div>" +
    '<div class="form-check">' +
    '<input class="form-check-input" type="checkbox" id="cancel-booking-noshow">' +
    '<label class="form-check-label" for="cancel-booking-noshow">Treat as no-show</label>' +
    '<div class="form-hint">Applies the <strong>NO_SHOW</strong> policy instead of other scenarios.</div>' +
    "</div>" +
    "</div>" +
    '<div class="modal-footer">' +
    '<button type="button" class="btn btn-link link-secondary" data-bs-dismiss="modal">Back</button>' +
    '<button type="button" class="btn btn-danger" id="btn-confirm-cancel-booking">' +
    '<span class="spinner-border spinner-border-sm me-1 d-none" id="spinner-cancel-booking" role="status"></span>' +
    "Cancel Booking" +
    "</button>" +
    "</div>" +
    "</div></div></div>";

  function getBootstrap() {
    return window.tabler && window.tabler.bootstrap;
  }

  function ensureModal() {
    if (!document.getElementById("modal-cancel-booking")) {
      document.body.insertAdjacentHTML("beforeend", MODAL_HTML);
    }
  }

  function setSpinner(active) {
    const spinner = document.getElementById("spinner-cancel-booking");
    const btn = document.getElementById("btn-confirm-cancel-booking");
    if (spinner) spinner.classList.toggle("d-none", !active);
    if (btn) btn.disabled = active;
  }

  async function submit() {
    if (!pendingId) return;
    const errEl = document.getElementById("cancel-booking-error");
    const reasonEl = document.getElementById("cancel-booking-reason");
    const noShowEl = document.getElementById("cancel-booking-noshow");
    if (errEl) {
      errEl.classList.add("d-none");
      errEl.textContent = "";
    }
    setSpinner(true);
    try {
      const result = await Bookings.updateStatus(pendingId, "CANCELLED", {
        reason: (reasonEl && reasonEl.value.trim()) || undefined,
        isNoShow: !!(noShowEl && noShowEl.checked),
      });
      const bootstrap = getBootstrap();
      const modalEl = document.getElementById("modal-cancel-booking");
      if (bootstrap && modalEl) {
        const inst = bootstrap.Modal.getInstance(modalEl);
        if (inst) inst.hide();
      }
      if (onSuccess) onSuccess(pendingId, result);
    } catch (err) {
      if (errEl) {
        errEl.textContent = err.message || "Failed to cancel booking.";
        errEl.classList.remove("d-none");
      }
    } finally {
      setSpinner(false);
    }
  }

  function init(opts = {}) {
    if (initialized) return;
    initialized = true;
    onSuccess = opts.onSuccess || null;
    ensureModal();
    const btn = document.getElementById("btn-confirm-cancel-booking");
    if (btn) btn.addEventListener("click", submit);
  }

  function open(bookingId) {
    if (!bookingId) return;
    init({});
    pendingId = bookingId;
    const reasonEl = document.getElementById("cancel-booking-reason");
    const noShowEl = document.getElementById("cancel-booking-noshow");
    const errEl = document.getElementById("cancel-booking-error");
    if (reasonEl) reasonEl.value = "";
    if (noShowEl) noShowEl.checked = false;
    if (errEl) {
      errEl.classList.add("d-none");
      errEl.textContent = "";
    }
    const bootstrap = getBootstrap();
    const modalEl = document.getElementById("modal-cancel-booking");
    if (bootstrap && modalEl) {
      bootstrap.Modal.getOrCreateInstance(modalEl).show();
    }
  }

  return { init, open };
})();
