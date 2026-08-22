/**
 * staff-portal-app.js — wires staff-portal.html screens to real data.
 * Depends on auth.js and api-utils/staff-self.js being loaded first.
 */

let currentStaff = null;
let currentAddressVerification = null;
let currentOnboarding = null;
let currentDocuments = null;
let currentAnnouncements = [];
let currentDirectives = [];
let currentAttendance = [];
let checkedInToday = false;

const ONBOARDING_ITEM_LABELS = {
  GUARANTOR_VERIFICATION: 'Guarantor Verification',
  EMERGENCY_CONTACT: 'Emergency Contact',
  REFERENCE_CHECK: 'Reference Check',
  ADDRESS_VERIFICATION: 'Address Verification',
  PHYSICAL_ADDRESS_VERIFICATION: 'Physical Address Verification',
  PASSPORT_PHOTO: 'Passport Photo',
  POLICY_ACKNOWLEDGMENT: 'Policy Acknowledgment',
};

// -- Bootstrapping --------------------------------------------------------------

async function initStaffPortal() {
  try {
    currentStaff = await StaffSelf.getMe();
    console.log('[staff-portal] currentStaff loaded:', currentStaff);
  } catch (err) {
    console.error('Failed to load staff profile', err);
    return;
  }

  renderStaffChip();
  renderProfileScreen();
  applyModuleVisibility();

  await Promise.allSettled([
    loadOnboarding(),
    loadDocuments(),
    loadAnnouncements(),
    loadDirectives(),
    loadAttendance(),
    loadInventoryDashboard(),
    loadLeaveRequests(),
    loadMyApprovals(),
    loadSalonBookings(),
    loadTodayStylistPerformance(),
    loadSalesData(),
    loadPayrollSection(),
    loadCommission(),
  ]);

  sbWireSearchAndPagination();
  renderDashboard();
  renderOnboardingStatusStrip();
  renderNotifications();
}

function sbWireSearchAndPagination() {
  var searchInput = document.getElementById('sb-search');
  var limitSelect = document.getElementById('sb-limit');
  var prevBtn = document.getElementById('sb-prev-page');
  var nextBtn = document.getElementById('sb-next-page');
  if (!searchInput || searchInput.dataset.wired) return; // avoid double-binding if this ever gets called twice

  searchInput.dataset.wired = '1';
  searchInput.addEventListener('input', function () {
    clearTimeout(sbSearchTimer);
    var val = searchInput.value;
    sbSearchTimer = setTimeout(function () { sbSearch = val; sbPage = 1; loadSalonBookings(); }, 300);
  });
  limitSelect.addEventListener('change', function () { sbLimit = Number(limitSelect.value); sbPage = 1; loadSalonBookings(); });
  prevBtn.addEventListener('click', function () { if (sbPage > 1) { sbPage--; loadSalonBookings(); } });
  nextBtn.addEventListener('click', function () { if (sbPage < sbTotalPages) { sbPage++; loadSalonBookings(); } });
}

/** Today's Stylist Performance — branch-scoped, today only, never historical. */
async function loadTodayStylistPerformance() {
  var container = document.getElementById('sb-performance-container');
  if (!container) return;
  try {
    var rows = await SalonBookingsSelf.getTodayStylistPerformance();
    if (!rows.length) {
      container.innerHTML = '<div class="text-secondary small">No completed services yet today.</div>';
      return;
    }
    container.innerHTML = '<div class="tbl-wrap"><table><thead><tr>' +
      '<th>Stylist</th><th>Completed Services</th><th>Total Generated</th>' +
      '</tr></thead><tbody>' +
      rows.map(function (r) {
        return '<tr>' +
          '<td>' + escapeHtml(r.staffName) + '</td>' +
          '<td>' + r.completedServices + '</td>' +
          '<td style="font-weight:700;color:var(--green)">' + sbFormatMoney(r.totalGenerated) + '</td>' +
          '</tr>';
      }).join('') +
      '</tbody></table></div>';
  } catch (err) {
    container.innerHTML = '<div class="text-danger small">' + escapeHtml(err.message || 'Failed to load.') + '</div>';
  }
}

/**
 * Onboarding screen's step bar + Employee Number / Branch stat tiles --
 * previously 100% static/fake. Wires them to real data now that currentStaff,
 * currentDocuments, and currentOnboarding are all guaranteed loaded.
 */
function renderOnboardingStatusStrip() {
  const codeEl = document.getElementById('onb-staff-code');
  if (codeEl) codeEl.textContent = currentStaff.staffCode || '—';
  const branchEl = document.getElementById('onb-branch');
  if (branchEl) branchEl.textContent = currentStaff.location ? currentStaff.location.name : '—';

  const setStep = (id, done) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.toggle('done', done);
    el.classList.toggle('pend', !done);
    const c = el.querySelector('.step-c');
    if (c && done) c.textContent = '✓';
  };

  // "Account Created" and "Personal Info" have no distinct incomplete state in
  // this system -- if you can see this screen at all, both are already true.
  const documentsDone = !!(currentDocuments && currentDocuments.allAcknowledged);
  const verificationDone = !!(currentOnboarding && currentOnboarding.onboardingComplete);
  setStep('onb-step-personal', true);
  setStep('onb-step-documents', documentsDone);
  setStep('onb-step-verification', verificationDone);
  setStep('onb-step-complete', documentsDone && verificationDone);
}

/**
 * Shows the real approved passport photo if one exists (currentStaff.photoUrl
 * is only ever populated server-side when the PASSPORT_PHOTO onboarding item
 * has been admin-approved -- an uploaded-but-unreviewed photo never appears
 * here). Falls back to initials otherwise. Uses a CSS background-image
 * rather than swapping in an <img> tag, so the existing .av circle
 * shape/size/border defined in CSS is preserved untouched either way.
 */
function renderAvatarInto(el, staff) {
  if (!el) return;
  if (staff && staff.photoUrl) {
    el.textContent = '';
    el.style.backgroundImage = 'url(' + staff.photoUrl + ')';
    el.style.backgroundSize = 'cover';
    el.style.backgroundPosition = 'center';
  } else {
    el.style.backgroundImage = '';
    el.textContent = StaffSelf.initials(staff && staff.name);
  }
}

function renderStaffChip() {
  const roleEl = document.getElementById('staff-chip-role');
  const idEl = document.getElementById('staff-chip-id');
  if (roleEl) roleEl.textContent = currentStaff.currentRole || '';
  if (idEl) idEl.textContent = currentStaff.staffCode || '';

  renderAvatarInto(document.getElementById('staff-chip-avatar'), currentStaff);
  renderAvatarInto(document.getElementById('topbar-avatar'), currentStaff);
  const nameEl = document.getElementById('staff-chip-name');
  if (nameEl) nameEl.textContent = currentStaff.name || 'Staff Member';

  // The greeting lives in the `pages` lookup object (staff-portal.html's
  // inline script), not a dedicated element -- update it there, and refresh
  // the visible header immediately if Dashboard happens to be the active screen.
  const firstName = (currentStaff.name || '').split(' ')[0] || 'there';
  if (typeof pages !== 'undefined' && pages.dashboard) {
    pages.dashboard[0] = 'Good day, ' + firstName + ' \uD83D\uDC4B';
    const h1 = document.getElementById('page-h1');
    if (h1 && document.getElementById('dashboard')?.classList.contains('active')) {
      h1.textContent = pages.dashboard[0];
    }
  } else {
    console.warn('[staff-portal] global `pages` object not found -- greeting cannot be personalized');
  }
}

/**
 * Shows/hides sidebar sections per staff eligibility — Manager (managedBranch
 * set, or the staff-portal:approvals permission), Authorized Access
 * (staff-portal:inventory / staff-portal:bookings permissions from their
 * assigned role), Commission (commissionRate set). Permission strings ride
 * on the same AdminRole system used for admin-portal access, so one role
 * assignment governs both portals consistently.
 */
function applyModuleVisibility() {
  var s = currentStaff || {};
  var perms = s.permissions || [];
  var hasPerm = function (p) { return perms.indexOf(p) !== -1; };

  var isManager = !!s.managedBranch || hasPerm('staff-portal:approvals');
  var hasBookingsAccess = hasPerm('staff-portal:bookings');
  var hasInventoryAccess = hasPerm('staff-portal:inventory');
  var hasSalesAccess = hasPerm('staff-portal:sales');
  var hasCommission = s.commissionRate != null;

  var managerSec = document.getElementById('sb-sec-manager');
  if (managerSec) managerSec.style.display = isManager ? '' : 'none';

  var bookingsNav = document.getElementById('sb-nav-bookings');
  var inventoryNav = document.getElementById('sb-nav-inventory');
  var salesNav = document.getElementById('sb-nav-sales');
  if (bookingsNav) bookingsNav.style.display = hasBookingsAccess ? '' : 'none';
  if (inventoryNav) inventoryNav.style.display = hasInventoryAccess ? '' : 'none';
  if (salesNav) salesNav.style.display = hasSalesAccess ? '' : 'none';

  var authorizedSec = document.getElementById('sb-sec-authorized');
  if (authorizedSec) authorizedSec.style.display = (hasBookingsAccess || hasInventoryAccess || hasSalesAccess) ? '' : 'none';

  var commissionSec = document.getElementById('sb-sec-commission');
  if (commissionSec) commissionSec.style.display = hasCommission ? '' : 'none';
}

// -- Dashboard ----------------------------------------------------------------

function renderDashboard() {
  const screen = document.getElementById('dashboard');
  if (!screen) {
    console.warn('[staff-portal] #dashboard screen not found');
    return;
  }
  const s = currentStaff;

  // Onboarding alert banner
  const alertBanner = screen.querySelector(':scope > div:first-child');
  if (alertBanner) {
    if (!currentOnboarding || currentOnboarding.onboardingComplete) {
      alertBanner.style.display = 'none';
    } else {
      alertBanner.style.display = '';
      const remaining = currentOnboarding.items.filter((i) => !i.isComplete);
      const titleEl = alertBanner.querySelector('div[style*="font-weight:700"]');
      const descEl = alertBanner.querySelector('div[style*="font-size:12px"]');
      if (titleEl) titleEl.textContent = 'Onboarding Incomplete \u2014 ' + remaining.length + ' step' + (remaining.length === 1 ? '' : 's') + ' remaining';
      if (descEl) {
        const labels = remaining.map((i) => ONBOARDING_ITEM_LABELS[i.type] || i.type).join(', ');
        descEl.textContent = 'Please complete: ' + labels + '.';
      }
    }
  } else {
    console.warn('[staff-portal] dashboard onboarding alert banner selector did not match');
  }

  // Stat cards -- Attendance %, Tasks, (Client Rating left as static placeholder
  // per product decision -- no ratings system exists yet), Unread Announcements.
  const statCards = screen.querySelectorAll('.g4 .stat');
  if (statCards.length < 4) {
    console.warn('[staff-portal] dashboard expected 4 stat cards, found', statCards.length);
  }

  if (statCards[0]) {
    const now = new Date();
    const thisMonth = currentAttendance.filter((r) => new Date(r.date).getMonth() === now.getMonth() && new Date(r.date).getFullYear() === now.getFullYear());
    // Note: with only check-in records (no scheduled-shift calendar to compare
    // against), "attendance rate" can only mean "days with a check-in this
    // month" -- there's no concept of an absence to divide against yet.
    setText(statCards[0].querySelector('.stat-val'), thisMonth.length ? thisMonth.length + ' day' + (thisMonth.length === 1 ? '' : 's') : '\u2014');
    setText(statCards[0].querySelector('.stat-lbl'), 'Days Present (Month)');
    const delta = statCards[0].querySelector('.stat-delta');
    if (delta) delta.textContent = thisMonth.length ? '\u2713 Logged' : 'No records yet';
  }

  if (statCards[1]) {
    const openTasks = currentDirectives.filter((d) => d.status !== 'COMPLETED');
    const urgent = currentDirectives.filter((d) => d.status === 'PENDING').length;
    setText(statCards[1].querySelector('.stat-val'), String(openTasks.length));
    const delta = statCards[1].querySelector('.stat-delta');
    if (delta) delta.textContent = urgent > 0 ? urgent + ' urgent' : 'All caught up';
  }

  // statCards[2] (Client Rating) intentionally left untouched -- static
  // placeholder per product decision, no backend for this exists yet.

  if (statCards[3]) {
    const unread = currentAnnouncements.filter((a) => !a.isRead).length;
    setText(statCards[3].querySelector('.stat-val'), String(unread));
    const delta = statCards[3].querySelector('.stat-delta');
    if (delta) delta.textContent = unread > 0 ? 'New' : 'All read';
  }

  // Announcements + directive preview (left column, top of the g2 grid)
  const previewCol = screen.querySelector('.g2 > div:first-child');
  if (previewCol) {
    const topAnnouncement = currentAnnouncements[0];
    const topDirective = currentDirectives.find((d) => d.status === 'PENDING') || currentDirectives[0];

    let previewHtml = '';
    if (topAnnouncement) {
      const fromName = topAnnouncement.createdBy ? [topAnnouncement.createdBy.firstName, topAnnouncement.createdBy.lastName].filter(Boolean).join(' ') : 'Management';
      // topAnnouncement.body is server-sanitized HTML from the admin's rich-text
      // editor (already e.g. "<p>...</p>"), not plain text -- rendered directly,
      // not escaped, and without an extra wrapping <p> since the body supplies
      // its own block-level tags already.
      previewHtml +=
        '<div class="banner"><div class="tag">\uD83D\uDCE2 Management \u2014 ' +
        (topAnnouncement.target === 'ALL' ? 'All Staff' : topAnnouncement.target === 'BRANCH' ? 'Your Branch' : 'You') +
        '</div><h3>' + escapeHtml(topAnnouncement.title) + '</h3><div class="ann-body">' + topAnnouncement.body + '</div>' +
        '<div class="meta">From: ' + escapeHtml(fromName) + ' \u00B7 ' + StaffSelf.timeAgo(topAnnouncement.createdAt) + '</div></div>';
    }
    if (topDirective) {
      const fromName = topDirective.createdBy ? [topDirective.createdBy.firstName, topDirective.createdBy.lastName].filter(Boolean).join(' ') : 'Management';
      previewHtml +=
        '<div class="banner urgent"><div class="tag" style="color:var(--red)">\uD83D\uDEA8 Directive</div>' +
        '<h3 style="font-size:14px">' + escapeHtml(topDirective.title) + '</h3><p>' + escapeHtml(topDirective.body) + '</p>' +
        '<div class="meta" style="color:var(--red)">From: ' + escapeHtml(fromName) + ' \u00B7 ' + StaffSelf.timeAgo(topDirective.createdAt) + '</div></div>';
    }

    const tasksCard = previewCol.querySelector('.card .card-b');
    const tasksBadge = previewCol.querySelector('.card .card-h .badge');
    const openTasks = currentDirectives.filter((d) => d.status !== 'COMPLETED');
    if (tasksBadge) tasksBadge.textContent = openTasks.length + ' pending';
    if (tasksCard) {
      tasksCard.innerHTML = openTasks.length
        ? openTasks.slice(0, 3).map(directiveRow).join('')
        : '<div style="color:var(--muted);font-size:13px;text-align:center;padding:12px">No open tasks \uD83C\uDF89</div>';
    }

    // Replace the two hardcoded banner elements with real data, keep the Tasks card.
    const existingBanners = previewCol.querySelectorAll(':scope > .banner');
    existingBanners.forEach((b) => b.remove());
    const tasksCardWrapper = previewCol.querySelector('.card');
    if (tasksCardWrapper) {
      tasksCardWrapper.insertAdjacentHTML('beforebegin', previewHtml);
    } else {
      console.warn('[staff-portal] dashboard tasks card not found to anchor announcement/directive preview');
    }
  } else {
    console.warn('[staff-portal] dashboard preview column selector did not match');
  }

  // Profile summary card (right column)
  const profileCard = screen.querySelectorAll('.g2 > div:last-child .card')[0];
  if (profileCard) {
    renderAvatarInto(profileCard.querySelector('.av.lg'), s);
    const nameEl = profileCard.querySelector('div[style*="font-size:16px"]');
    const roleEl = profileCard.querySelector('div[style*="color:var(--gold)"]');
    const codeEl = profileCard.querySelector('div[style*="font-family:monospace"]');
    if (nameEl) nameEl.textContent = s.name;
    if (roleEl) roleEl.textContent = s.currentRole || '';
    if (codeEl) codeEl.textContent = s.staffCode || '';

    const activeHistory = (s.histories || [])[0];
    const items = profileCard.querySelectorAll('.info-grid .info-item .val');
    if (items[0]) items[0].textContent = s.location ? s.location.name : '-';
    if (items[1]) items[1].textContent = activeHistory ? formatEmploymentType(activeHistory.employmentType) : '-';
    if (items[2]) items[2].textContent = s.reportingTo ? s.reportingTo.name : 'Not assigned';
    if (items[3]) items[3].textContent = activeHistory ? StaffSelf.formatDate(activeHistory.startDate) : '-';

    // Responsibilities -- hide the whole section if not set (product decision).
    const divider = profileCard.querySelector('.divider');
    const respLabel = divider ? divider.nextElementSibling : null;
    const respList = respLabel ? respLabel.nextElementSibling : null;
    if (divider && respLabel && respList) {
      const hasResponsibilities = !!(s.responsibilities && s.responsibilities.trim());
      divider.style.display = hasResponsibilities ? '' : 'none';
      respLabel.style.display = hasResponsibilities ? '' : 'none';
      respList.style.display = hasResponsibilities ? '' : 'none';
      if (hasResponsibilities) {
        respList.innerHTML = '<li>' + escapeHtml(s.responsibilities).replace(/\n+/g, '</li><li>') + '</li>';
      }
    }
  } else {
    console.warn('[staff-portal] dashboard profile summary card selector did not match');
  }

  // Onboarding progress card (right column, second card)
  const onboardingCard = screen.querySelectorAll('.g2 > div:last-child .card')[1];
  if (onboardingCard && currentOnboarding) {
    const items = currentOnboarding.items;
    const doneCount = items.filter((i) => i.isComplete).length;
    const pct = items.length ? Math.round((doneCount / items.length) * 100) : 0;

    const pctLabel = onboardingCard.querySelector('span[style*="color:var(--gold)"]');
    const countLabel = onboardingCard.querySelector('span[style*="color:var(--muted)"]');
    const barFill = onboardingCard.querySelector('.pbar span');
    if (pctLabel) pctLabel.textContent = pct + '% Complete';
    if (countLabel) countLabel.textContent = doneCount + ' of ' + items.length + ' done';
    if (barFill) barFill.style.width = pct + '%';

    const listContainer = barFill ? barFill.closest('div[style*="margin-bottom:8px"]') : null;
    if (listContainer) {
      const rowsHtml = items
        .map((item) => {
          const label = ONBOARDING_ITEM_LABELS[item.type] || item.type;
          const icon = item.isComplete ? '\u2713' : '\u23F3';
          const color = item.isComplete ? 'var(--green)' : 'var(--amber)';
          const text = item.isComplete ? label : label + ' \u2014 Pending';
          return '<div class="flex gap2 mb2"><span style="color:' + color + ';font-size:13px">' + icon + '</span><span style="font-size:12px">' + escapeHtml(text) + '</span></div>';
        })
        .join('');
      // Remove old static rows (everything after the progress-bar block), then append real ones.
      let sibling = listContainer.nextElementSibling;
      while (sibling) {
        const toRemove = sibling;
        sibling = sibling.nextElementSibling;
        toRemove.remove();
      }
      listContainer.insertAdjacentHTML('afterend', rowsHtml);
    }
  } else if (!onboardingCard) {
    console.warn('[staff-portal] dashboard onboarding progress card selector did not match');
  }
}

/**
 * The top-bar CTA button's LABEL changes per screen (see the `ctas` lookup
 * in staff-portal.html), but its onclick was hardcoded to show('attendance')
 * regardless of which screen was active -- a leftover from the static
 * mockup. This makes its actual behavior match its label.
 */
function handleTopBarCta() {
  const activeScreen = document.querySelector('.screen.active');
  const screenId = activeScreen ? activeScreen.id : '';

  if (screenId === 'dashboard' || screenId === 'attendance') {
    return handleAttendanceToggle();
  }
  if (screenId === 'onboarding') {
    // Nothing actually needs "saving" here -- signing a document or any
    // other onboarding action already persists immediately. Rather than
    // invent a fake save action, this just confirms that to the user.
    alert('Everything here saves automatically as soon as you complete each step \u2014 there\'s nothing left to save.');
    return;
  }
  if (screenId === 'inventory') {
    return showNewInventoryItemForm();
  }
  if (screenId === 'sales') {
    return addSaleLine();
  }
  if (screenId === 'payroll') {
    const payslipsTable = document.getElementById('pr-payslips-tbody');
    if (payslipsTable) payslipsTable.closest('.card').scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }
  console.warn('[staff-portal] No CTA action wired for screen:', screenId);
}

// -- Onboarding self-submission modal --------------------------------------------

const ONBOARDING_FORM_CONFIG = {
  GUARANTOR_VERIFICATION: {
    title: 'Guarantor Information',
    sub: 'Your admin will contact your guarantor to confirm before this is approved.',
    fields: [
      { key: 'name', label: 'Full Name', type: 'text', staffField: 'guarantorName' },
      { key: 'occupation', label: 'Occupation', type: 'text', staffField: 'guarantorOccupation' },
      { key: 'phone', label: 'Phone Number', type: 'tel', staffField: 'guarantorPhone' },
      { key: 'address', label: 'Address', type: 'text', staffField: 'guarantorAddress' },
    ],
    submit: (payload) => StaffSelf.submitGuarantor(payload),
  },
  EMERGENCY_CONTACT: {
    title: 'Emergency Contact',
    sub: 'Someone we can reach if we can\u2019t reach you.',
    fields: [
      { key: 'name', label: 'Full Name', type: 'text', staffField: 'emergencyContactName' },
      { key: 'phone', label: 'Phone Number', type: 'tel', staffField: 'emergencyContactPhone' },
      { key: 'relationship', label: 'Relationship', type: 'text', staffField: 'emergencyContactRelation' },
    ],
    submit: (payload) => StaffSelf.submitEmergencyContact(payload),
  },
  ADDRESS_VERIFICATION: {
    title: 'Residential Address',
    sub: 'Your admin will verify this before approving.',
    fields: [
      { key: 'address', label: 'Full Address', type: 'text', staffField: 'address' },
    ],
    submit: (payload) => StaffSelf.submitAddress(payload),
  },
  REFERENCE_CHECK: {
    title: 'Reference',
    sub: 'A former employer or someone who can vouch for your work.',
    fields: [
      { key: 'name', label: 'Full Name', type: 'text', staffField: 'referenceName' },
      { key: 'phone', label: 'Phone Number', type: 'tel', staffField: 'referencePhone' },
      { key: 'relationship', label: 'How they know you', type: 'text', staffField: 'referenceRelationship' },
    ],
    submit: (payload) => StaffSelf.submitReference(payload),
  },
};

function openOnboardingSubmitModal(type) {
  if (type === 'PASSPORT_PHOTO') return openPassportPhotoModal();

  if (type === 'PHYSICAL_ADDRESS_VERIFICATION' && currentAddressVerification) return openAddressVerificationModal();

  const config = ONBOARDING_FORM_CONFIG[type];
  if (!config) return;

  const fieldsHtml = config.fields
    .map((f) => {
      const existingValue = (currentStaff && currentStaff[f.staffField]) || '';
      return (
        '<div class="oc-field"><label>' + escapeHtml(f.label) + '</label>' +
        '<input type="' + f.type + '" id="oc-field-' + f.key + '" value="' + escapeHtml(existingValue) + '"></div>'
      );
    })
    .join('');

  document.getElementById('onboarding-modal-box').innerHTML =
    '<div class="oc-modal-error" id="oc-modal-error"></div>' +
    '<h3>' + escapeHtml(config.title) + '</h3>' +
    '<div class="oc-modal-sub">' + escapeHtml(config.sub) + '</div>' +
    fieldsHtml +
    '<div class="oc-modal-actions">' +
    '<button class="btn btn-ghost btn-sm" onclick="closeOnboardingModal()">Cancel</button>' +
    '<button class="btn btn-gold btn-sm" id="oc-modal-submit-btn" onclick="submitOnboardingForm(\'' + type + '\')">Submit for Review</button>' +
    '</div>';

  document.getElementById('onboarding-modal-overlay').style.display = 'flex';
}

function openPassportPhotoModal() {
  document.getElementById('onboarding-modal-box').innerHTML =
    '<div class="oc-modal-error" id="oc-modal-error"></div>' +
    '<h3>Passport Photo</h3>' +
    '<div class="oc-modal-sub">JPEG or PNG, max 5MB.</div>' +
    '<div class="oc-field"><label>Photo</label><input type="file" id="oc-field-photo" accept="image/jpeg,image/png"></div>' +
    '<div class="oc-modal-actions">' +
    '<button class="btn btn-ghost btn-sm" onclick="closeOnboardingModal()">Cancel</button>' +
    '<button class="btn btn-gold btn-sm" id="oc-modal-submit-btn" onclick="submitPassportPhotoForm()">Upload</button>' +
    '</div>';

  document.getElementById('onboarding-modal-overlay').style.display = 'flex';
}

function closeOnboardingModal() {
  document.getElementById('onboarding-modal-overlay').style.display = 'none';
}

async function loadTraining() {
  const body = document.getElementById('training-list-body');
  body.innerHTML = '<div style="color:var(--muted);font-size:13px;text-align:center;padding:12px">Loading…</div>';
  try {
    const courses = await StaffSelf.getLmsCourses();
    if (!courses.length) {
      body.innerHTML = '<div style="color:var(--muted);font-size:13px;text-align:center;padding:24px">No training material available for your role right now.</div>';
      return;
    }
    body.innerHTML = courses.map((c) => {
      const badges = (c.videoKey ? '<span class="badge b-blue">Video</span>' : '') +
        (c.pdfKey ? '<span class="badge b-blue">PDF</span>' : '');
      return (
        '<div class="flex aic gap3 mb3" style="padding:12px;border:1px solid var(--line);border-radius:var(--r2);cursor:pointer" onclick="openTrainingViewer(\'' + c.id + '\')">' +
        '<span style="font-size:20px">🎓</span>' +
        '<div style="flex:1"><div style="font-size:14px;font-weight:600">' + escapeHtml(c.title) + '</div>' +
        '<div style="font-size:11px;color:var(--muted);margin-top:2px">' + badges + '</div></div>' +
        '<span style="color:var(--muted)">›</span></div>'
      );
    }).join('');
  } catch (err) {
    body.innerHTML = '<div style="color:var(--red);font-size:13px;text-align:center;padding:12px">' + escapeHtml(err.message || 'Failed to load training material.') + '</div>';
  }
}

async function openTrainingViewer(id) {
  const box = document.getElementById('training-viewer-box');
  box.innerHTML = '<div style="padding:24px;text-align:center;color:var(--muted)">Loading…</div>';
  document.getElementById('training-viewer-overlay').style.display = 'flex';

  try {
    // Fresh, short-lived URLs fetched every time this is opened -- never
    // cached or reused across opens, matching the whole point of keeping
    // them short-lived in the first place.
    const course = await StaffSelf.getLmsCourse(id);

    let mediaHtml = '';
    if (course.videoUrl) {
      // controlsList="nodownload" hides the native download button in
      // Chrome/Edge's video controls; disablePictureInPicture removes one
      // more easy extraction path; the context-menu block deters a casual
      // right-click save. None of this is unbypassable -- it's the same
      // "inconvenient, not impossible" mitigation level already agreed on
      // for this feature.
      mediaHtml += '<video controls controlsList="nodownload noremoteplayback" disablePictureInPicture oncontextmenu="return false" style="width:100%;border-radius:var(--r2);margin-bottom:12px" src="' + course.videoUrl + '"></video>';
    }
    if (course.pdfUrl) {
      // #toolbar=0&navpanes=0 hides the browser's built-in PDF viewer
      // toolbar (including its own download button) in Chrome/Firefox --
      // not honored by every browser, same caveat as above.
      mediaHtml += '<iframe src="' + course.pdfUrl + '#toolbar=0&navpanes=0" style="width:100%;height:60vh;border:1px solid var(--line);border-radius:var(--r2);margin-bottom:12px"></iframe>';
    }

    box.innerHTML =
      '<div class="flex aic gap3 mb3" style="justify-content:space-between">' +
      '<h3 style="margin:0">' + escapeHtml(course.title) + '</h3>' +
      '<button class="btn btn-ghost btn-sm" onclick="closeTrainingViewer()">Close</button>' +
      '</div>' +
      mediaHtml +
      '<div style="font-size:14px;line-height:1.6">' + course.description + '</div>';
  } catch (err) {
    box.innerHTML = '<div style="padding:24px;text-align:center;color:var(--red)">' + escapeHtml(err.message || 'Could not load this course.') + '</div>' +
      '<div style="text-align:center;margin-top:8px"><button class="btn btn-ghost btn-sm" onclick="closeTrainingViewer()">Close</button></div>';
  }
}

function closeTrainingViewer() {
  document.getElementById('training-viewer-overlay').style.display = 'none';
  // Clear content on close rather than just hiding -- the video element
  // would otherwise keep its src (and the short-lived presigned URL
  // inside it) sitting in the DOM after the viewer is dismissed.
  document.getElementById('training-viewer-box').innerHTML = '';
}

function showOnboardingModalError(message) {
  const el = document.getElementById('oc-modal-error');
  if (el) { el.textContent = message; el.style.display = 'block'; }
}

async function submitOnboardingForm(type) {
  const config = ONBOARDING_FORM_CONFIG[type];
  if (!config) return;

  const payload = {};
  for (const f of config.fields) {
    const value = document.getElementById('oc-field-' + f.key).value.trim();
    if (!value) {
      showOnboardingModalError(f.label + ' is required.');
      return;
    }
    payload[f.key] = value;
  }

  const btn = document.getElementById('oc-modal-submit-btn');
  btn.disabled = true;
  const original = btn.textContent;
  btn.textContent = 'Submitting\u2026';
  try {
    await config.submit(payload);
    closeOnboardingModal();
    await loadOnboarding();
    currentStaff = await StaffSelf.getMe(); // refresh so re-opening the form shows what was just saved
    renderDashboard();
  } catch (err) {
    showOnboardingModalError(err.message || 'Could not submit. Please try again.');
  } finally {
    btn.disabled = false;
    btn.textContent = original;
  }
}

async function submitPassportPhotoForm() {
  const fileInput = document.getElementById('oc-field-photo');
  const file = fileInput.files && fileInput.files[0];
  if (!file) { showOnboardingModalError('Choose a photo first.'); return; }
  if (!['image/jpeg', 'image/png'].includes(file.type)) { showOnboardingModalError('Only JPEG or PNG images are accepted.'); return; }
  if (file.size > 5 * 1024 * 1024) { showOnboardingModalError('Image must be 5MB or smaller.'); return; }

  const btn = document.getElementById('oc-modal-submit-btn');
  btn.disabled = true;
  const original = btn.textContent;
  btn.textContent = 'Uploading\u2026';
  try {
    await StaffSelf.uploadPassportPhoto(file);
    closeOnboardingModal();
    await loadOnboarding();
    renderDashboard();
  } catch (err) {
    showOnboardingModalError(err.message || 'Could not upload. Please try again.');
  } finally {
    btn.disabled = false;
    btn.textContent = original;
  }
}

function openAddressVerificationModal() {
  const av = currentAddressVerification;
  document.getElementById('onboarding-modal-box').innerHTML =
    '<div class="oc-modal-error" id="oc-modal-error"></div>' +
    '<h3>Physical Address Verification</h3>' +
    '<div class="oc-modal-sub">QoreID field agents will visit within 24-48 hours to confirm this address. Fill in every field accurately -- an agent physically checks against what you enter here.</div>' +

    '<div class="oc-field"><label>Street</label><input type="text" id="av-street" value="' + escapeHtml((av && av.street) || '') + '"></div>' +
    '<div class="oc-field"><label>City</label><input type="text" id="av-city" value="' + escapeHtml((av && av.city) || '') + '"></div>' +
    '<div class="oc-field"><label>LGA (Local Government Area)</label><input type="text" id="av-lga" value="' + escapeHtml((av && av.lgaName) || '') + '"></div>' +
    '<div class="oc-field"><label>State</label><input type="text" id="av-state" value="' + escapeHtml((av && av.stateName) || '') + '"></div>' +
    '<div class="oc-field"><label>Landmark <span style="color:var(--muted)">(optional)</span></label><input type="text" id="av-landmark" value="' + escapeHtml((av && av.landmark) || '') + '"></div>' +
    '<div class="oc-field"><label>House Number <span style="color:var(--muted)">(optional)</span></label><input type="text" id="av-house-number" value="' + escapeHtml((av && av.houseNumber) || '') + '"></div>' +
    '<div class="oc-field"><label>Description</label><textarea id="av-general-description" rows="2" placeholder="e.g. Green gate, third house on the left after the junction">' + escapeHtml((av && av.generalDescription) || '') + '</textarea></div>' +

    '<div class="oc-field">' +
    '<label>Location</label>' +
    '<div class="flex aic gap3" style="margin-bottom:6px;">' +
    '<button type="button" class="btn btn-ghost btn-sm" onclick="captureAddressVerificationLocation()">\ud83d\udccd Use My Current Location</button>' +
    '<span id="av-location-status" style="font-size:11px;color:var(--muted)"></span>' +
    '</div>' +
    '<div class="flex aic gap3">' +
    '<input type="number" step="any" id="av-latitude" placeholder="Latitude" value="' + ((av && av.latitude) || '') + '" style="flex:1">' +
    '<input type="number" step="any" id="av-longitude" placeholder="Longitude" value="' + ((av && av.longitude) || '') + '" style="flex:1">' +
    '</div>' +
    '<div style="font-size:11px;color:var(--muted);margin-top:4px;">Use the button if you\'re at the address now, or enter coordinates manually.</div>' +
    '</div>' +

    '<div class="oc-field"><label>Building Type</label><select id="av-building-description">' +
    ['Residential', 'Commercial'].map((o) => '<option value="' + o + '"' + (av && av.buildingDescription === o ? ' selected' : '') + '>' + o + '</option>').join('') +
    '</select></div>' +
    '<div class="oc-field"><label>Building Status</label><select id="av-building-status">' +
    ['Completed', 'Painted', 'Completed and Painted'].map((o) => '<option value="' + o + '"' + (av && av.buildingStatus === o ? ' selected' : '') + '>' + o + '</option>').join('') +
    '</select></div>' +
    '<div class="oc-field"><label>Building Structure</label><select id="av-building-type">' +
    ['Multi-story', 'Flats & Apartment', 'Bungalow', 'Office Complex'].map((o) => '<option value="' + o + '"' + (av && av.buildingType === o ? ' selected' : '') + '>' + o + '</option>').join('') +
    '</select></div>' +
    '<div class="oc-field"><label>Building Colour</label><input type="text" id="av-building-colour" placeholder="e.g. Blue" value="' + escapeHtml((av && av.buildingColour) || '') + '"></div>' +
    '<div class="oc-field"><label><input type="checkbox" id="av-has-gate-and-fence"' + (av && av.hasGateAndFence ? ' checked' : '') + '> Property has both a gate and a fence</label></div>' +

    '<div class="oc-field"><label>Photos <span style="color:var(--muted)">(optional, but strengthen the verification)</span></label>' +
    '<div style="font-size:11px;color:var(--muted);margin-bottom:4px;">House photo</div><input type="file" id="av-photo1" accept="image/jpeg,image/png">' +
    '<div style="font-size:11px;color:var(--muted);margin:6px 0 4px;">House number photo</div><input type="file" id="av-photo2" accept="image/jpeg,image/png">' +
    '<div style="font-size:11px;color:var(--muted);margin:6px 0 4px;">Nearest landmark photo</div><input type="file" id="av-photo3" accept="image/jpeg,image/png">' +
    '</div>' +

    '<div class="oc-modal-actions">' +
    '<button class="btn btn-ghost btn-sm" onclick="closeOnboardingModal()">Cancel</button>' +
    '<button class="btn btn-gold btn-sm" id="oc-modal-submit-btn" onclick="submitAddressVerificationForm()">Submit</button>' +
    '</div>';

  document.getElementById('onboarding-modal-overlay').style.display = 'flex';
}

function captureAddressVerificationLocation() {
  const statusEl = document.getElementById('av-location-status');
  if (!navigator.geolocation) {
    statusEl.textContent = 'Geolocation not supported on this device -- enter coordinates manually.';
    return;
  }
  statusEl.textContent = 'Getting your location\u2026';
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      document.getElementById('av-latitude').value = pos.coords.latitude;
      document.getElementById('av-longitude').value = pos.coords.longitude;
      statusEl.textContent = 'Location captured.';
    },
    (err) => {
      statusEl.textContent = 'Could not get your location (' + err.message + ') -- enter coordinates manually.';
    },
    { enableHighAccuracy: true, timeout: 15000 },
  );
}

async function submitAddressVerificationForm() {
  const val = (id) => document.getElementById(id).value.trim();
  const street = val('av-street'), city = val('av-city'), lga = val('av-lga'), state = val('av-state');
  const generalDescription = val('av-general-description');
  const latitude = val('av-latitude'), longitude = val('av-longitude');
  const buildingColour = val('av-building-colour');

  if (!street || !city || !lga || !state) { showOnboardingModalError('Street, City, LGA, and State are all required.'); return; }
  if (!generalDescription) { showOnboardingModalError('Please add a short description to help the field agent locate the address.'); return; }
  if (!latitude || !longitude) { showOnboardingModalError('Location is required -- use the button or enter coordinates manually.'); return; }
  if (!buildingColour) { showOnboardingModalError('Please enter the building colour.'); return; }

  const formData = new FormData();
  formData.append('street', street);
  formData.append('city', city);
  formData.append('lgaName', lga);
  formData.append('stateName', state);
  const landmark = val('av-landmark'); if (landmark) formData.append('landmark', landmark);
  const houseNumber = val('av-house-number'); if (houseNumber) formData.append('houseNumber', houseNumber);
  formData.append('generalDescription', generalDescription);
  formData.append('latitude', latitude);
  formData.append('longitude', longitude);
  formData.append('buildingDescription', document.getElementById('av-building-description').value);
  formData.append('buildingStatus', document.getElementById('av-building-status').value);
  formData.append('buildingType', document.getElementById('av-building-type').value);
  formData.append('buildingColour', buildingColour);
  formData.append('hasGateAndFence', document.getElementById('av-has-gate-and-fence').checked ? 'true' : 'false');

  ['av-photo1', 'av-photo2', 'av-photo3'].forEach((id, i) => {
    const file = document.getElementById(id).files[0];
    if (file) formData.append('photo' + (i + 1), file);
  });

  const btn = document.getElementById('oc-modal-submit-btn');
  btn.disabled = true;
  const original = btn.textContent;
  btn.textContent = 'Submitting\u2026';
  try {
    await StaffSelf.submitAddressVerification(formData);
    closeOnboardingModal();
    await loadOnboarding();
    renderDashboard();
  } catch (err) {
    showOnboardingModalError(err.message || 'Could not submit. Please try again.');
  } finally {
    btn.disabled = false;
    btn.textContent = original;
  }
}

function formatEmploymentType(type) {
  const map = { FULL_TIME: 'Full-Time', PART_TIME: 'Part-Time', CONTRACT: 'Contract', INTERN: 'Intern', TEMPORARY: 'Temporary' };
  return map[type] || type || '-';
}

// -- Profile ----------------------------------------------------------------

function renderProfileScreen() {
  const s = currentStaff;
  const screen = document.getElementById('profile');
  if (!screen) {
    console.warn('[staff-portal] #profile screen not found in DOM');
    return;
  }

  const avEl = screen.querySelector('.av.xl');
  const nameEl = screen.querySelector('.prof-hero-info .name');
  const roleEl = screen.querySelector('.prof-hero-info .role');
  const idEl = screen.querySelector('.prof-hero-info .id');
  if (!avEl || !nameEl || !roleEl || !idEl) {
    console.warn('[staff-portal] profile hero selectors did not all match', { avEl, nameEl, roleEl, idEl });
  }
  setText(nameEl, s.name);
  renderAvatarInto(avEl, s);
  setText(roleEl, (s.currentRole || '') + (s.location ? ' — ' + s.location.name + ' Branch' : ''));
  setText(idEl, [s.staffCode, s.email].filter(Boolean).join(' \u00B7 '));

  const statusBadge = screen.querySelector('.prof-hero > div:last-child .badge');
  if (!statusBadge) console.warn('[staff-portal] profile status badge selector did not match');
  if (statusBadge) {
    statusBadge.textContent = statusLabel(s.employmentStatus);
    statusBadge.className = 'badge ' + statusBadgeClass(s.employmentStatus);
  }

  const infoGrids = screen.querySelectorAll('.info-grid');
  console.log('[staff-portal] profile .info-grid count:', infoGrids.length, '(expect 3)');

  const personalInfo = infoGrids[0];
  if (personalInfo) {
    const items = personalInfo.querySelectorAll('.info-item .val');
    if (items[0]) items[0].textContent = s.dateOfBirth ? StaffSelf.formatDate(s.dateOfBirth) : 'Not on file';
    if (items[1]) items[1].textContent = '-';
    if (items[2]) items[2].textContent = s.phone || 'Not on file';
    if (items[3]) items[3].textContent = 'Verified at application';
    if (items[4]) items[4].textContent = 'Not on file';
  }

  const employmentInfo = screen.querySelectorAll('.info-grid')[1];
  if (employmentInfo) {
    const items = employmentInfo.querySelectorAll('.info-item .val');
    if (items[0]) items[0].textContent = s.currentRole || '-';
    if (items[1]) items[1].textContent = '-';
    if (items[2]) items[2].textContent = s.location ? s.location.name : '-';
    if (items[3]) {
      items[3].innerHTML = '<span class="badge ' + statusBadgeClass(s.employmentStatus) + '">' + statusLabel(s.employmentStatus) + '</span>';
    }
    if (items[4]) {
      items[4].textContent = s.reportingTo
        ? s.reportingTo.name + (s.reportingTo.currentRole ? ' \u2014 ' + s.reportingTo.currentRole : '')
        : 'Not assigned';
    }
  }

  if (s.responsibilities && !screen.querySelector('[data-responsibilities]')) {
    const empBlock = employmentInfo ? employmentInfo.closest('.g2 > div:last-child') : null;
    if (empBlock) {
      const div = document.createElement('div');
      div.setAttribute('data-responsibilities', '1');
      div.style.marginTop = '16px';
      div.innerHTML =
        '<div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px">Responsibilities</div>' +
        '<div style="font-size:13px;color:var(--light)">' + escapeHtml(s.responsibilities) + '</div>';
      empBlock.appendChild(div);
    }
  }

  const emergencyGrid = screen.querySelectorAll('.info-grid')[2];
  if (emergencyGrid) {
    const items = emergencyGrid.querySelectorAll('.info-item .val');
    if (items[0]) items[0].textContent = s.emergencyContactName || 'Not on file';
    if (items[1]) items[1].textContent = s.emergencyContactRelation || 'Not on file';
    if (items[2]) items[2].textContent = s.emergencyContactPhone || 'Not on file';
  }

  // prof-stats row — only Days Active and Verified have real data behind
  // them. Attendance-rate and Client Rating have no backing metric yet
  // (same gap as the Dashboard's Client Rating stat) -- show "No data"
  // honestly rather than a fabricated number.
  const activeHistory = (s.histories || [])[0];
  const daysActiveEl = document.getElementById('prof-days-active');
  if (daysActiveEl) {
    if (activeHistory && activeHistory.startDate) {
      const days = Math.max(0, Math.floor((Date.now() - new Date(activeHistory.startDate).getTime()) / 86400000));
      daysActiveEl.textContent = String(days);
    } else {
      daysActiveEl.textContent = '—';
    }
  }
  const attendanceStatEl = document.getElementById('prof-attendance');
  if (attendanceStatEl) attendanceStatEl.textContent = 'No data';
  const ratingEl = document.getElementById('prof-rating');
  if (ratingEl) ratingEl.textContent = 'No data';
  const verifiedEl = document.getElementById('prof-verified');
  if (verifiedEl) {
    verifiedEl.textContent = (currentOnboarding && currentOnboarding.onboardingComplete) ? '✓' : '—';
  }
  const employedDateEl = document.getElementById('prof-employed-date');
  if (employedDateEl) {
    employedDateEl.textContent = activeHistory && activeHistory.startDate
      ? 'Employed ' + StaffSelf.formatDate(activeHistory.startDate)
      : '—';
  }

  wireIdCardButton();
}

function wireIdCardButton() {
  let btn = document.getElementById('download-id-card-btn');
  if (!btn) {
    const editBtn = document.querySelector('#profile .prof-hero button');
    if (editBtn) {
      btn = document.createElement('button');
      btn.id = 'download-id-card-btn';
      btn.className = 'btn btn-gold btn-sm mt2';
      btn.textContent = 'Download ID Card';
      editBtn.parentElement.insertBefore(btn, editBtn);
    }
  }
  if (btn && !btn.dataset.wired) {
    btn.dataset.wired = '1';
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      const original = btn.textContent;
      btn.textContent = 'Generating\u2026';
      try {
        await StaffSelf.downloadIdCard();
      } catch (err) {
        alert('Could not generate ID card: ' + err.message);
      } finally {
        btn.disabled = false;
        btn.textContent = original;
      }
    });
  }
}

// -- Profile dropdown + self-edit ---------------------------------------------

function toggleProfileDropdown() {
  var menu = document.getElementById('profile-dd-menu');
  if (!menu) return;
  menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
}

function closeProfileDropdown() {
  var menu = document.getElementById('profile-dd-menu');
  if (menu) menu.style.display = 'none';
}

document.addEventListener('click', function (e) {
  var wrap = document.getElementById('profile-dd-wrap');
  if (wrap && !wrap.contains(e.target)) closeProfileDropdown();
});

function closeProfileModal() {
  document.getElementById('profile-modal-overlay').style.display = 'none';
}

function showProfileModalError(message) {
  var el = document.getElementById('pm-modal-error');
  if (el) { el.textContent = message; el.style.display = 'block'; }
}

function openEditProfileModal() {
  document.getElementById('profile-modal-box').innerHTML =
    '<div class="oc-modal-error" id="pm-modal-error"></div>' +
    '<h3>Edit Profile</h3>' +
    '<div class="oc-modal-sub">Update your contact phone number. For other changes (name, email, branch), contact an administrator.</div>' +
    '<div class="oc-field"><label>Phone Number</label><input type="tel" id="pm-field-phone" value="' + escapeHtml(currentStaff.phone || '') + '"></div>' +
    '<div class="oc-modal-actions">' +
    '<button class="btn btn-ghost btn-sm" onclick="closeProfileModal()">Cancel</button>' +
    '<button class="btn btn-gold btn-sm" id="pm-modal-submit-btn" onclick="submitEditProfile()">Save Changes</button>' +
    '</div>';
  document.getElementById('profile-modal-overlay').style.display = 'flex';
}

async function submitEditProfile() {
  var phone = document.getElementById('pm-field-phone').value.trim();
  var btn = document.getElementById('pm-modal-submit-btn');
  btn.disabled = true;
  var original = btn.textContent;
  btn.textContent = 'Saving\u2026';
  try {
    await StaffSelf.updateMyProfile({ phone: phone });
    currentStaff = await StaffSelf.getMe();
    renderProfileScreen();
    renderStaffChip();
    closeProfileModal();
  } catch (err) {
    showProfileModalError(err.message || 'Could not save changes.');
  } finally {
    btn.disabled = false;
    btn.textContent = original;
  }
}

function openChangePasswordModal() {
  document.getElementById('profile-modal-box').innerHTML =
    '<div class="oc-modal-error" id="pm-modal-error"></div>' +
    '<h3>Change Password</h3>' +
    '<div class="oc-modal-sub">Minimum 8 characters, with an uppercase letter, a lowercase letter, and a number.</div>' +
    '<div class="oc-field"><label>Current Password</label><input type="password" id="pm-field-current-password"></div>' +
    '<div class="oc-field"><label>New Password</label><input type="password" id="pm-field-new-password"></div>' +
    '<div class="oc-field"><label>Confirm New Password</label><input type="password" id="pm-field-confirm-password"></div>' +
    '<div class="oc-modal-actions">' +
    '<button class="btn btn-ghost btn-sm" onclick="closeProfileModal()">Cancel</button>' +
    '<button class="btn btn-gold btn-sm" id="pm-modal-submit-btn" onclick="submitChangePassword()">Update Password</button>' +
    '</div>';
  document.getElementById('profile-modal-overlay').style.display = 'flex';
}

async function submitChangePassword() {
  var current = document.getElementById('pm-field-current-password').value;
  var next = document.getElementById('pm-field-new-password').value;
  var confirm = document.getElementById('pm-field-confirm-password').value;

  if (!current || !next) { showProfileModalError('Both current and new password are required.'); return; }
  if (next !== confirm) { showProfileModalError('New password and confirmation do not match.'); return; }

  var btn = document.getElementById('pm-modal-submit-btn');
  btn.disabled = true;
  var original = btn.textContent;
  btn.textContent = 'Updating\u2026';
  try {
    await StaffSelf.changePassword(current, next);
    closeProfileModal();
    alert('Password updated successfully.');
  } catch (err) {
    showProfileModalError(err.message || 'Could not update password.');
  } finally {
    btn.disabled = false;
    btn.textContent = original;
  }
}

// -- Notifications (aggregated from Announcements + Directives + Approvals) ---

function renderNotifications() {
  var container = document.getElementById('notifications-list');
  if (!container) return;

  var items = [];

  (currentAnnouncements || []).forEach(function (a) {
    var fromName = a.createdBy ? [a.createdBy.firstName, a.createdBy.lastName].filter(Boolean).join(' ') : 'Management';
    items.push({
      unread: !a.isRead,
      icon: '\uD83D\uDCE2',
      title: 'Announcement: ' + a.title,
      body: a.body,
      meta: StaffSelf.timeAgo(a.createdAt) + ' \u00B7 From: ' + fromName,
      sortAt: a.createdAt,
      onClick: "show('announcements')",
    });
  });

  (currentDirectives || []).forEach(function (d) {
    var fromName = d.createdBy ? [d.createdBy.firstName, d.createdBy.lastName].filter(Boolean).join(' ') : 'Management';
    var isPending = d.status !== 'COMPLETED';
    items.push({
      unread: isPending,
      icon: isPending ? '\u26A0\uFE0F' : '\u2713',
      title: (isPending ? 'Directive: ' : 'Completed: ') + d.title,
      body: d.body,
      meta: (isPending ? StaffSelf.timeAgo(d.createdAt) : 'Completed ' + StaffSelf.formatDate(d.respondedAt)) + ' \u00B7 From: ' + fromName,
      sortAt: d.respondedAt || d.createdAt,
      onClick: "show('tasks')",
    });
  });

  (currentApprovals || []).forEach(function (item) {
    items.push({
      unread: true,
      icon: '\u23F3',
      title: 'Awaiting your approval: ' + (APPROVAL_TYPE_LABELS[item.requestType] || item.requestType),
      body: item.submittedBy ? ('Submitted by ' + item.submittedBy.name) : '',
      meta: 'Pending action',
      sortAt: item.createdAt || new Date().toISOString(),
      onClick: "show('approvals')",
    });
  });

  items.sort(function (a, b) { return new Date(b.sortAt) - new Date(a.sortAt); });

  var unreadCount = items.filter(function (i) { return i.unread; }).length;
  var badge = document.getElementById('notif-count-badge');
  var bellDot = document.querySelector('.ico-btn .ndot');
  var sidebarBadge = document.querySelector('.sb-item[onclick*="notifications"] .bdg');
  if (badge) {
    badge.style.display = unreadCount > 0 ? '' : 'none';
    badge.textContent = unreadCount + ' new';
  }
  if (bellDot) bellDot.style.display = unreadCount > 0 ? '' : 'none';
  if (sidebarBadge) {
    if (unreadCount === 0) sidebarBadge.remove();
    else sidebarBadge.textContent = String(unreadCount);
  }

  if (!items.length) {
    container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted)">No notifications right now.</div>';
    return;
  }

  container.innerHTML = items.map(function (i) {
    return '<div class="notif' + (i.unread ? ' unread' : '') + '" style="cursor:pointer" onclick="' + i.onClick + '">' +
      '<div class="ndot2' + (i.unread ? '' : ' read') + '"></div>' +
      '<div>' +
      '<div class="n-t">' + i.icon + ' ' + escapeHtml(i.title) + '</div>' +
      '<div class="n-b">' + escapeHtml(i.body || '') + '</div>' +
      '<div class="n-d">' + i.meta + '</div>' +
      '</div></div>';
  }).join('');
}

async function markAllNotificationsRead() {
  var unreadAnnouncements = (currentAnnouncements || []).filter(function (a) { return !a.isRead; });
  if (!unreadAnnouncements.length) return;
  try {
    await Promise.allSettled(unreadAnnouncements.map(function (a) { return StaffSelf.markAnnouncementRead(a.id); }));
    await loadAnnouncements();
    renderNotifications();
  } catch (err) {
    alert('Could not mark all as read: ' + err.message);
  }
}

// -- Onboarding + Verification checklist (Profile) -----------------------------

async function loadOnboarding() {
  try {
    currentOnboarding = await StaffSelf.getOnboarding();
    console.log('[staff-portal] onboarding loaded:', currentOnboarding);
  } catch (err) {
    console.error('Failed to load onboarding', err);
    return;
  }
  currentAddressVerification = await StaffSelf.getAddressVerification().catch(() => null);
  renderOnboardingBadge();
  renderVerificationChecklist();
}

function renderOnboardingBadge() {
  const sidebarBadge = document.querySelector('.sb-item[onclick*="onboarding"] .bdg');
  if (!currentOnboarding) return;
  if (currentOnboarding.onboardingComplete) {
    if (sidebarBadge) sidebarBadge.remove();
  } else if (sidebarBadge) {
    const remaining = currentOnboarding.items.filter((i) => !i.isComplete).length;
    sidebarBadge.textContent = String(remaining);
  }
  applyPayrollGate();
}

/**
 * Payslips & Payroll stays locked until onboarding is fully complete --
 * which, since checkAndCompletePolicyAcknowledgment auto-completes the
 * POLICY_ACKNOWLEDGMENT item only once every active company document has
 * been acknowledged, and every other item requires admin approval to
 * become complete, onboardingComplete === true already means everything
 * has been signed, submitted, and approved. One gate, not three.
 */
function applyPayrollGate() {
  const unlocked = !!(currentOnboarding && currentOnboarding.onboardingComplete);
  ['sb-payroll-item', 'sb-payroll-item-2'].forEach((id) => {
    const item = document.getElementById(id);
    if (item) item.classList.toggle('sb-locked', !unlocked);
  });
}

async function handlePayrollNavClick() {
  // Deliberately re-fetches fresh rather than trusting currentOnboarding
  // as-is -- that variable is only ever populated once, at initial app
  // load, and nothing in this app's navigation re-syncs it automatically.
  // An admin action that changes onboarding-complete status (e.g.
  // requesting address verification) while a staff member's session is
  // already open would otherwise leave this gate checking stale, boot-time
  // data for the rest of the session.
  try {
    currentOnboarding = await StaffSelf.getOnboarding();
  } catch (err) {
    console.error('[staff-portal] failed to refresh onboarding status before payroll gate check', err);
    // Fall through to whatever's already in memory rather than block
    // entirely on a transient network error.
  }

  if (!currentOnboarding || !currentOnboarding.onboardingComplete) {
    alert('Payslips & Payroll unlocks once your onboarding checklist -- including all Documents & Agreements -- is complete and approved. Open "Complete Onboarding" to see what\'s left.');
    renderOnboardingBadge();
    return;
  }
  show('payroll');
}

function renderAddressVerificationRow(label) {
  const av = currentAddressVerification;
  if (av.status === 'VERIFIED') {
    return (
      '<div class="flex aic gap3 mb3" style="padding:10px;background:var(--green2);border-radius:var(--r2)">' +
      '<span style="color:var(--green);font-size:18px">\u2713</span>' +
      '<div style="flex:1"><div style="font-size:13px;font-weight:600">' + escapeHtml(label) + '</div>' +
      '<div style="font-size:11px;color:var(--muted)">Verified ' + StaffSelf.formatDate(av.resultReceivedAt) + '</div></div>' +
      '<span class="badge b-green">Complete</span></div>'
    );
  }
  if (av.status === 'SUBMITTED') {
    return (
      '<div class="flex aic gap3 mb3" style="padding:10px;background:var(--amber2, rgba(184,121,10,.10));border-radius:var(--r2)">' +
      '<span style="color:var(--amber);font-size:18px">\u23F3</span>' +
      '<div style="flex:1"><div style="font-size:13px;font-weight:600">' + escapeHtml(label) + '</div>' +
      '<div style="font-size:11px;color:var(--muted)">Submitted ' + StaffSelf.formatDate(av.submittedAt) + ' \u2014 verification in progress (24-48h)</div></div></div>'
    );
  }
  if (av.status === 'REJECTED' || av.status === 'FAILED') {
    return (
      '<div class="flex aic gap3 mb3" style="padding:10px;background:var(--red2);border-radius:var(--r2)">' +
      '<span style="color:var(--red);font-size:18px">\u2717</span>' +
      '<div style="flex:1"><div style="font-size:13px;font-weight:600">' + escapeHtml(label) + '</div>' +
      '<div style="font-size:11px;color:var(--red)">' + (av.status === 'REJECTED' ? 'Could not be verified' : 'Verification failed') + ' \u2014 contact your admin</div></div>' +
      '<button class="btn btn-gold btn-sm" onclick="openOnboardingSubmitModal(\'PHYSICAL_ADDRESS_VERIFICATION\')">Resubmit</button></div>'
    );
  }
  // REQUESTED -- nothing submitted yet
  return (
    '<div class="flex aic gap3 mb3" style="padding:10px;background:var(--red2);border-radius:var(--r2)">' +
    '<span style="color:var(--red);font-size:18px">\u2717</span>' +
    '<div style="flex:1"><div style="font-size:13px;font-weight:600">' + escapeHtml(label) + '</div>' +
    '<div style="font-size:11px;color:var(--red)">Your admin has requested this -- not yet submitted</div></div>' +
    '<button class="btn btn-gold btn-sm" onclick="openOnboardingSubmitModal(\'PHYSICAL_ADDRESS_VERIFICATION\')">Submit</button></div>'
  );
}

function renderVerificationChecklist() {
  if (!currentOnboarding) return;

  const rows = currentOnboarding.items
    .filter((i) => i.type !== 'POLICY_ACKNOWLEDGMENT')
    .map((item) => {
      const label = ONBOARDING_ITEM_LABELS[item.type] || item.type;

      // PHYSICAL_ADDRESS_VERIFICATION only ever appears in the items list
      // at all once an admin has requested it (see backend upsert in
      // requestVerification) -- the currentAddressVerification check here
      // is mostly redundant with that but kept as a defensive guard.
      if (item.type === 'PHYSICAL_ADDRESS_VERIFICATION' && currentAddressVerification) {
        return renderAddressVerificationRow(label);
      }

      if (item.isComplete) {
        return (
          '<div class="flex aic gap3 mb3" style="padding:10px;background:var(--green2);border-radius:var(--r2)">' +
          '<span style="color:var(--green);font-size:18px">\u2713</span>' +
          '<div style="flex:1"><div style="font-size:13px;font-weight:600">' + escapeHtml(label) + '</div>' +
          '<div style="font-size:11px;color:var(--muted)">Completed ' + StaffSelf.formatDate(item.completedAt) + '</div></div>' +
          '<span class="badge b-green">Complete</span></div>'
        );
      }

      if (item.reviewStatus === 'SUBMITTED') {
        return (
          '<div class="flex aic gap3 mb3" style="padding:10px;background:var(--amber2, rgba(184,121,10,.10));border-radius:var(--r2)">' +
          '<span style="color:var(--amber);font-size:18px">\u23F3</span>' +
          '<div style="flex:1"><div style="font-size:13px;font-weight:600">' + escapeHtml(label) + '</div>' +
          '<div style="font-size:11px;color:var(--muted)">Submitted ' + StaffSelf.formatDate(item.submittedAt) + ' \u2014 awaiting review</div></div>' +
          '<button class="btn btn-ghost btn-sm" onclick="openOnboardingSubmitModal(\'' + item.type + '\')">Edit</button></div>'
        );
      }

      const actionLabel = item.type === 'PASSPORT_PHOTO' ? 'Upload Photo' : 'Submit Info';
      const statusText = item.notes
        ? 'Rejected: ' + escapeHtml(item.notes)
        : 'Not yet submitted';
      return (
        '<div class="flex aic gap3 mb3" style="padding:10px;background:var(--red2);border-radius:var(--r2)">' +
        '<span style="color:var(--red);font-size:18px">\u2717</span>' +
        '<div style="flex:1"><div style="font-size:13px;font-weight:600">' + escapeHtml(label) + '</div>' +
        '<div style="font-size:11px;color:var(--red)">' + statusText + '</div></div>' +
        '<button class="btn btn-gold btn-sm" onclick="openOnboardingSubmitModal(\'' + item.type + '\')">' + actionLabel + '</button></div>'
      );
    })
    .join('');

  const profileContainer = document.querySelector('#profile .card:last-child .card-b');
  if (profileContainer) {
    profileContainer.innerHTML = rows;
  } else {
    console.warn('[staff-portal] profile verification checklist container selector did not match');
  }

  const onboardingContainer = document.getElementById('onboarding-verification-checklist');
  if (onboardingContainer) {
    onboardingContainer.innerHTML = rows;
  } else {
    console.warn('[staff-portal] onboarding-screen verification checklist container not found');
  }
}

// -- Documents / Agreements --

async function loadDocuments() {
  try {
    currentDocuments = await StaffSelf.getDocuments();
    console.log('[staff-portal] documents loaded:', currentDocuments);
  } catch (err) {
    console.error('Failed to load documents', err);
    return;
  }
  renderDocumentList('#agreements .card .card-b', true);
  renderDocumentList('#onboarding .card .card-b', false);
}

function renderDocumentList(containerSelector, isStandalone) {
  const container = document.querySelector(containerSelector);
  if (!container) {
    console.warn('[staff-portal] document list container not found for selector:', containerSelector);
    return;
  }
  if (!currentDocuments) return;

  const docs = currentDocuments.documents;
  const badge = container.parentElement.querySelector('.card-h .badge');
  if (badge) {
    badge.textContent = docs.filter((d) => d.acknowledged).length + ' of ' + docs.length + ' acknowledged';
  }

  const intro = !isStandalone
    ? '<p style="font-size:13px;color:var(--muted);margin-bottom:20px">Read each document carefully. Your electronic acknowledgement creates a legal and timestamped record.</p>'
    : '';

  const items = docs.map((doc) => {
    if (doc.acknowledged) {
      return (
        '<div class="ag-item done"><div class="ag-chk">\u2713</div><div style="flex:1">' +
        '<div class="ag-title">' + escapeHtml(doc.title) + '</div>' +
        '<div class="ag-desc">Acknowledged ' + StaffSelf.formatDate(doc.acknowledgedAt) + '</div></div>' +
        '<a class="btn btn-ghost btn-sm" href="' + escapeHtml(doc.viewUrl) + '" target="_blank" rel="noopener">View PDF</a></div>'
      );
    }
    return (
      '<div class="ag-item cur"><div class="ag-chk" style="color:var(--gold)">\u2192</div><div style="flex:1">' +
      '<div class="ag-title">' + escapeHtml(doc.title) + '</div>' +
      '<div class="ag-desc">Please review and acknowledge before proceeding.</div></div>' +
      '<a class="btn btn-ghost btn-sm" href="' + escapeHtml(doc.viewUrl) + '" target="_blank" rel="noopener">View PDF</a>' +
      '<button class="btn btn-gold btn-sm" onclick="handleAcknowledge(\'' + doc.documentId + '\')">Sign</button></div>'
    );
  });

  const footer =
    !isStandalone && !currentDocuments.allAcknowledged
      ? '<div style="text-align:center;padding:24px;margin-top:8px;background:rgba(255,255,255,.02);border-radius:var(--r2);border:2px dashed var(--border)">' +
      '<div style="font-size:28px;margin-bottom:10px">\uD83D\uDD10</div>' +
      '<div style="font-weight:700;font-size:14px;color:var(--light);margin-bottom:4px">Complete all documents to finalise onboarding</div>' +
      '<div style="font-size:12px;color:var(--muted)">' + docs.filter((d) => !d.acknowledged).length + ' document(s) remaining.</div></div>'
      : '';

  container.innerHTML = intro + items.join('') + footer;
}

async function handleAcknowledge(documentId) {
  if (!confirm('By continuing, you confirm you have read and accept the terms of this document. This is recorded with a timestamp and cannot be undone. Continue?')) {
    return;
  }
  try {
    await StaffSelf.acknowledgeDocument(documentId);
    await loadDocuments();
    await loadOnboarding();
    renderDashboard();
  } catch (err) {
    alert('Could not record acknowledgement: ' + err.message);
  }
}

// -- Announcements --

async function loadAnnouncements() {
  try {
    currentAnnouncements = await StaffSelf.getAnnouncements();
    console.log('[staff-portal] announcements loaded:', currentAnnouncements);
  } catch (err) {
    console.error('Failed to load announcements', err);
    return;
  }
  const announcements = currentAnnouncements;

  const sidebarBadge = document.querySelector('.sb-item[onclick*="announcements"] .bdg');
  const unread = announcements.filter((a) => !a.isRead).length;
  if (sidebarBadge) {
    if (unread === 0) sidebarBadge.remove();
    else sidebarBadge.textContent = String(unread);
  }

  const screen = document.getElementById('announcements');
  if (!screen) return;

  if (announcements.length === 0) {
    screen.innerHTML = '<div class="card"><div class="card-b" style="text-align:center;padding:40px;color:var(--muted)">No announcements yet.</div></div>';
    return;
  }

  screen.innerHTML = announcements
    .map((a) => {
      const targetLabel = a.target === 'ALL' ? 'All Staff' : a.target === 'BRANCH' ? 'Your Branch' : 'Just You';
      const fromName = a.createdBy ? [a.createdBy.firstName, a.createdBy.lastName].filter(Boolean).join(' ') : 'Management';
      // a.body is server-sanitized HTML, not plain text (see note above) --
      // rendered directly, no escaping, no extra wrapping <p>.
      return (
        '<div class="banner" data-announcement-id="' + a.id + '" ' +
        (a.isRead ? '' : 'style="border-color:var(--gold)"') + '>' +
        '<div class="tag">\uD83D\uDCE2 ' + targetLabel + (a.isRead ? '' : ' \u00B7 New') + '</div>' +
        '<h3>' + escapeHtml(a.title) + '</h3>' +
        '<div class="ann-body">' + a.body + '</div>' +
        '<div class="meta">From: ' + escapeHtml(fromName) + ' \u00B7 ' + StaffSelf.timeAgo(a.createdAt) + '</div>' +
        '</div>'
      );
    })
    .join('');

  announcements.filter((a) => !a.isRead).forEach((a) => StaffSelf.markAnnouncementRead(a.id).catch(() => { }));
  renderNotifications();
}


// -- Directives / Tasks --

async function loadDirectives() {
  try {
    currentDirectives = await StaffSelf.getDirectives();
    console.log('[staff-portal] directives loaded:', currentDirectives);
  } catch (err) {
    console.error('Failed to load directives', err);
    return;
  }
  const directives = currentDirectives;

  const pending = directives.filter((d) => d.status !== 'COMPLETED');
  const sidebarBadge = document.querySelector('.sb-item[onclick*="tasks"] .bdg');
  if (sidebarBadge) {
    if (pending.length === 0) sidebarBadge.remove();
    else sidebarBadge.textContent = String(pending.length);
  }

  const screen = document.getElementById('tasks');
  if (!screen) return;

  const listHtml = directives.length
    ? directives.map(directiveRow).join('')
    : '<div style="text-align:center;padding:40px;color:var(--muted)">No tasks assigned right now.</div>';

  screen.innerHTML =
    '<div class="g2 mb4">' +
    '<div class="stat red"><div class="stat-lbl">Pending</div><div class="stat-val">' + directives.filter((d) => d.status === 'PENDING').length + '</div></div>' +
    '<div class="stat amber"><div class="stat-lbl">Acknowledged</div><div class="stat-val">' + directives.filter((d) => d.status === 'ACKNOWLEDGED').length + '</div></div>' +
    '</div>' +
    '<div class="card"><div class="card-h"><h3>Tasks &amp; Directives</h3><span class="badge b-amber">' + pending.length + ' pending</span></div>' +
    '<div class="card-b">' + listHtml + '</div></div>';
  renderNotifications();
}

function directiveIsOverdue(d) {
  return !!(d.dueDate && d.status !== 'COMPLETED' && new Date(d.dueDate) < new Date());
}

function directiveRow(d) {
  const fromName = d.createdBy ? [d.createdBy.firstName, d.createdBy.lastName].filter(Boolean).join(' ') : 'Management';
  const dueLine = d.dueDate
    ? ' \u00B7 <span' + (directiveIsOverdue(d) ? ' style="color:var(--red);font-weight:700"' : '') + '>Due ' + StaffSelf.formatDate(d.dueDate) + (directiveIsOverdue(d) ? ' (overdue)' : '') + '</span>'
    : '';

  if (d.status === 'COMPLETED') {
    return (
      '<div class="task done"><div class="task-chk checked">\u2713</div><div style="flex:1">' +
      '<div class="task-title" style="text-decoration:line-through;opacity:.5">' + escapeHtml(d.title) + '</div>' +
      '<div class="task-due">Completed ' + StaffSelf.formatDate(d.respondedAt) + '</div></div></div>'
    );
  }
  var isUrgent = d.status === 'PENDING' || directiveIsOverdue(d);
  const nextAction = d.status === 'PENDING'
    ? '<button class="btn btn-ghost btn-sm" onclick="handleDirectiveStatus(\'' + d.id + '\',\'ACKNOWLEDGED\')">Acknowledge</button>'
    : '<button class="btn btn-gold btn-sm" onclick="openMarkCompleteModal(\'' + d.id + '\')">Mark Done</button>';
  return (
    '<div class="task' + (isUrgent ? ' urgent' : '') + '"><div class="task-chk">' + (d.status === 'PENDING' ? '!' : '\u2192') + '</div>' +
    '<div style="flex:1"><div class="task-title">' + escapeHtml(d.title) + '</div>' +
    '<div class="task-due">' + escapeHtml(d.body) + ' \u00B7 From ' + escapeHtml(fromName) + dueLine + '</div></div>' +
    nextAction + '</div>'
  );
}

async function handleDirectiveStatus(directiveId, status) {
  try {
    await StaffSelf.updateDirectiveStatus(directiveId, status);
    await loadDirectives();
    renderDashboard();
  } catch (err) {
    alert('Could not update task: ' + err.message);
  }
}

/**
 * "Mark Done" now opens this instead of firing the status update directly
 * — evidence is optional, so Skip goes straight to the same
 * handleDirectiveStatus path as before; attaching a file uploads it first,
 * then marks the task Completed right after.
 */
function openMarkCompleteModal(directiveId) {
  document.getElementById('profile-modal-box').innerHTML =
    '<div class="oc-modal-error" id="mc-modal-error" style="display:none"></div>' +
    '<h3>Mark Task Complete</h3>' +
    '<div class="oc-modal-sub">You can optionally attach a photo as proof of completion.</div>' +
    '<div class="oc-field"><label>Evidence (optional)</label><input type="file" id="mc-field-evidence" accept="image/jpeg,image/png"></div>' +
    '<div class="oc-modal-actions">' +
    '<button class="btn btn-ghost btn-sm" id="mc-skip-btn" onclick="submitMarkComplete(\'' + directiveId + '\', true)">Skip &amp; Mark Done</button>' +
    '<button class="btn btn-gold btn-sm" id="mc-modal-submit-btn" onclick="submitMarkComplete(\'' + directiveId + '\', false)">Attach &amp; Mark Done</button>' +
    '</div>';
  document.getElementById('profile-modal-overlay').style.display = 'flex';
}

async function submitMarkComplete(directiveId, skipEvidence) {
  var errEl = document.getElementById('mc-modal-error');
  var fileInput = document.getElementById('mc-field-evidence');
  var file = !skipEvidence && fileInput.files && fileInput.files[0];

  if (!skipEvidence && !file) {
    // Neither button explicitly says "no file chosen" is an error — Skip
    // exists for that. Attach & Mark Done with nothing selected just
    // behaves like Skip rather than blocking the user.
    skipEvidence = true;
  }
  if (file && !['image/jpeg', 'image/png'].includes(file.type)) {
    errEl.textContent = 'Only JPEG or PNG images are accepted.';
    errEl.style.display = 'block';
    return;
  }

  var btn = skipEvidence ? document.getElementById('mc-skip-btn') : document.getElementById('mc-modal-submit-btn');
  var otherBtn = skipEvidence ? document.getElementById('mc-modal-submit-btn') : document.getElementById('mc-skip-btn');
  btn.disabled = true;
  otherBtn.disabled = true;
  var original = btn.textContent;
  btn.textContent = file ? 'Uploading\u2026' : 'Saving\u2026';
  try {
    if (file) {
      await StaffSelf.submitDirectiveEvidence(directiveId, file);
    }
    await StaffSelf.updateDirectiveStatus(directiveId, 'COMPLETED');
    closeProfileModal();
    await loadDirectives();
    renderDashboard();
  } catch (err) {
    errEl.textContent = err.message || 'Could not complete this task.';
    errEl.style.display = 'block';
    btn.disabled = false;
    otherBtn.disabled = false;
    btn.textContent = original;
  }
}

// -- Attendance --

function renderClkDateAndWeek() {
  const dateEl = document.getElementById('clk-date');
  if (dateEl) {
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const branch = currentStaff && currentStaff.location ? currentStaff.location.name : '';
    dateEl.textContent = branch ? (dateStr + ' \u00b7 ' + branch) : dateStr;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const mondayOffset = (today.getDay() + 6) % 7; // getDay(): Sun=0..Sat=6 -> Mon=0..Sun=6
  const monday = new Date(today);
  monday.setDate(today.getDate() - mondayOffset);

  const byDate = {};
  (currentAttendance || []).forEach((r) => {
    if (r.date) byDate[String(r.date).slice(0, 10)] = r;
  });

  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const dot = document.getElementById('wd-' + i);
    if (!dot) continue;

    const dStr = d.toISOString().slice(0, 10);
    const record = byDate[dStr];

    dot.className = 'dot off';
    dot.textContent = '\u2013';

    if (d.getTime() === today.getTime()) {
      if (record && record.status === 'LATE') { dot.className = 'dot late'; dot.textContent = 'L'; }
      else if (record && record.status === 'ABSENT') { dot.className = 'dot absent'; dot.textContent = '\u2715'; }
      else if (record) { dot.className = 'dot ok'; dot.textContent = '\u2713'; }
      else { dot.className = 'dot today'; dot.textContent = '\u2014'; }
    } else if (d.getTime() > today.getTime()) {
      dot.className = 'dot off';
      dot.textContent = '\u2013';
    } else if (record) {
      if (record.status === 'LATE') { dot.className = 'dot late'; dot.textContent = 'L'; }
      else if (record.status === 'ABSENT') { dot.className = 'dot absent'; dot.textContent = '\u2715'; }
      else if (record.status === 'ON_LEAVE' || record.status === 'APPROVED_PERMISSION' || record.status === 'PUBLIC_HOLIDAY') {
        dot.className = 'dot off'; dot.textContent = '\u2013';
      } else {
        dot.className = 'dot ok'; dot.textContent = '\u2713';
      }
    }
    // Past day with no record at all: left as neutral 'off' — could be a
    // non-working day or genuinely unrecorded; no way to tell them apart
    // from here, and showing "absent" would risk being wrong.
  }
}

async function loadAttendance() {
  try {
    currentAttendance = await StaffSelf.getAttendance();
    console.log('[staff-portal] attendance loaded:', currentAttendance);
  } catch (err) {
    console.error('Failed to load attendance', err);
    return;
  }
  const history = currentAttendance;

  const todayStr = new Date().toISOString().slice(0, 10);
  const today = history.find((r) => (r.date || '').slice(0, 10) === todayStr);
  checkedInToday = !!(today && !today.checkOutAt);
  renderCheckinButton(today);
  renderClkDateAndWeek();

  const checkInEl = document.querySelectorAll('#attendance .info-item .val')[0];
  const checkOutEl = document.querySelectorAll('#attendance .info-item .val')[1];
  if (checkInEl) checkInEl.textContent = today ? StaffSelf.formatTime(today.checkInAt) : '\u2014 Not checked in';
  if (checkOutEl) checkOutEl.textContent = today && today.checkOutAt ? StaffSelf.formatTime(today.checkOutAt) : '\u2014 Pending';

  const tbody = document.querySelector('#attendance table tbody');
  if (tbody) {
    tbody.innerHTML = history
      .slice(0, 30)
      .map((r) => {
        const day = new Date(r.date).toLocaleDateString('en-GB', { weekday: 'long' });
        const statusBadgeClass = {
          PRESENT: 'b-green',
          LATE: 'b-amber',
          ABSENT: 'b-red',
          ON_LEAVE: 'b-blue',
          APPROVED_PERMISSION: 'b-blue',
          PUBLIC_HOLIDAY: 'b-blue',
        }[r.status] || (r.checkOutAt ? 'b-green' : 'b-amber');
        const statusLabel = r.status ? String(r.status).replace(/_/g, ' ') : (r.checkOutAt ? 'Present' : 'Open');
        const status = '<span class="badge ' + statusBadgeClass + '">' + statusLabel + '</span>';
        let lateDetail = '';
        if (r.status === 'LATE' && r.lateMinutes) {
          lateDetail = r.lateMinutes + ' min late';
          if (r.latePenaltyAmount) lateDetail += ' · ' + sbFormatMoney(r.latePenaltyAmount) + ' penalty';
        } else if (r.status === 'ABSENT' && r.absentFeeAmount) {
          // absentFeeAmount is frozen the moment ABSENT is recorded (same
          // convention as latePenaltyAmount at check-in) — visible here the
          // very next time this screen loads, no need to wait for payroll.
          lateDetail = sbFormatMoney(r.absentFeeAmount) + ' absent fee';
        }
        const hours = r.checkOutAt
          ? (((new Date(r.checkOutAt) - new Date(r.checkInAt)) / 3600000).toFixed(1))
          : '\u2014';
        return (
          '<tr><td>' + StaffSelf.formatDate(r.date, { day: '2-digit', month: 'short' }) + '</td><td>' + day + '</td>' +
          '<td>' + StaffSelf.formatTime(r.checkInAt) + '</td><td>' + (r.checkOutAt ? StaffSelf.formatTime(r.checkOutAt) : '\u2014') + '</td>' +
          '<td>' + hours + '</td><td>' + status + (lateDetail ? '<div class="text-secondary small mt-1">' + escapeHtml(lateDetail) + '</div>' : '') + '</td></tr>'
        );
      })
      .join('');
  }
}

function renderCheckinButton(todayRecord) {
  const btn = document.getElementById('ci-btn');
  const st = document.getElementById('ci-status');
  if (!btn || !st) return;

  if (todayRecord && todayRecord.checkOutAt) {
    btn.classList.remove('active');
    btn.textContent = '\u2713';
    st.textContent = 'Checked out at ' + StaffSelf.formatTime(todayRecord.checkOutAt);
    st.style.color = '';
  } else if (checkedInToday) {
    btn.classList.add('active');
    btn.textContent = '\u2713';
    st.textContent = 'Checked in at ' + StaffSelf.formatTime(todayRecord.checkInAt) + ' \u2014 tap to check out';
    st.style.color = 'var(--green)';
  } else {
    btn.classList.remove('active');
    btn.textContent = '\u23F5';
    st.textContent = 'Tap to Check In';
    st.style.color = '';
  }
}

async function handleAttendanceToggle() {
  const tbBtn = document.getElementById('tb-cta');
  const ciBtn = document.getElementById('ci-btn');
  const tbOriginal = tbBtn ? tbBtn.textContent : '';
  const ciOriginal = ciBtn ? ciBtn.textContent : '';

  if (tbBtn) { tbBtn.disabled = true; tbBtn.textContent = '…'; }
  if (ciBtn) { ciBtn.style.pointerEvents = 'none'; ciBtn.textContent = '…'; }

  try {
    if (checkedInToday) {
      await StaffSelf.checkOut();
    } else {
      await StaffSelf.checkIn();
    }
    await loadAttendance();
    renderDashboard();
    // The topbar CTA's label is otherwise a static lookup by screen (see
    // `ctas`) that has no idea whether the user is checked in -- override it
    // here so it doesn't keep saying "Check In" right after a successful one.
    if (tbBtn) {
      const activeScreen = document.querySelector('.screen.active');
      if (activeScreen && (activeScreen.id === 'dashboard' || activeScreen.id === 'attendance')) {
        tbBtn.textContent = checkedInToday ? '⏵ Check Out' : '⏵ Check In';
      }
    }
  } catch (err) {
    alert(err.message);
    if (tbBtn) tbBtn.textContent = tbOriginal;
    if (ciBtn) ciBtn.textContent = ciOriginal;
  } finally {
    if (tbBtn) tbBtn.disabled = false;
    if (ciBtn) ciBtn.style.pointerEvents = '';
  }
}

// -- Leave & Permission --------------------------------------------------------

const LEAVE_TYPE_LABELS = {
  ANNUAL_LEAVE: 'Annual Leave',
  SICK_LEAVE: 'Sick Leave',
  CASUAL_LEAVE: 'Casual Leave',
  DAY_OFF: 'Day Off',
  PERMISSION_LATE_ARRIVAL: 'Permission — Late Arrival',
  PERMISSION_EARLY_DEPARTURE: 'Permission — Early Departure',
  OVERTIME_REQUEST: 'Overtime Request',
};

const PERMISSION_TYPES = ['PERMISSION_LATE_ARRIVAL', 'PERMISSION_EARLY_DEPARTURE'];

async function loadLeaveRequests() {
  const container = document.getElementById('leave-list-container');
  try {
    const requests = await StaffSelf.getMyLeaveRequests();   // ← was getLeaveRequests, wrong name
    renderLeaveRequests(requests);
  } catch (err) {
    container.innerHTML = '<div class="text-danger small py-3">' + err.message + '</div>';
  }
}

function renderLeaveRequests(requests) {
  const container = document.getElementById('leave-list-container');
  if (!requests || !requests.length) {
    container.innerHTML = '<div class="text-secondary small py-3">No leave requests yet.</div>';
    return;
  }

  const statusColor = { PENDING: 'amber', APPROVED: 'green', REJECTED: 'red' };

  container.innerHTML = '<div class="tbl-wrap"><table><thead><tr>' +
    '<th>Type</th><th>Dates</th><th>Reason</th><th>Status</th>' +
    '</tr></thead><tbody>' +
    requests.map(function (r) {
      var dates = StaffSelf.formatDate(r.startDate) + (r.startDate !== r.endDate ? ' – ' + StaffSelf.formatDate(r.endDate) : '');
      if (PERMISSION_TYPES.includes(r.type) && r.startTime) {
        dates += ' (' + r.startTime + (r.endTime ? '–' + r.endTime : '') + ')';
      }
      return '<tr>' +
        '<td>' + (LEAVE_TYPE_LABELS[r.type] || r.type) + '</td>' +
        '<td>' + dates + '</td>' +
        '<td class="text-secondary small">' + escapeHtml(r.reason) + '</td>' +
        '<td><span class="bdg ' + (statusColor[r.status] || '') + '">' + r.status + '</span>' +
        (r.status === 'REJECTED' && r.rejectionReason ? '<div class="text-secondary small mt-1">' + escapeHtml(r.rejectionReason) + '</div>' : '') +
        '</td>' +
        '</tr>';
    }).join('') +
    '</tbody></table></div>';
}

function showLeaveRequestForm() {
  var formContainer = document.getElementById('leave-form-container');
  formContainer.style.display = 'block';
  formContainer.innerHTML =
    '<div class="row g-2 mb-3">' +
    '<div class="col-12"><label class="form-label small mb-1">Request Type</label>' +
    '<select class="input" id="lr-type" onchange="toggleLeaveTimeFields()">' +
    Object.keys(LEAVE_TYPE_LABELS).map(function (k) { return '<option value="' + k + '">' + LEAVE_TYPE_LABELS[k] + '</option>'; }).join('') +
    '</select></div>' +
    '<div class="col-6"><label class="form-label small mb-1">Start Date</label>' +
    '<input type="date" class="input" id="lr-start-date"></div>' +
    '<div class="col-6"><label class="form-label small mb-1">End Date</label>' +
    '<input type="date" class="input" id="lr-end-date"></div>' +
    '<div class="col-6" id="lr-start-time-wrap" style="display:none">' +
    '<label class="form-label small mb-1">From (time)</label>' +
    '<input type="time" class="input" id="lr-start-time"></div>' +
    '<div class="col-6" id="lr-end-time-wrap" style="display:none">' +
    '<label class="form-label small mb-1">To (time)</label>' +
    '<input type="time" class="input" id="lr-end-time"></div>' +
    '<div class="col-12"><label class="form-label small mb-1">Reason</label>' +
    '<textarea class="input" id="lr-reason" rows="2"></textarea></div>' +
    '</div>' +
    '<div class="flex gap2">' +
    '<button class="btn btn-gold btn-sm" onclick="submitLeaveRequestForm()">Submit Request</button>' +
    '<button class="btn btn-ghost btn-sm" onclick="cancelLeaveRequestForm()">Cancel</button>' +
    '</div>';
}

function toggleLeaveTimeFields() {
  var isPermission = PERMISSION_TYPES.includes(document.getElementById('lr-type').value);
  document.getElementById('lr-start-time-wrap').style.display = isPermission ? 'block' : 'none';
  document.getElementById('lr-end-time-wrap').style.display = isPermission ? 'block' : 'none';
}

function cancelLeaveRequestForm() {
  document.getElementById('leave-form-container').style.display = 'none';
  document.getElementById('leave-form-container').innerHTML = '';
}

async function submitLeaveRequestForm() {
  var type = document.getElementById('lr-type').value;
  var startDate = document.getElementById('lr-start-date').value;
  var endDate = document.getElementById('lr-end-date').value;
  var reason = document.getElementById('lr-reason').value.trim();
  var isPermission = PERMISSION_TYPES.includes(type);
  var startTime = isPermission ? document.getElementById('lr-start-time').value : undefined;
  var endTime = isPermission ? document.getElementById('lr-end-time').value : undefined;

  if (!startDate || !endDate || !reason) {
    alert('Start date, end date, and reason are required.');
    return;
  }
  if (isPermission && (!startTime || !endTime)) {
    alert('Please specify the time window for this permission request.');
    return;
  }

  try {
    await StaffSelf.submitLeaveRequest({
      type: type, startDate: startDate, endDate: endDate,
      startTime: startTime, endTime: endTime, reason: reason,
    });
    cancelLeaveRequestForm();
    await loadLeaveRequests();
  } catch (err) {
    alert(err.message);
  }
}

// -- My Approvals (generic, cross-module queue) --------------------------------

var currentApprovals = [];

var APPROVAL_TYPE_LABELS = {
  LEAVE_REQUEST: 'Leave Request',
  INVENTORY_ADJUSTMENT: 'Stock Adjustment',
  STOCK_TRANSFER: 'Stock Transfer',
};

async function loadMyApprovals() {
  var container = document.getElementById('approvals-list-container');
  try {
    currentApprovals = await StaffSelf.getPendingApprovals();
    renderApprovals();
    updateApprovalsBadge();
    renderNotifications();
  } catch (err) {
    if (container) container.innerHTML = '<div class="text-danger small py-3">' + err.message + '</div>';
  }
}

function updateApprovalsBadge() {
  var badge = document.getElementById('approvals-badge');
  if (!badge) return;
  var count = (currentApprovals || []).length;
  if (count === 0) { badge.style.display = 'none'; return; }
  badge.style.display = '';
  badge.textContent = String(count);
}

function approvalSummary(item) {
  if (item.requestType === 'LEAVE_REQUEST' && item.leaveRequest) {
    var lr = item.leaveRequest;
    return (LEAVE_TYPE_LABELS[lr.type] || lr.type) + ' — ' +
      StaffSelf.formatDate(lr.startDate) + (lr.startDate !== lr.endDate ? ' – ' + StaffSelf.formatDate(lr.endDate) : '') +
      '<div class="text-secondary small">' + escapeHtml(lr.reason) + '</div>';
  }
  if (item.requestType === 'INVENTORY_ADJUSTMENT' && item.stockAdjustmentRequest) {
    var ar = item.stockAdjustmentRequest;
    var delta = ar.quantityDelta > 0 ? '+' + ar.quantityDelta : String(ar.quantityDelta);
    return (ar.item ? escapeHtml(ar.item.name) : 'Item') + ' — ' + delta +
      '<div class="text-secondary small">' + escapeHtml(ar.reason) + '</div>';
  }
  if (item.requestType === 'STOCK_TRANSFER' && item.stockTransfer) {
    var tr = item.stockTransfer;
    var fromName = tr.fromItem ? escapeHtml(tr.fromItem.name) : 'Item';
    var fromBranch = tr.fromItem && tr.fromItem.branch ? escapeHtml(tr.fromItem.branch.name) : '?';
    var toBranch = tr.toBranch ? escapeHtml(tr.toBranch.name) : '?';
    return fromName + ' × ' + tr.quantity +
      '<div class="text-secondary small">' + fromBranch + ' → ' + toBranch + '</div>';
  }
  return '<span class="text-secondary">—</span>';
}

function approvalDomainId(item) {
  if (item.requestType === 'LEAVE_REQUEST') return item.leaveRequest && item.leaveRequest.id;
  if (item.requestType === 'INVENTORY_ADJUSTMENT') return item.stockAdjustmentRequest && item.stockAdjustmentRequest.id;
  if (item.requestType === 'STOCK_TRANSFER') return item.stockTransfer && item.stockTransfer.id;
  return null;
}

function renderApprovals() {
  var container = document.getElementById('approvals-list-container');
  if (!container) return;
  if (!currentApprovals || !currentApprovals.length) {
    container.innerHTML = '<div class="text-secondary small py-3">Nothing awaiting your approval right now.</div>';
    return;
  }

  container.innerHTML = '<div class="tbl-wrap"><table><thead><tr>' +
    '<th>Type</th><th>Submitted By</th><th>Details</th><th>Branch</th><th></th>' +
    '</tr></thead><tbody>' +
    currentApprovals.map(function (item, idx) {
      var submitter = item.submittedBy ? escapeHtml(item.submittedBy.name) : '—';
      var branch = item.branch ? escapeHtml(item.branch.name) : '—';
      return '<tr>' +
        '<td><span class="bdg">' + (APPROVAL_TYPE_LABELS[item.requestType] || item.requestType) + '</span></td>' +
        '<td>' + submitter + '</td>' +
        '<td>' + approvalSummary(item) + '</td>' +
        '<td class="text-secondary small">' + branch + '</td>' +
        '<td class="text-nowrap">' +
        '<button class="btn btn-gold btn-sm me-1" onclick="handleApprovalAction(' + idx + ', \'approve\')">Approve</button>' +
        '<button class="btn btn-ghost btn-sm me-1" onclick="handleApprovalAction(' + idx + ', \'reject\')">Reject</button>' +
        '<button class="btn btn-ghost btn-sm" onclick="handleApprovalAction(' + idx + ', \'reassign\')">Reassign</button>' +
        '</td>' +
        '</tr>';
    }).join('') +
    '</tbody></table></div>';
}

async function handleApprovalAction(idx, action) {
  var item = currentApprovals[idx];
  if (!item) return;
  var domainId = approvalDomainId(item);
  if (!domainId) { alert('Could not resolve the underlying request — try refreshing.'); return; }

  var fns = {
    LEAVE_REQUEST: { approve: StaffSelf.approveLeaveRequest, reject: StaffSelf.rejectLeaveRequest, reassign: StaffSelf.reassignLeaveRequest },
    INVENTORY_ADJUSTMENT: { approve: InventorySelf.approveAdjustment, reject: InventorySelf.rejectAdjustment, reassign: InventorySelf.reassignAdjustment },
    STOCK_TRANSFER: { approve: InventorySelf.approveTransfer, reject: InventorySelf.rejectTransfer, reassign: InventorySelf.reassignTransfer },
  };
  var handlerSet = fns[item.requestType];
  if (!handlerSet) { alert('Unsupported request type: ' + item.requestType); return; }

  try {
    if (action === 'approve') {
      if (!confirm('Approve this request?')) return;
      await handlerSet.approve(domainId);
    } else if (action === 'reject') {
      var reason = prompt('Reason for rejecting this request:');
      if (!reason) return;
      await handlerSet.reject(domainId, reason);
    } else if (action === 'reassign') {
      var toApproverId = prompt('Reassign to — enter the staffId of who should handle this next (find it in Admin → Staff):');
      if (!toApproverId) return;
      var reassignReason = prompt('Reason for reassigning this request:');
      if (!reassignReason) return;
      await handlerSet.reassign(domainId, toApproverId, reassignReason);
    }
    await loadMyApprovals();
  } catch (err) {
    alert(err.message || 'Action failed.');
  }
}

// -- Salon Bookings --------------------------------------------------------
var SB_STATUS_LABELS = {
  SCHEDULED: 'Scheduled', IN_PROGRESS: 'In Progress', COMPLETED: 'Completed',
  CANCELLED: 'Cancelled', NO_SHOW: 'No-Show',
};
var sbServicesCache = null;
var sbStaffCache = null;
var sbSearch = '';
var sbSearchTimer = null;
var sbPage = 1;
var sbLimit = 50;
var sbTotalPages = 1;
var sbEditingBookingId = null;
var sbAddServiceBookingId = null;

function sbFormatMoney(amount) {
  if (amount == null) return '—';
  return '₦' + Number(amount).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

var sbBookingsCache = [];

async function loadSalonBookings() {
  var container = document.getElementById('bookings-list-container');
  try {
    var result = await SalonBookingsSelf.getAll({ search: sbSearch, page: sbPage, limit: sbLimit });
    var bookings = result.data || [];
    sbBookingsCache = bookings;
    var meta = result.meta || {};
    sbTotalPages = meta.totalPages || 1;
    var pageLabel = document.getElementById('sb-page-label');
    if (pageLabel) pageLabel.textContent = 'Page ' + sbPage + ' of ' + sbTotalPages;
    var prevBtn = document.getElementById('sb-prev-page');
    var nextBtn = document.getElementById('sb-next-page');
    if (prevBtn) prevBtn.disabled = sbPage <= 1;
    if (nextBtn) nextBtn.disabled = sbPage >= sbTotalPages;

    if (!bookings.length) {
      container.innerHTML = '<div class="text-secondary small py-3">No bookings found.</div>';
      return;
    }
    container.innerHTML = '<div class="tbl-wrap"><table><thead><tr>' +
      '<th>Booking ID</th><th>Date / Time</th><th>Customer</th><th>Stylist</th><th>Service</th><th>Amount</th><th>Status</th><th></th>' +
      '</tr></thead><tbody>' +
      bookings.map(function (b, idx) {
        var services = (b.services || []).map(function (s) { return escapeHtml(s.service ? s.service.name : ''); }).join(', ');
        return '<tr>' +
          '<td style="font-family:monospace;font-size:12px">' + escapeHtml(b.bookingCode || '—') + '</td>' +
          '<td>' + StaffSelf.formatDate(b.bookingDate) + ' · ' + escapeHtml(b.bookingTime) + '</td>' +
          '<td>' + escapeHtml(b.customerName) + '</td>' +
          '<td>' + escapeHtml(b.assignedStaff ? b.assignedStaff.name : '—') + '</td>' +
          '<td class="text-secondary small">' + (services || '—') + '</td>' +
          '<td>' + sbFormatMoney(b.totalAmount) + '</td>' +
          '<td><span class="bdg">' + (SB_STATUS_LABELS[b.status] || b.status) + '</span></td>' +
          '<td class="text-nowrap">' + sbActionsHtml(b) + '</td>' +
          '</tr>';
      }).join('') +
      '</tbody></table></div>';

    container.querySelectorAll('.btn-sb-start').forEach(function (btn) { btn.addEventListener('click', function () { sbStart(btn.dataset.id); }); });
    container.querySelectorAll('.btn-sb-complete').forEach(function (btn) { btn.addEventListener('click', function () { sbComplete(btn.dataset.id); }); });
    container.querySelectorAll('.btn-sb-cancel').forEach(function (btn) { btn.addEventListener('click', function () { sbCancel(btn.dataset.id); }); });
    container.querySelectorAll('.btn-sb-edit').forEach(function (btn) { btn.addEventListener('click', function () { sbOpenEditOrAddService(btn.dataset.id); }); });
    container.querySelectorAll('.btn-sb-print').forEach(function (btn) { btn.addEventListener('click', function () { sbPrintBooking(btn.dataset.id); }); });
  } catch (err) {
    container.innerHTML = '<div class="text-danger small py-3">' + err.message + '</div>';
  }
}

/**
 * Fixed action set per status, matching the current spec exactly:
 * Scheduled = View/Edit/Start/Cancel/Print, In Progress = View/Edit/Complete/Print,
 * Completed = View/Edit/Print. No-Show isn't part of this spec's action list for
 * any status anymore — dropped here to match, though the backend endpoint
 * stays untouched. Cancel is Scheduled-only now — the previous version let
 * an In Progress booking be cancelled too, which the backend's
 * assertCancellable() no longer permits; this was a real bug, not a style choice.
 * "View" has no dedicated screen here (this list already shows the full
 * row), so it isn't a separate button — Edit doubles as the detail view
 * for a Completed booking (opens Add Service, which shows all the same info).
 */
function sbActionsHtml(b) {
  var edit = '<button class="btn btn-ghost btn-sm me-1 btn-sb-edit" data-id="' + b.id + '">Edit</button>';
  var print = '<button class="btn btn-ghost btn-sm btn-sb-print" data-id="' + b.id + '">Print</button>';
  if (b.status === 'SCHEDULED') {
    return edit +
      '<button class="btn btn-gold btn-sm me-1 btn-sb-start" data-id="' + b.id + '">Start</button>' +
      '<button class="btn btn-ghost btn-sm me-1 btn-sb-cancel" data-id="' + b.id + '">Cancel</button>' +
      print;
  }
  if (b.status === 'IN_PROGRESS') {
    return edit +
      '<button class="btn btn-gold btn-sm me-1 btn-sb-complete" data-id="' + b.id + '">Complete</button>' +
      print;
  }
  return edit + print;
}

async function sbStart(id) {
  try { await SalonBookingsSelf.start(id); await loadSalonBookings(); } catch (err) { alert(err.message); }
}

async function sbComplete(id) {
  if (!confirm('Complete this booking? This deducts inventory used and calculates commission.')) return;
  try { await SalonBookingsSelf.complete(id); await loadSalonBookings(); } catch (err) { alert(err.message); }
}

async function sbCancel(id) {
  var reason = prompt('Reason for cancelling this booking:');
  if (!reason) return;
  try {
    await SalonBookingsSelf.cancel(id, reason);
    await loadSalonBookings();
  } catch (err) {
    // Backend enforces the real rule (assertCancellable — Scheduled only);
    // this just surfaces whatever message it sends back, e.g. when
    // something calls sbCancel for an In Progress booking some other way.
    alert(err.message);
  }
}

async function sbNoShow(id) {
  var reason = prompt('Reason for marking this booking a no-show:');
  if (!reason) return;
  try { await SalonBookingsSelf.noShow(id, reason); await loadSalonBookings(); } catch (err) { alert(err.message); }
}

async function showBookingForm() {
  var formContainer = document.getElementById('booking-form-container');
  formContainer.style.display = 'block';
  formContainer.innerHTML = '<div class="text-center py-3"><div class="spinner-border text-primary" role="status"></div></div>';

  try {
    if (!sbStaffCache) {
      var staffResult = await SalonBookingsSelf.getBranchStaff();
      sbStaffCache = staffResult || [];
    }
    if (!sbServicesCache) {
      var sbBranchId = currentStaff.locationId || (currentStaff.location && currentStaff.location.id) || '';
      var res = await Auth.fetch('/services?status=ACTIVE&bookingType=WALK_IN&branchId=' + encodeURIComponent(sbBranchId));
      var raw = await res.json().catch(function () { return {}; });
      sbServicesCache = Array.isArray(raw) ? raw : (raw.services || raw.data || []);
    }
  } catch (err) {
    formContainer.innerHTML = '<div class="text-danger small">Failed to load form data: ' + err.message + '</div>';
    return;
  }

  var staffOptions = '<option value="">Select stylist…</option>' + sbStaffCache.map(function (s) {
    return '<option value="' + s.id + '">' + escapeHtml(s.name) + '</option>';
  }).join('');

  formContainer.innerHTML =
    '<div class="row g-2 mb-2">' +
    '<div class="col-12"><label class="form-label small mb-1">Look Up Existing Customer <span style="font-weight:400">(optional — search by name or phone)</span></label>' +
    '<div style="position:relative"><input type="text" class="input" id="sb-customer-search" placeholder="Type a name or phone number…" autocomplete="off">' +
    '<div class="ss-list" id="sb-customer-search-results" style="display:none"></div></div></div>' +
    '</div>' +
    '<div class="row g-2 mb-3">' +
    '<div class="col-6"><label class="form-label small mb-1">Customer Name</label>' +
    '<input type="text" class="input" id="sb-customer-name" placeholder="Ngozi Adeyemi"></div>' +
    '<div class="col-6"><label class="form-label small mb-1">Customer Phone (optional)</label>' +
    '<input type="text" class="input" id="sb-customer-phone" placeholder="+2348012345678">' +
    '<div id="sb-phone-match-prompt" class="d-none mt-1" style="font-size:12px;background:rgba(184,121,10,.10);border:1px solid rgba(184,121,10,.3);border-radius:6px;padding:8px 10px;">' +
    '<span id="sb-phone-match-text"></span>' +
    '<div class="mt-1"><button type="button" class="btn btn-gold btn-sm me-1" id="sb-phone-match-yes">Yes, link it</button>' +
    '<button type="button" class="btn btn-ghost btn-sm" id="sb-phone-match-no">No</button></div>' +
    '</div></div>' +
    '<div class="col-6"><label class="form-label small mb-1">Assigned Stylist</label>' +
    '<select class="input" id="sb-staff">' + staffOptions + '</select></div>' +
    '<div class="col-6"></div>' +
    '<div class="col-6"><label class="form-label small mb-1">Date</label>' +
    '<input type="date" class="input" id="sb-date" value="' + new Date().toISOString().slice(0, 10) + '"></div>' +
    '<div class="col-6"><label class="form-label small mb-1">Time</label>' +
    '<input type="time" class="input" id="sb-time" value="' + new Date().toTimeString().slice(0, 5) + '"></div>' +
    '</div>' +
    '<div class="mb-2"><label class="form-label small mb-1">Services</label><div id="sb-service-lines"></div>' +
    '<button type="button" class="btn btn-ghost btn-sm mt-1" onclick="sbAddServiceLine()">+ Add service</button></div>' +
    '<div class="mb-2"><label class="form-label small mb-1">Products Used / Sold (optional)</label><div id="sb-item-lines"></div>' +
    '<button type="button" class="btn btn-ghost btn-sm mt-1" onclick="sbAddItemLine()">+ Add item</button></div>' +
    '<div class="mb-2"><label class="form-label small mb-1">Notes</label><textarea class="input" id="sb-notes" rows="2"></textarea></div>' +
    '<div class="text-end fw-bold small mb-2" id="sb-estimated-total">Estimated total: —</div>' +
    '<div class="flex gap2">' +
    '<button class="btn btn-gold btn-sm" onclick="submitBookingForm()">Create Booking</button>' +
    '<button class="btn btn-ghost btn-sm" onclick="cancelBookingForm()">Cancel</button>' +
    '</div>';

  window._sbInventoryItems = null;
  SearchableSelect.attach('sb-staff');
  sbAddServiceLine();
  sbWireCustomerSearch();
  sbWirePhoneMatchCheck();
}

var _sbCustomerSearchTimer = null;

function sbWireCustomerSearch() {
  var input = document.getElementById('sb-customer-search');
  var results = document.getElementById('sb-customer-search-results');
  if (!input || !results) return;

  input.addEventListener('input', function () {
    clearTimeout(_sbCustomerSearchTimer);
    var q = input.value.trim();
    if (!q) { results.style.display = 'none'; results.innerHTML = ''; return; }
    _sbCustomerSearchTimer = setTimeout(function () { sbRunCustomerSearch(q, results); }, 300);
  });

  input.addEventListener('blur', function () {
    setTimeout(function () { results.style.display = 'none'; }, 150);
  });
  input.addEventListener('focus', function () {
    if (results.innerHTML) results.style.display = 'block';
  });

  results.addEventListener('mousedown', function (e) {
    var item = e.target.closest('.ss-item');
    if (!item) return;
    e.preventDefault();
    document.getElementById('sb-customer-name').value = item.dataset.name || '';
    document.getElementById('sb-customer-phone').value = item.dataset.phone || '';
    input.value = item.dataset.name || '';
    results.style.display = 'none';
  });
}

async function sbRunCustomerSearch(q, resultsEl) {
  try {
    var matches = await SalonBookingsSelf.searchCustomers(q);
    if (!matches.length) {
      resultsEl.innerHTML = '<div class="ss-empty">No matching customers \u2014 just fill in their name and phone below.</div>';
    } else {
      resultsEl.innerHTML = matches.map(function (m) {
        return '<div class="ss-item" data-name="' + escapeHtml(m.name || '') + '" data-phone="' + escapeHtml(m.phone || '') + '">' +
          '<div style="font-weight:600">' + escapeHtml(m.name || 'Unnamed') + '</div>' +
          '<div class="text-secondary small">' + escapeHtml(m.phone || 'No phone on file') + (m.source === 'user' ? ' · Has an app account' : '') + '</div>' +
          '</div>';
      }).join('');
    }
    resultsEl.style.display = 'block';
  } catch (err) {
    resultsEl.innerHTML = '<div class="ss-empty">Search failed</div>';
    resultsEl.style.display = 'block';
  }
}

function cancelBookingForm() {
  document.getElementById('booking-form-container').style.display = 'none';
  document.getElementById('booking-form-container').innerHTML = '';
}

var _sbLinkToVerifiedUser = false;
var _sbPhoneMatchLastChecked = '';

function sbWirePhoneMatchCheck() {
  _sbLinkToVerifiedUser = false;
  _sbPhoneMatchLastChecked = '';
  var phoneInput = document.getElementById('sb-customer-phone');
  var promptEl = document.getElementById('sb-phone-match-prompt');
  if (!phoneInput || !promptEl) return;

  phoneInput.addEventListener('blur', async function () {
    var phone = phoneInput.value.trim();
    if (!phone || phone === _sbPhoneMatchLastChecked) return;
    _sbPhoneMatchLastChecked = phone;
    _sbLinkToVerifiedUser = false;
    promptEl.classList.add('d-none');

    try {
      var result = await SalonBookingsSelf.checkPhoneMatch(phone);
      if (result.hasMatch) {
        document.getElementById('sb-phone-match-text').textContent =
          'This number matches ' + result.accountName + '\u2019s verified account. Link this visit to their account?';
        promptEl.classList.remove('d-none');
      }
    } catch (e) {
      // Non-critical -- booking creation still works without this check succeeding.
    }
  });

  phoneInput.addEventListener('input', function () {
    _sbLinkToVerifiedUser = false;
    _sbPhoneMatchLastChecked = '';
    promptEl.classList.add('d-none');
  });

  document.getElementById('sb-phone-match-yes').addEventListener('click', function () {
    _sbLinkToVerifiedUser = true;
    promptEl.classList.add('d-none');
  });
  document.getElementById('sb-phone-match-no').addEventListener('click', function () {
    _sbLinkToVerifiedUser = false;
    promptEl.classList.add('d-none');
  });
}

/** Routes to the right modal — full Edit for Scheduled/In Progress, the narrower Add Service flow for Completed. */
async function sbOpenEditOrAddService(id) {
  var b = (sbBookingsCache || []).find(function (x) { return x.id === id; }) || await SalonBookingsSelf.getOne(id);
  if (b.status === 'COMPLETED') {
    sbOpenAddServiceModal(b);
  } else {
    sbOpenEditModal(b);
  }
}

function sbEditLine(container, serviceId, quantity) {
  var row = document.createElement('div');
  row.style.display = 'grid';
  row.style.gridTemplateColumns = '1fr 70px 32px';
  row.style.gap = '8px';
  row.style.marginBottom = '6px';
  var options = '<option value="">Select service…</option>' + (sbServicesCache || []).map(function (s) {
    var price = s.effectivePrice != null ? s.effectivePrice : s.walkInPrice;
    return '<option value="' + s.id + '" data-price="' + price + '">' + escapeHtml(s.name) + ' — ' + sbFormatMoney(price) + '</option>';
  }).join('');
  row.innerHTML =
    '<select class="input sb-eb-service-select">' + options + '</select>' +
    '<input type="number" min="1" value="' + (quantity || 1) + '" class="input sb-eb-qty">' +
    '<button type="button" class="btn btn-ghost btn-sm sb-eb-remove-line">&times;</button>';
  container.appendChild(row);
  var sel = row.querySelector('.sb-eb-service-select');
  if (serviceId) sel.value = serviceId;
  row.querySelector('.sb-eb-remove-line').addEventListener('click', function () { row.remove(); });
  return row;
}

async function sbOpenEditModal(b) {
  sbEditingBookingId = b.id;

  if (!sbServicesCache) {
    try {
      var res = await Auth.fetch('/services?status=ACTIVE&bookingType=WALK_IN&branchId=' + encodeURIComponent(currentStaff.locationId || (currentStaff.location && currentStaff.location.id) || ''));
      var raw = await res.json().catch(function () { return {}; });
      sbServicesCache = Array.isArray(raw) ? raw : (raw.services || raw.data || []);
    } catch (err) { sbServicesCache = []; }
  }
  if (!sbStaffCache) {
    try { sbStaffCache = await SalonBookingsSelf.getBranchStaff() || []; } catch (err) { sbStaffCache = []; }
  }

  var staffOptions = '<option value="">Select stylist…</option>' + sbStaffCache.map(function (s) {
    var sel = s.id === b.assignedStaffId ? ' selected' : '';
    return '<option value="' + s.id + '"' + sel + '>' + escapeHtml(s.name) + '</option>';
  }).join('');

  document.getElementById('profile-modal-box').innerHTML =
    '<div class="oc-modal-error" id="sbeb-error" style="display:none"></div>' +
    '<h3>Edit Booking — ' + escapeHtml(b.bookingCode || '') + '</h3>' +
    '<div class="oc-field"><label>Customer Name</label><input type="text" id="sbeb-customer-name" value="' + escapeHtml(b.customerName || '') + '"></div>' +
    '<div class="oc-field"><label>Customer Phone</label><input type="text" id="sbeb-customer-phone" value="' + escapeHtml(b.customerPhone || '') + '"></div>' +
    '<div class="oc-field"><label>Assigned Stylist</label><select id="sbeb-staff">' + staffOptions + '</select></div>' +
    '<div style="display:flex;gap:12px">' +
    '<div class="oc-field" style="flex:1"><label>Date</label><input type="date" id="sbeb-date" value="' + (b.bookingDate || '').slice(0, 10) + '"></div>' +
    '<div class="oc-field" style="flex:1"><label>Time</label><input type="time" id="sbeb-time" value="' + escapeHtml(b.bookingTime || '') + '"></div>' +
    '</div>' +
    '<label class="label">Services</label><div id="sbeb-service-lines"></div>' +
    '<button type="button" class="btn btn-ghost btn-sm mt2" onclick="sbAddEditServiceLine()">+ Add service</button>' +
    '<div class="oc-field mt3"><label>Notes</label><textarea class="input" id="sbeb-notes" rows="2">' + escapeHtml(b.notes || '') + '</textarea></div>' +
    '<div class="oc-modal-actions">' +
    '<button class="btn btn-ghost btn-sm" onclick="closeProfileModal()">Cancel</button>' +
    '<button class="btn btn-gold btn-sm" id="sbeb-submit-btn" onclick="sbSubmitEditBooking()">Save Changes</button>' +
    '</div>';

  var lineContainer = document.getElementById('sbeb-service-lines');
  (b.services && b.services.length ? b.services : [{}]).forEach(function (line) {
    sbEditLine(lineContainer, line.service ? line.service.id : undefined, line.quantity);
  });

  document.getElementById('profile-modal-overlay').style.display = 'flex';
}

function sbAddEditServiceLine() {
  sbEditLine(document.getElementById('sbeb-service-lines'));
}

async function sbSubmitEditBooking() {
  var errEl = document.getElementById('sbeb-error');
  errEl.style.display = 'none';

  var services = [];
  document.querySelectorAll('#sbeb-service-lines > div').forEach(function (row) {
    var serviceId = row.querySelector('.sb-eb-service-select').value;
    var quantity = Number(row.querySelector('.sb-eb-qty').value) || 1;
    if (serviceId) services.push({ serviceId: serviceId, quantity: quantity });
  });
  if (!services.length) {
    errEl.textContent = 'At least one service is required.';
    errEl.style.display = '';
    return;
  }

  var payload = {
    customerName: document.getElementById('sbeb-customer-name').value.trim() || undefined,
    customerPhone: document.getElementById('sbeb-customer-phone').value.trim() || undefined,
    assignedStaffId: document.getElementById('sbeb-staff').value || undefined,
    bookingDate: document.getElementById('sbeb-date').value || undefined,
    bookingTime: document.getElementById('sbeb-time').value || undefined,
    notes: document.getElementById('sbeb-notes').value.trim(),
    services: services,
  };

  var btn = document.getElementById('sbeb-submit-btn');
  btn.disabled = true;
  try {
    await SalonBookingsSelf.editBooking(sbEditingBookingId, payload);
    closeProfileModal();
    await loadSalonBookings();
  } catch (err) {
    errEl.textContent = err.message || 'Failed to save changes.';
    errEl.style.display = '';
  } finally {
    btn.disabled = false;
  }
}

async function sbOpenAddServiceModal(b) {
  sbAddServiceBookingId = b.id;

  if (!sbServicesCache) {
    try {
      var res = await Auth.fetch('/services?status=ACTIVE&bookingType=WALK_IN&branchId=' + encodeURIComponent(currentStaff.locationId || (currentStaff.location && currentStaff.location.id) || ''));
      var raw = await res.json().catch(function () { return {}; });
      sbServicesCache = Array.isArray(raw) ? raw : (raw.services || raw.data || []);
    } catch (err) { sbServicesCache = []; }
  }

  var options = '<option value="">Select service…</option>' + (sbServicesCache || []).map(function (s) {
    var price = s.effectivePrice != null ? s.effectivePrice : s.walkInPrice;
    return '<option value="' + s.id + '">' + escapeHtml(s.name) + ' — ' + sbFormatMoney(price) + '</option>';
  }).join('');

  document.getElementById('profile-modal-box').innerHTML =
    '<div class="oc-modal-error" id="sbas-error" style="display:none"></div>' +
    '<h3>Add Service — ' + escapeHtml(b.bookingCode || '') + '</h3>' +
    '<div class="oc-modal-sub">This booking is Completed — its existing services can\'t be changed. This only adds a new one.</div>' +
    '<div class="oc-field"><label>Service</label><select id="sbas-service">' + options + '</select></div>' +
    '<div class="oc-field"><label>Quantity</label><input type="number" min="1" value="1" id="sbas-qty"></div>' +
    '<div class="oc-modal-actions">' +
    '<button class="btn btn-ghost btn-sm" onclick="closeProfileModal()">Cancel</button>' +
    '<button class="btn btn-gold btn-sm" id="sbas-submit-btn" onclick="sbSubmitAddService()">Add Service</button>' +
    '</div>';
  document.getElementById('profile-modal-overlay').style.display = 'flex';
}

async function sbSubmitAddService() {
  var errEl = document.getElementById('sbas-error');
  errEl.style.display = 'none';
  var serviceId = document.getElementById('sbas-service').value;
  var quantity = Number(document.getElementById('sbas-qty').value) || 1;
  if (!serviceId) {
    errEl.textContent = 'Please select a service.';
    errEl.style.display = '';
    return;
  }
  var btn = document.getElementById('sbas-submit-btn');
  btn.disabled = true;
  try {
    await SalonBookingsSelf.addServiceToCompletedBooking(sbAddServiceBookingId, { serviceId: serviceId, quantity: quantity });
    closeProfileModal();
    await loadSalonBookings();
  } catch (err) {
    errEl.textContent = err.message || 'Failed to add service.';
    errEl.style.display = '';
  } finally {
    btn.disabled = false;
  }
}

async function sbPrintBooking(id) {
  try {
    var b = (sbBookingsCache || []).find(function (x) { return x.id === id; }) || await SalonBookingsSelf.getOne(id);
    document.getElementById('sb-pr-booking-code').textContent = b.bookingCode || '—';
    document.getElementById('sb-pr-datetime').textContent = StaffSelf.formatDate(b.bookingDate) + ' · ' + (b.bookingTime || '');
    document.getElementById('sb-pr-customer').textContent = (b.customerName || '—') + (b.customerPhone ? ' (' + b.customerPhone + ')' : '');
    document.getElementById('sb-pr-stylist').textContent = b.assignedStaff ? b.assignedStaff.name : '—';
    document.getElementById('sb-pr-branch').textContent = currentStaff.location ? currentStaff.location.name : '';
    // Same convention as the Admin receipt: createdBy is only set when a
    // staff member entered the booking directly, so a customer's own
    // self-service reservation reads as "Online booking" rather than blank.
    document.getElementById('sb-pr-served-by').textContent = b.createdBy ? b.createdBy.name : 'Online booking';
    var servicesContainer = document.getElementById('sb-pr-services-list');
    var services = b.services || [];
    servicesContainer.innerHTML = services.length
      ? services.map(function (s) {
        var name = escapeHtml(s.service ? s.service.name : 'Service');
        var qty = s.quantity && s.quantity > 1 ? ' x' + s.quantity : '';
        return '<div class="pr-service-line"><span>' + name + qty + '</span></div>';
      }).join('')
      : '<div class="pr-service-line"><span>—</span></div>';
    document.getElementById('sb-pr-amount').textContent = sbFormatMoney(b.totalAmount);
    document.getElementById('sb-pr-status').textContent = String(b.status || '').replace(/_/g, ' ');
    window.print();
  } catch (err) {
    alert(err.message || 'Could not prepare receipt for printing.');
  }
}

// -- Verify Reservation (staff, own branch only) -------------------------------

var _sbVerifyBooking = null;
var _sbVerifySource = null;
var _sbVerifyCode = null;

function showVerifyReservationForm() {
  document.getElementById('profile-modal-box').innerHTML =
    '<div class="oc-modal-error" id="sbv-error" style="display:none"></div>' +
    '<h3>Verify Reservation</h3>' +
    '<div class="oc-modal-sub">Enter the code the customer presents on arrival.</div>' +
    '<div class="oc-field"><label>Reservation Code</label><input type="text" id="sbv-code" style="text-transform:uppercase" placeholder="HLS-XXXXXX"></div>' +
    '<div class="oc-modal-actions">' +
    '<button class="btn btn-ghost btn-sm" onclick="closeProfileModal()">Cancel</button>' +
    '<button class="btn btn-gold btn-sm" id="sbv-lookup-btn" onclick="sbLookupReservationCode()">Look Up</button>' +
    '</div>';
  document.getElementById('profile-modal-overlay').style.display = 'flex';
  setTimeout(function () { var el = document.getElementById('sbv-code'); if (el) el.focus(); }, 100);
}

// -- New Inventory Item (staff, own branch only) --------------------------------

var _supplierOptionsCache = null;

async function showNewInventoryItemForm() {
  document.getElementById('profile-modal-box').innerHTML =
    '<div class="oc-modal-error" id="nii-error" style="display:none"></div>' +
    '<h3>Log New Item</h3>' +
    '<div class="oc-modal-sub">Adds a new item to your own branch\'s stock register.</div>' +
    '<div class="oc-field"><label>Name</label><input type="text" id="nii-name" placeholder="e.g. Argan Oil Shampoo 500ml"></div>' +
    '<div style="display:flex;gap:12px">' +
    '<div class="oc-field" style="flex:1"><label>Category</label><select id="nii-category" onchange="niiUpdatePriceVisibility()">' +
    '<option value="FOR_SALE">For Sale</option><option value="INTERNAL_USE">Internal Use</option><option value="STORAGE">Storage</option>' +
    '</select></div>' +
    '<div class="oc-field" style="flex:1"><label>Unit</label><input type="text" id="nii-unit" placeholder="e.g. bottle"></div>' +
    '</div>' +
    '<div class="oc-field"><label>Supplier / Vendor</label><select id="nii-supplier"><option value="">None</option></select></div>' +
    '<div style="display:flex;gap:12px">' +
    '<div class="oc-field" style="flex:1"><label>Initial Quantity</label><input type="number" min="0" id="nii-quantity" value="0"></div>' +
    '<div class="oc-field" style="flex:1"><label>Low Stock Threshold</label><input type="number" min="0" id="nii-threshold" value="5"></div>' +
    '</div>' +
    '<div class="oc-field" id="nii-price-field"><label>Price (\u20a6)</label><input type="number" min="0" step="0.01" id="nii-price" placeholder="Required for For Sale items"></div>' +
    '<div class="oc-field"><label>Expiry Date (optional)</label><input type="date" id="nii-expiry"></div>' +
    '<div class="oc-modal-actions">' +
    '<button class="btn btn-ghost btn-sm" onclick="closeProfileModal()">Cancel</button>' +
    '<button class="btn btn-gold btn-sm" id="nii-save-btn" onclick="submitNewInventoryItem()">Save</button>' +
    '</div>';
  document.getElementById('profile-modal-overlay').style.display = 'flex';
  setTimeout(function () { var el = document.getElementById('nii-name'); if (el) el.focus(); }, 100);

  if (!_supplierOptionsCache) {
    try {
      var suppliers = await SuppliersSelf.getAll();
      _supplierOptionsCache = suppliers.map(function (s) {
        return '<option value="' + s.id + '">' + escapeHtml(s.name) + (s.type === 'VENDOR' ? ' (Vendor)' : ' (Supplier)') + '</option>';
      }).join('');
    } catch (err) {
      _supplierOptionsCache = '';
    }
  }
  var supplierSelect = document.getElementById('nii-supplier');
  if (supplierSelect) supplierSelect.innerHTML = '<option value="">None</option>' + _supplierOptionsCache;
}

function niiUpdatePriceVisibility() {
  var field = document.getElementById('nii-price-field');
  if (field) field.style.display = document.getElementById('nii-category').value === 'FOR_SALE' ? '' : 'none';
}

async function submitNewInventoryItem() {
  var errEl = document.getElementById('nii-error');
  errEl.style.display = 'none';

  var name = document.getElementById('nii-name').value.trim();
  var category = document.getElementById('nii-category').value;
  var price = document.getElementById('nii-price').value;

  if (!name) { errEl.textContent = 'Name is required.'; errEl.style.display = ''; return; }
  if (category === 'FOR_SALE' && !price) { errEl.textContent = 'Price is required for items in the For Sale category.'; errEl.style.display = ''; return; }

  var btn = document.getElementById('nii-save-btn');
  btn.disabled = true;
  try {
    await InventorySelf.createItem({
      name: name,
      category: category,
      unit: document.getElementById('nii-unit').value.trim() || undefined,
      supplierId: document.getElementById('nii-supplier').value || undefined,
      initialQuantity: Number(document.getElementById('nii-quantity').value) || 0,
      lowStockThreshold: Number(document.getElementById('nii-threshold').value) || 5,
      price: price ? Number(price) : undefined,
      expiryDate: document.getElementById('nii-expiry').value || undefined,
    });
    closeProfileModal();
    await loadInventoryItems();
  } catch (err) {
    errEl.textContent = err.message || 'Failed to create item.';
    errEl.style.display = '';
  } finally {
    btn.disabled = false;
  }
}

function sbShowVerifyError(message) {
  var el = document.getElementById('sbv-error');
  if (el) { el.textContent = message; el.style.display = 'block'; }
}

async function sbLookupReservationCode() {
  var code = document.getElementById('sbv-code').value.trim().toUpperCase();
  if (!code) { sbShowVerifyError('Enter a reservation code.'); return; }

  var btn = document.getElementById('sbv-lookup-btn');
  btn.disabled = true;
  try {
    var result = await SalonBookingsSelf.verifyCode(code);
    var source = result.source;
    var booking = result.booking;
    _sbVerifyBooking = booking;
    _sbVerifySource = source;
    _sbVerifyCode = code;

    var isLegacy = source === 'booking';
    var customerName = isLegacy
      ? (booking.guestName || (booking.user ? (booking.user.firstName + ' ' + booking.user.lastName) : ''))
      : booking.customerName;
    var customerPhone = isLegacy
      ? (booking.guestPhone || (booking.user ? booking.user.phone : ''))
      : booking.customerPhone;
    var services = isLegacy
      ? (booking.services || []).map(function (s) { return escapeHtml(s.name || ''); }).join(', ')
      : (booking.services || []).map(function (s) { return escapeHtml(s.service ? s.service.name : ''); }).join(', ');

    if (booking.reservationUsed) {
      document.getElementById('profile-modal-box').innerHTML =
        '<h3>Verify Reservation</h3>' +
        '<div class="oc-modal-sub">' + escapeHtml(customerName || '') + ' \u00B7 ' + (services || '\u2014') + '</div>' +
        '<div style="color:var(--red);font-weight:700;margin:12px 0">This reservation has already been used.</div>' +
        '<div class="oc-modal-actions"><button class="btn btn-ghost btn-sm" onclick="closeProfileModal()">Close</button></div>';
      return;
    }

    if (!sbStaffCache) {
      var staffResult = await SalonBookingsSelf.getBranchStaff();
      sbStaffCache = staffResult || [];
    }
    var staffOptions = '<option value="">Select stylist\u2026</option>' + sbStaffCache.map(function (s) {
      return '<option value="' + s.id + '">' + escapeHtml(s.name) + '</option>';
    }).join('');

    document.getElementById('profile-modal-box').innerHTML =
      '<div class="oc-modal-error" id="sbv-error" style="display:none"></div>' +
      '<h3>Verify Reservation</h3>' +
      '<div class="oc-modal-sub"><strong>' + escapeHtml(customerName || '') + '</strong>' + (customerPhone ? ' (' + escapeHtml(customerPhone) + ')' : '') + '<br>' +
      StaffSelf.formatDate(booking.bookingDate) + ' \u00B7 ' + escapeHtml(booking.bookingTime) + '<br>' +
      (services || '\u2014') + ' \u2014 ' + sbFormatMoney(booking.totalAmount) + '</div>' +
      '<div class="oc-field"><label>Assign Stylist</label><select id="sbv-staff">' + staffOptions + '</select></div>' +
      '<div class="oc-modal-actions">' +
      '<button class="btn btn-ghost btn-sm" onclick="closeProfileModal()">Cancel</button>' +
      '<button class="btn btn-gold btn-sm" id="sbv-confirm-btn" onclick="sbConfirmVerification()">Confirm &amp; Assign</button>' +
      '</div>';
  } catch (err) {
    sbShowVerifyError(err.message || 'Reservation not found.');
  } finally {
    btn.disabled = false;
  }
}

async function sbConfirmVerification() {
  var staffId = document.getElementById('sbv-staff').value;
  if (!staffId) { sbShowVerifyError('Please select a Stylist.'); return; }

  var btn = document.getElementById('sbv-confirm-btn');
  btn.disabled = true;
  try {
    await SalonBookingsSelf.confirmVerification(_sbVerifyCode, staffId);
    closeProfileModal();
    await loadSalonBookings();
  } catch (err) {
    sbShowVerifyError(err.message || 'Failed to verify reservation.');
  } finally {
    btn.disabled = false;
  }
}

function sbAddServiceLine() {
  var container = document.getElementById('sb-service-lines');
  var row = document.createElement('div');
  row.style.display = 'grid';
  row.style.gridTemplateColumns = '1fr 70px 32px';
  row.style.gap = '8px';
  row.style.marginBottom = '6px';
  var options = '<option value="">Select service…</option>' + sbServicesCache.map(function (s) {
    var price = s.effectivePrice != null ? s.effectivePrice : s.walkInPrice;
    return '<option value="' + s.id + '" data-price="' + price + '">' + escapeHtml(s.name) + ' — ' + sbFormatMoney(price) + '</option>';
  }).join('');
  row.innerHTML =
    '<select class="input sb-service-select">' + options + '</select>' +
    '<input type="number" min="1" value="1" class="input sb-qty">' +
    '<button type="button" class="btn btn-ghost btn-sm sb-remove-line">&times;</button>';
  container.appendChild(row);
  row.querySelector('.sb-service-select').addEventListener('change', sbUpdateTotal);
  row.querySelector('.sb-qty').addEventListener('input', sbUpdateTotal);
  row.querySelector('.sb-remove-line').addEventListener('click', function () { row.remove(); sbUpdateTotal(); });
  sbUpdateTotal();
}

async function sbAddItemLine() {
  if (!window._sbInventoryItems) {
    try {
      var res = await InventorySelf.getItems();
      window._sbInventoryItems = res.data || res || [];
    } catch (err) { window._sbInventoryItems = []; }
  }
  var container = document.getElementById('sb-item-lines');
  var row = document.createElement('div');
  row.style.display = 'grid';
  row.style.gridTemplateColumns = '1fr 70px 32px';
  row.style.gap = '8px';
  row.style.marginBottom = '6px';
  var options = '<option value="">Select product…</option>' + window._sbInventoryItems.map(function (i) {
    var label = i.category === 'FOR_SALE' ? (' — ' + sbFormatMoney(i.price)) : ' — not for sale';
    return '<option value="' + i.id + '" data-price="' + (i.price || 0) + '" data-sellable="' + (i.category === 'FOR_SALE' ? '1' : '0') + '">' + escapeHtml(i.name) + label + '</option>';
  }).join('');
  row.innerHTML =
    '<select class="input sb-item-select">' + options + '</select>' +
    '<input type="number" min="1" value="1" class="input sb-qty">' +
    '<button type="button" class="btn btn-ghost btn-sm sb-remove-line">&times;</button>';
  container.appendChild(row);
  row.querySelector('.sb-item-select').addEventListener('change', sbUpdateTotal);
  row.querySelector('.sb-qty').addEventListener('input', sbUpdateTotal);
  row.querySelector('.sb-remove-line').addEventListener('click', function () { row.remove(); sbUpdateTotal(); });
  sbUpdateTotal();
}

function sbUpdateTotal() {
  var total = 0;
  document.querySelectorAll('#sb-service-lines > div').forEach(function (row) {
    var sel = row.querySelector('.sb-service-select');
    var qty = Number(row.querySelector('.sb-qty').value) || 0;
    var opt = sel.options[sel.selectedIndex];
    if (opt && opt.value) total += Number(opt.dataset.price || 0) * qty;
  });
  document.querySelectorAll('#sb-item-lines > div').forEach(function (row) {
    var sel = row.querySelector('.sb-item-select');
    var qty = Number(row.querySelector('.sb-qty').value) || 0;
    var opt = sel.options[sel.selectedIndex];
    if (opt && opt.value && opt.dataset.sellable === '1') total += Number(opt.dataset.price || 0) * qty;
  });
  var el = document.getElementById('sb-estimated-total');
  if (el) el.textContent = 'Estimated total: ' + sbFormatMoney(total);
}

async function submitBookingForm() {
  var customerName = document.getElementById('sb-customer-name').value.trim();
  var customerPhone = document.getElementById('sb-customer-phone').value.trim();
  var assignedStaffId = document.getElementById('sb-staff').value;
  var bookingDate = document.getElementById('sb-date').value;
  var bookingTime = document.getElementById('sb-time').value;
  var notes = document.getElementById('sb-notes').value.trim();

  var services = [];
  document.querySelectorAll('#sb-service-lines > div').forEach(function (row) {
    var serviceId = row.querySelector('.sb-service-select').value;
    var quantity = Number(row.querySelector('.sb-qty').value) || 1;
    if (serviceId) services.push({ serviceId: serviceId, quantity: quantity });
  });

  var inventoryItems = [];
  document.querySelectorAll('#sb-item-lines > div').forEach(function (row) {
    var itemId = row.querySelector('.sb-item-select').value;
    var quantity = Number(row.querySelector('.sb-qty').value) || 1;
    if (itemId) inventoryItems.push({ itemId: itemId, quantity: quantity });
  });

  if (!customerName || !assignedStaffId || !bookingDate || !bookingTime) {
    alert('Customer name, Stylist, Date, and Time are all required.');
    return;
  }
  if (!services.length) {
    alert('At least one service is required.');
    return;
  }

  try {
    await SalonBookingsSelf.create({
      customerName: customerName, customerPhone: customerPhone || undefined,
      linkToVerifiedUser: _sbLinkToVerifiedUser || undefined,
      assignedStaffId: assignedStaffId, bookingDate: bookingDate, bookingTime: bookingTime,
      services: services, inventoryItems: inventoryItems.length ? inventoryItems : undefined,
      notes: notes || undefined,
    });
    cancelBookingForm();
    await loadSalonBookings();
  } catch (err) {
    alert(err.message || 'Failed to create booking.');
  }
}

// -- Inventory --

var inventoryBranchesCache = null;

async function loadInventoryItems() {
  const category = document.getElementById('inv-category-filter').value;
  let result;
  try {
    result = await InventorySelf.getItems({ category, limit: 100 });
  } catch (err) {
    console.error('Failed to load inventory items', err);
    document.getElementById('inv-items-tbody').innerHTML =
      '<tr><td colspan="6" class="text-danger">' + escapeHtml(err.message || 'Failed to load.') + '</td></tr>';
    return;
  }

  const items = result.data || [];
  const outOfStock = items.filter((i) => i.currentQuantity <= 0).length;
  const lowStock = items.filter((i) => i.currentQuantity > 0 && i.currentQuantity <= i.lowStockThreshold).length;
  const healthy = items.length - outOfStock - lowStock;

  document.getElementById('inv-total').textContent = String(items.length);
  document.getElementById('inv-healthy').textContent = String(healthy);
  document.getElementById('inv-low').textContent = String(lowStock);
  document.getElementById('inv-out').textContent = String(outOfStock);

  const tbody = document.getElementById('inv-items-tbody');
  if (!items.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-secondary">No items yet for this branch.</td></tr>';
  } else {
    tbody.innerHTML = items.map(function (i) {
      var statusBadge = i.currentQuantity <= 0
        ? '<span class="badge b-red">Out of Stock</span>'
        : i.currentQuantity <= i.lowStockThreshold
          ? '<span class="badge b-amber">Low</span>'
          : '<span class="badge b-green">Good</span>';
      return '<tr>' +
        '<td style="font-weight:600;color:var(--white)">' + escapeHtml(i.name) + '</td>' +
        '<td>' + (InventorySelf.CATEGORY_LABELS[i.category] || i.category) + '</td>' +
        '<td>' + i.currentQuantity + (i.unit ? ' ' + escapeHtml(i.unit) : '') + '</td>' +
        '<td>' + i.lowStockThreshold + '</td>' +
        '<td>' + statusBadge + '</td>' +
        '<td><button class="btn btn-ghost btn-sm" onclick="promptReceiveGoods(\'' + i.id + '\', \'' + escapeHtml(i.name).replace(/'/g, "\\'") + '\')">Receive Goods</button> ' +
        '<button class="btn btn-ghost btn-sm" onclick="promptRequestAdjustment(\'' + i.id + '\', \'' + escapeHtml(i.name).replace(/'/g, "\\'") + '\')">Request Adjustment</button></td>' + '</tr>';
    }).join('');
  }

  // Populate the transfer-item dropdown from the same item list.
  var transferSelect = document.getElementById('inv-transfer-item');
  transferSelect.innerHTML = '<option value="">Select an item…</option>' +
    items.map(function (i) { return '<option value="' + i.id + '">' + escapeHtml(i.name) + ' (' + i.currentQuantity + ' in stock)</option>'; }).join('');
}

async function promptReceiveGoods(itemId, itemName) {
  var qtyStr = prompt('Quantity received for "' + itemName + '":');
  if (qtyStr === null) return;
  var qty = parseInt(qtyStr, 10);
  if (!qty || qty < 1) { alert('Please enter a valid quantity.'); return; }
  var note = prompt('Note (optional — supplier, batch no., etc.):') || undefined;

  try {
    await InventorySelf.receiveGoods(itemId, { quantity: qty, note: note });
    await loadInventoryItems();
  } catch (err) {
    alert(err.message || 'Failed to record goods received.');
  }
}

async function promptRequestAdjustment(itemId, itemName) {
  var deltaStr = prompt('Adjustment for "' + itemName + '" — use a negative number to reduce stock (e.g. -3), positive to add:');
  if (deltaStr === null) return;
  var delta = parseInt(deltaStr, 10);
  if (!delta) { alert('Please enter a non-zero whole number.'); return; }
  var reason = prompt('Reason for this adjustment (required):');
  if (!reason) return;

  try {
    await InventorySelf.requestAdjustment(itemId, { quantityDelta: delta, reason: reason });
    alert('Adjustment request submitted — it now needs approval before stock changes.');
  } catch (err) {
    alert(err.message || 'Failed to submit adjustment request.');
  }
}

async function ensureInventoryBranches() {
  if (inventoryBranchesCache) return inventoryBranchesCache;
  try {
    var result = await InventorySelf.getBranches();
    inventoryBranchesCache = result.data || (Array.isArray(result) ? result : []);
  } catch (err) {
    inventoryBranchesCache = [];
  }
  return inventoryBranchesCache;
}

function toggleTransferDirection() {
  // Direction only affects the submit-time payload shape (which item is
  // "from" vs "to") — the form fields themselves stay the same either way.
}

async function submitTransferRequest() {
  var itemId = document.getElementById('inv-transfer-item').value;
  var direction = document.getElementById('inv-transfer-direction').value;
  var otherBranchId = document.getElementById('inv-transfer-branch').value;
  var qty = parseInt(document.getElementById('inv-transfer-qty').value, 10);

  if (!itemId || !otherBranchId || !qty || qty < 1) {
    alert('Please select an item, a branch, and enter a valid quantity.');
    return;
  }

  var payload;
  if (direction === 'send') {
    // Sending FROM my branch's item TO the other branch.
    payload = { fromItemId: itemId, toBranchId: otherBranchId, quantity: qty };
  } else {
    // Requesting stock — the selected item must belong to the OTHER branch,
    // and my own branch is the destination. Since the item dropdown is
    // currently populated from MY branch's items only, "request" mode isn't
    // fully wired yet — flagged rather than silently sent incorrectly.
    alert('Requesting stock FROM another branch requires browsing that branch\'s items first — this direction isn\'t wired yet. Use "Send" for now, or ask an admin to initiate a pull on your behalf.');
    return;
  }

  try {
    await InventorySelf.requestTransfer(payload);
    document.getElementById('inv-transfer-qty').value = '';
    await loadTransferRequests();
    alert('Transfer request submitted.');
  } catch (err) {
    alert(err.message || 'Failed to submit transfer request.');
  }
}

async function loadTransferRequests() {
  var container = document.getElementById('inv-transfers-list');
  try {
    var result = await InventorySelf.getTransferRequests();
    var transfers = result.data || (Array.isArray(result) ? result : []);
    if (!transfers.length) {
      container.innerHTML = '<div class="text-secondary small">No transfer requests yet.</div>';
      return;
    }
    var statusColor = { PENDING: 'amber', APPROVED: 'green', REJECTED: 'red', COMPLETED: 'green' };
    container.innerHTML = transfers.map(function (t) {
      return '<div class="inv-bar">' +
        '<div class="inv-name">' + escapeHtml(t.fromItem ? t.fromItem.name : 'Item') + ' \u00d7 ' + t.quantity + '</div>' +
        '<span class="bdg ' + (statusColor[t.status] || '') + '">' + t.status + '</span>' +
        '</div>';
    }).join('');
  } catch (err) {
    container.innerHTML = '<div class="text-danger small">' + escapeHtml(err.message || 'Failed to load.') + '</div>';
  }
}

async function loadPayrollSection() {
  await Promise.allSettled([
    prLoadWallet(),
    prLoadBankAccount(),
    prLoadCompensation(),
    prLoadFines(),
    prLoadPayslips(),
    prLoadWithdrawals(),
  ]);
}

/** Running late-penalty + absent-fee total for the in-progress payroll period — visible before payroll actually runs, matching exactly what payroll will eventually sum. */
async function prLoadFines() {
  var container = document.getElementById('pr-fines-content');
  var labelEl = document.getElementById('pr-fines-period-label');
  try {
    var fines = await PayrollSelf.getCurrentFines();
    if (labelEl) labelEl.textContent = fines.periodLabel + (fines.isDraftPeriod ? '' : ' (est.)');

    if (!fines.total) {
      container.innerHTML = '<div class="text-secondary small">No fines recorded this period.</div>';
      return;
    }

    var rows = (fines.records || []).map(function (r) {
      var amount = r.status === 'ABSENT' ? r.absentFeeAmount : r.latePenaltyAmount;
      var detail = r.status === 'ABSENT'
        ? 'Absent fee'
        : (r.lateMinutes ? r.lateMinutes + ' min late' : 'Late penalty');
      return '<div class="d-flex justify-content-between border-bottom py-2">' +
        '<div><span class="badge ' + (r.status === 'ABSENT' ? 'b-red' : 'b-amber') + ' me-2">' + r.status + '</span>' +
        '<span class="text-secondary small">' + StaffSelf.formatDate(r.date, { day: '2-digit', month: 'short' }) + ' \u2014 ' + detail + '</span></div>' +
        '<div class="fw-semibold">' + sbFormatMoney(amount) + '</div></div>';
    }).join('');

    container.innerHTML =
      '<div class="d-flex justify-content-between mb-3">' +
      '<div><div class="text-secondary small">Late Penalties</div><div class="fw-semibold">' + sbFormatMoney(fines.latePenaltyTotal) + '</div></div>' +
      '<div><div class="text-secondary small">Absent Fees</div><div class="fw-semibold">' + sbFormatMoney(fines.absentFeeTotal) + '</div></div>' +
      '<div><div class="text-secondary small">Total</div><div class="fw-bold" style="color:var(--red)">' + sbFormatMoney(fines.total) + '</div></div>' +
      '</div>' +
      rows;
  } catch (err) {
    container.innerHTML = '<div class="text-danger small">' + escapeHtml(err.message || 'Failed to load.') + '</div>';
  }
}

async function prLoadWallet() {
  try {
    var wallet = await PayrollSelf.getWallet();
    document.getElementById('pr-wallet-balance').textContent = sbFormatMoney(wallet.balance);
    document.getElementById('pr-available-balance').textContent = sbFormatMoney(wallet.availableBalance != null ? wallet.availableBalance : wallet.balance);
    document.getElementById('pr-pending-balance').textContent = sbFormatMoney(wallet.pendingWithdrawals || 0);

    var statusEl = document.getElementById('pr-payday-status');
    var hintEl = document.getElementById('pr-withdraw-hint');
    if (wallet.releaseActive) {
      statusEl.textContent = 'Payday is ON \u2014 withdrawals available';
      hintEl.textContent = '';
    } else {
      statusEl.textContent = 'Payday is OFF \u2014 withdrawals locked';
      hintEl.textContent = 'Withdrawals open once management switches Payday on.';
    }
  } catch (err) {
    document.getElementById('pr-wallet-balance').textContent = '\u2014';
  }
}

async function prLoadCompensation() {
  var container = document.getElementById('pr-comp-content');
  try {
    var comp = await PayrollSelf.getCompensation();
    if (comp.currentBaseSalary == null) {
      container.innerHTML = '<div class="text-secondary small">No compensation on file yet — check with an admin.</div>';
      return;
    }
    container.innerHTML =
      '<div class="g2">' +
      '<div class="stat green"><div class="stat-lbl">Base Salary</div><div class="stat-val">' + sbFormatMoney(comp.currentBaseSalary) + '</div><div class="stat-delta neu">Monthly</div></div>' +
      (comp.currentAllowances
        ? '<div class="stat gold"><div class="stat-lbl">Allowances</div><div class="stat-val">' + sbFormatMoney(comp.currentAllowances) + '</div><div class="stat-delta neu">Monthly</div></div>'
        : '<div class="stat"><div class="stat-lbl">Allowances</div><div class="stat-val">\u2014</div></div>') +
      '</div>';
  } catch (err) {
    container.innerHTML = '<div class="text-danger small">' + escapeHtml(err.message || 'Failed to load.') + '</div>';
  }
}

async function prLoadBankAccount() {
  var container = document.getElementById('pr-bank-content');
  try {
    var account = await PayrollSelf.getBankAccount();
    if (!account) {
      container.innerHTML = prBankAccountForm();
      prWireBankAccountForm();
      return;
    }

    var pendingNote = account.pendingRequestedAt
      ? '<div class="text-secondary small mt3">A change to <strong>' + escapeHtml(account.pendingBankName || '') + ' \u2014 ' + escapeHtml(account.pendingAccountNumber || '') + '</strong> is awaiting admin approval.</div>'
      : '';

    container.innerHTML =
      '<div><strong>' + escapeHtml(account.bankName) + '</strong><br>' +
      '<span class="text-secondary small">' + escapeHtml(account.accountNumber) + ' \u00b7 ' + escapeHtml(account.accountName) + '</span></div>' +
      pendingNote +
      '<button class="btn btn-ghost btn-sm mt3" onclick="prShowBankChangeForm()">' + (account.pendingRequestedAt ? 'Submit a Different Change' : 'Request a Change') + '</button>' +
      '<div id="pr-bank-form-wrap"></div>';
  } catch (err) {
    container.innerHTML = prBankAccountForm();
    prWireBankAccountForm();
  }
}

function prBankAccountForm() {
  return '<div id="pr-bank-form-wrap">' +
    '<div class="text-secondary small mb-2">No bank account on file yet — add one to enable withdrawals.</div>' +
    '<div id="pr-bank-error" class="text-danger small mb-2" style="display:none"></div>' +
    '<div class="oc-field"><label>Bank</label><select id="pr-bank-select"><option value="">Loading banks\u2026</option></select></div>' +
    '<div class="oc-field"><label>Account Number</label><input type="text" id="pr-bank-account-number" maxlength="10" placeholder="0123456789"></div>' +
    '<div id="pr-bank-resolved" class="small mb-2" style="display:none"></div>' +
    '<button class="btn btn-gold btn-sm" id="pr-bank-save-btn" onclick="prSubmitBankAccount()" disabled>Save Bank Account</button>' +
    '</div>';
}

function prShowBankChangeForm() {
  document.getElementById('pr-bank-form-wrap').innerHTML =
    '<div class="text-danger small mb-2" id="pr-bank-error" style="display:none"></div>' +
    '<div class="oc-field"><label>New Bank</label><select id="pr-bank-select"><option value="">Loading banks\u2026</option></select></div>' +
    '<div class="oc-field"><label>New Account Number</label><input type="text" id="pr-bank-account-number" maxlength="10" placeholder="0123456789"></div>' +
    '<div id="pr-bank-resolved" class="small mb-2" style="display:none"></div>' +
    '<div class="text-secondary small mb-2">Changes require admin approval before they take effect.</div>' +
    '<button class="btn btn-gold btn-sm" id="pr-bank-save-btn" onclick="prSubmitBankAccount()" disabled>Submit Change Request</button>';
  prWireBankAccountForm();
}

var _prBanksCache = null;
var _prResolveTimer = null;
var _prResolvedOk = false;

async function prWireBankAccountForm() {
  var select = document.getElementById('pr-bank-select');
  if (!select) return;
  if (!_prBanksCache) {
    try {
      var banks = await PayrollSelf.listBanks();
      _prBanksCache = banks.slice().sort(function (a, b) { return a.name.localeCompare(b.name); });
    } catch (err) {
      _prBanksCache = [];
    }
  }
  select.innerHTML = '<option value="">Select bank\u2026</option>' + _prBanksCache.map(function (b) {
    return '<option value="' + b.code + '">' + escapeHtml(b.name) + '</option>';
  }).join('');

  var numberInput = document.getElementById('pr-bank-account-number');
  select.addEventListener('change', prTriggerResolve);
  numberInput.addEventListener('input', function () {
    clearTimeout(_prResolveTimer);
    _prResolveTimer = setTimeout(prTriggerResolve, 400);
  });
}

async function prTriggerResolve() {
  var bankCode = document.getElementById('pr-bank-select').value;
  var accountNumber = document.getElementById('pr-bank-account-number').value.trim();
  var resolvedEl = document.getElementById('pr-bank-resolved');
  var saveBtn = document.getElementById('pr-bank-save-btn');
  var errEl = document.getElementById('pr-bank-error');

  _prResolvedOk = false;
  if (saveBtn) saveBtn.disabled = true;

  if (!bankCode || accountNumber.length !== 10) {
    resolvedEl.style.display = 'none';
    return;
  }

  resolvedEl.style.display = '';
  resolvedEl.className = 'small mb-2 text-secondary';
  resolvedEl.textContent = 'Checking account\u2026';

  try {
    var resolved = await PayrollSelf.resolveAccount(bankCode, accountNumber);
    resolvedEl.className = 'small mb-2';
    if (resolved.nameMatches) {
      resolvedEl.style.color = 'var(--green, #2ecc71)';
      resolvedEl.textContent = '\u2713 ' + resolved.accountName;
      _prResolvedOk = true;
      if (saveBtn) saveBtn.disabled = false;
      if (errEl) errEl.style.display = 'none';
    } else {
      resolvedEl.style.color = 'var(--red, #e5484d)';
      resolvedEl.textContent = '\u26a0 ' + resolved.accountName + ' \u2014 this doesn\'t match your name on file. Salary can only be paid into an account in your own name.';
      _prResolvedOk = false;
      if (saveBtn) saveBtn.disabled = true;
    }
  } catch (err) {
    resolvedEl.style.display = 'none';
    if (errEl) { errEl.textContent = err.message || 'Could not verify this account.'; errEl.style.display = ''; }
  }
}

async function prSubmitBankAccount() {
  var errEl = document.getElementById('pr-bank-error');
  if (errEl) { errEl.style.display = 'none'; }
  var bankCode = document.getElementById('pr-bank-select').value;
  var accountNumber = document.getElementById('pr-bank-account-number').value.trim();

  if (!bankCode || accountNumber.length !== 10 || !_prResolvedOk) {
    if (errEl) { errEl.textContent = 'Select a bank and enter an account number that resolves successfully first.'; errEl.style.display = ''; }
    return;
  }

  var btn = document.getElementById('pr-bank-save-btn');
  if (btn) btn.disabled = true;
  try {
    await PayrollSelf.submitBankAccount({ bankCode: bankCode, accountNumber: accountNumber });
    await prLoadBankAccount();
  } catch (err) {
    if (errEl) { errEl.textContent = err.message || 'Failed to save bank account.'; errEl.style.display = ''; }
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function prLoadPayslips() {
  var tbody = document.getElementById('pr-payslips-tbody');
  try {
    var payslips = await PayrollSelf.getPayslips();
    tbody.innerHTML = payslips.length
      ? payslips.map(function (p) {
        var period = p.payrollPeriod ? p.payrollPeriod.label : '\u2014';
        return '<tr><td>' + escapeHtml(period) + '</td><td>' + sbFormatMoney(p.grossPay) + '</td><td>' + sbFormatMoney(p.totalDeductions) + '</td><td style="font-weight:700">' + sbFormatMoney(p.netPay) + '</td>' +
          '<td><button class="btn btn-ghost btn-sm pr-download-payslip" data-id="' + p.id + '">Download</button></td></tr>';
      }).join('')
      : '<tr><td colspan="5" class="text-center text-secondary py-4">No payslips yet.</td></tr>';
    tbody.querySelectorAll('.pr-download-payslip').forEach(function (btn) {
      btn.addEventListener('click', function () { prDownloadPayslip(btn.dataset.id, btn); });
    });
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center text-danger py-4">' + escapeHtml(err.message || 'Failed to load.') + '</td></tr>';
  }
}

async function prDownloadPayslip(id, btn) {
  var original = btn.textContent;
  btn.disabled = true;
  btn.textContent = '\u2026';
  try {
    await PayrollSelf.downloadPayslip(id);
  } catch (err) {
    alert('Could not download payslip: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = original;
  }
}

async function prLoadWithdrawals() {
  var tbody = document.getElementById('pr-withdrawals-tbody');
  try {
    var withdrawals = await PayrollSelf.listWithdrawals();
    tbody.innerHTML = withdrawals.length
      ? withdrawals.map(function (w) {
        return '<tr><td>' + new Date(w.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + '</td><td>' + sbFormatMoney(w.amount) + '</td><td>' + escapeHtml(w.status) + '</td></tr>';
      }).join('')
      : '<tr><td colspan="3" class="text-center text-secondary py-4">No withdrawals yet.</td></tr>';
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="3" class="text-center text-danger py-4">' + escapeHtml(err.message || 'Failed to load.') + '</td></tr>';
  }
}

async function prWithdrawMax() {
  try {
    var wallet = await PayrollSelf.getWallet();
    var available = wallet.availableBalance != null ? wallet.availableBalance : wallet.balance;
    document.getElementById('pr-withdraw-amount').value = available;
  } catch (err) { /* ignore */ }
}

async function prSubmitWithdrawal() {
  var errEl = document.getElementById('pr-withdraw-error');
  errEl.style.display = 'none';
  var amount = Number(document.getElementById('pr-withdraw-amount').value);

  if (!amount || amount <= 0) {
    errEl.textContent = 'Enter a valid amount.';
    errEl.style.display = '';
    return;
  }

  var btn = document.getElementById('pr-withdraw-btn');
  btn.disabled = true;
  try {
    await PayrollSelf.requestWithdrawal(amount);
    document.getElementById('pr-withdraw-amount').value = '';
    await Promise.allSettled([prLoadWallet(), prLoadWithdrawals()]);
  } catch (err) {
    errEl.textContent = err.message || 'Failed to submit withdrawal.';
    errEl.style.display = '';
  } finally {
    btn.disabled = false;
  }
}

function sbMonthLabel(monthKey) {
  var parts = monthKey.split('-');
  var d = new Date(Number(parts[0]), Number(parts[1]) - 1, 1);
  return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

async function loadCommission() {
  var container = document.getElementById('commission-content');
  if (!container) return;
  try {
    var result = await SalonBookingsSelf.getMyCommission();
    var data = result.data || result;

    if (data.commissionRate == null) {
      container.innerHTML =
        '<div class="card"><div class="card-b">' +
        '<div class="text-secondary">You\u2019re not currently set up for commission. If this role should earn commission, ask an admin to set your rate on your staff profile.</div>' +
        '</div></div>';
      return;
    }

    var ratePct = (data.commissionRate * 100).toFixed(1).replace(/\.0$/, '');

    var statsHtml =
      '<div class="g4 mb6">' +
      '<div class="stat gold"><div class="stat-ico" style="background:rgba(157,130,72,.12)">\uD83D\uDCB0</div>' +
      '<div class="stat-lbl">Commission This Month</div><div class="stat-val">' + sbFormatMoney(data.thisMonthTotal) + '</div>' +
      '<div class="stat-delta neu">' + data.bookingsThisMonth + ' booking' + (data.bookingsThisMonth === 1 ? '' : 's') + '</div></div>' +
      '<div class="stat green"><div class="stat-ico" style="background:var(--green2)">\uD83D\uDCC8</div>' +
      '<div class="stat-lbl">Commission Rate</div><div class="stat-val">' + ratePct + '%</div>' +
      '<div class="stat-delta neu">Per completed booking</div></div>' +
      '<div class="stat blue"><div class="stat-ico" style="background:var(--blue2)">\uD83D\uDCCA</div>' +
      '<div class="stat-lbl">All-Time Commission</div><div class="stat-val">' + sbFormatMoney(data.allTimeTotal) + '</div>' +
      '<div class="stat-delta neu">' + data.entries.length + ' booking' + (data.entries.length === 1 ? '' : 's') + ' total</div></div>' +
      '</div>';

    var maxMonth = data.monthlyBreakdown.reduce(function (max, m) { return Math.max(max, m.total); }, 0) || 1;
    var breakdownHtml = data.monthlyBreakdown.length
      ? data.monthlyBreakdown.map(function (m) {
        var pct = Math.round((m.total / maxMonth) * 100);
        return '<div style="margin-bottom:16px">' +
          '<div class="flex aic jsb mb2"><span style="font-size:12px;font-weight:600">' + sbMonthLabel(m.month) + '</span>' +
          '<span style="font-size:12px;font-weight:700;color:var(--gold)">' + sbFormatMoney(m.total) + ' \u00B7 ' + m.count + ' booking' + (m.count === 1 ? '' : 's') + '</span></div>' +
          '<div class="pbar"><span style="width:' + pct + '%"></span></div>' +
          '</div>';
      }).join('')
      : '<div class="text-secondary small">No commission recorded yet.</div>';

    var entriesHtml = data.entries.length
      ? '<div class="tbl-wrap"><table><thead><tr>' +
      '<th>Date</th><th>Customer</th><th>Services</th><th>Booking Total</th><th>Rate</th><th>Commission</th>' +
      '</tr></thead><tbody>' +
      data.entries.map(function (e) {
        return '<tr>' +
          '<td>' + (e.bookingDate ? StaffSelf.formatDate(e.bookingDate) : '\u2014') + '</td>' +
          '<td>' + escapeHtml(e.customerName || '\u2014') + '</td>' +
          '<td class="text-secondary small">' + escapeHtml((e.serviceNames || []).join(', ') || '\u2014') + '</td>' +
          '<td>' + (e.bookingTotal != null ? sbFormatMoney(e.bookingTotal) : '\u2014') + '</td>' +
          '<td>' + (e.rateApplied * 100).toFixed(1).replace(/\.0$/, '') + '%</td>' +
          '<td style="font-weight:700;color:var(--green)">' + sbFormatMoney(e.amount) + '</td>' +
          '</tr>';
      }).join('') +
      '</tbody></table></div>'
      : '<div class="text-secondary small">No completed bookings with commission yet.</div>';

    container.innerHTML = statsHtml +
      '<div class="g2 mb4">' +
      '<div class="card"><div class="card-h"><h3>Monthly Breakdown</h3></div><div class="card-b">' + breakdownHtml + '</div></div>' +
      '<div class="card"><div class="card-h"><h3>Recent Commission Entries</h3></div><div class="card-b">' + entriesHtml + '</div></div>' +
      '</div>';
  } catch (err) {
    container.innerHTML = '<div class="text-danger small">' + escapeHtml(err.message || 'Failed to load.') + '</div>';
  }
}

async function loadInventoryDashboard() {
  await loadInventoryItems();
  await loadTransferRequests();
  var branches = await ensureInventoryBranches();
  var branchSelect = document.getElementById('inv-transfer-branch');
  branchSelect.innerHTML = '<option value="">Select branch…</option>' +
    branches.map(function (b) { return '<option value="' + b.id + '">' + escapeHtml(b.name) + '</option>'; }).join('');
}

// -- Product Sales --------------------------------------------------------
// Standalone retail sale — no service attached. Distinct from the Bookings
// screen's "Products Used/Sold" lines, which always ride on a service
// appointment; this is for a walk-in who just wants to buy something.

var saleItemsCache = null;

async function ensureSaleItemsLoaded() {
  if (saleItemsCache) return saleItemsCache;
  try {
    var result = await InventorySelf.getItems({ category: 'FOR_SALE' });
    saleItemsCache = result.data || result || [];
  } catch (err) {
    saleItemsCache = [];
  }
  return saleItemsCache;
}

function populateSaleItemSelect(select) {
  var current = select.value;
  var items = saleItemsCache || [];
  select.innerHTML = '<option value="">Select product…</option>' + items.map(function (i) {
    var price = i.price != null ? i.price : 0;
    return '<option value="' + i.id + '" data-price="' + price + '" data-stock="' + i.currentQuantity + '">' + escapeHtml(i.name) + ' — ' + sbFormatMoney(price) + ' (' + i.currentQuantity + ' in stock)</option>';
  }).join('');
  if (current) select.value = current;
}

async function addSaleLine() {
  await ensureSaleItemsLoaded();
  var container = document.getElementById('sale-lines');
  var row = document.createElement('div');
  row.style.display = 'grid';
  row.style.gridTemplateColumns = '1fr 70px 32px';
  row.style.gap = '8px';
  row.style.marginBottom = '6px';
  row.innerHTML =
    '<select class="input sale-item-select"></select>' +
    '<input type="number" min="1" value="1" class="input sale-qty">' +
    '<button type="button" class="btn btn-ghost btn-sm sale-remove-line">&times;</button>';
  container.appendChild(row);
  populateSaleItemSelect(row.querySelector('.sale-item-select'));
  row.querySelector('.sale-item-select').addEventListener('change', updateSaleTotal);
  row.querySelector('.sale-qty').addEventListener('input', updateSaleTotal);
  row.querySelector('.sale-remove-line').addEventListener('click', function () { row.remove(); updateSaleTotal(); });
  updateSaleTotal();
}

function updateSaleTotal() {
  var total = 0;
  document.querySelectorAll('#sale-lines > div').forEach(function (row) {
    var sel = row.querySelector('.sale-item-select');
    var qty = Number(row.querySelector('.sale-qty').value) || 0;
    var opt = sel.options[sel.selectedIndex];
    var price = opt ? Number(opt.dataset.price || 0) : 0;
    total += price * qty;
  });
  var totalEl = document.getElementById('sale-total');
  if (totalEl) totalEl.textContent = 'Total: ' + sbFormatMoney(total);
}

async function submitProductSale() {
  var errorEl = document.getElementById('sale-error');
  errorEl.style.display = 'none';

  var lines = [];
  document.querySelectorAll('#sale-lines > div').forEach(function (row) {
    var sel = row.querySelector('.sale-item-select');
    var qty = Number(row.querySelector('.sale-qty').value) || 0;
    if (sel.value && qty > 0) lines.push({ itemId: sel.value, quantity: qty });
  });

  if (!lines.length) {
    errorEl.textContent = 'Add at least one product.';
    errorEl.style.display = '';
    return;
  }

  var payload = {
    items: lines,
    customerName: document.getElementById('sale-customer-name').value.trim() || undefined,
    customerPhone: document.getElementById('sale-customer-phone').value.trim() || undefined,
  };

  var btn = document.getElementById('btn-submit-sale');
  btn.disabled = true;
  try {
    await ProductSalesSelf.create(payload);
    document.getElementById('sale-lines').innerHTML = '';
    document.getElementById('sale-customer-name').value = '';
    document.getElementById('sale-customer-phone').value = '';
    saleItemsCache = null; // stock levels changed — force a fresh fetch next time
    updateSaleTotal();
    await loadSalesData();
  } catch (err) {
    errorEl.textContent = err.message || 'Failed to record sale.';
    errorEl.style.display = '';
  } finally {
    btn.disabled = false;
  }
}

async function loadSalesData() {
  var statsEl = document.getElementById('sale-stats');
  var tbody = document.getElementById('sales-tbody');
  if (!statsEl || !tbody) return;

  try {
    var todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    var result = await ProductSalesSelf.getAll({ from: todayStart.toISOString() });
    var sales = result.data || result || [];

    var todayTotal = sales.reduce(function (sum, s) { return sum + Number(s.totalAmount || 0); }, 0);

    statsEl.innerHTML =
      '<div class="stat gold"><div class="stat-ico" style="background:rgba(157,130,72,.12)">💳</div>' +
      '<div class="stat-lbl">Today\'s Sales</div><div class="stat-val">' + sbFormatMoney(todayTotal) + '</div>' +
      '<div class="stat-delta neu">' + sales.length + ' sale' + (sales.length === 1 ? '' : 's') + '</div></div>';

    tbody.innerHTML = sales.length
      ? sales.map(function (s) {
        var itemsLabel = (s.items || []).map(function (line) {
          return (line.item ? line.item.name : '—') + ' ×' + line.quantity;
        }).join(', ');
        return '<tr>' +
          '<td class="text-secondary small">' + new Date(s.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + '</td>' +
          '<td>' + escapeHtml(s.customerName || '—') + '</td>' +
          '<td class="text-secondary small">' + escapeHtml(itemsLabel || '—') + '</td>' +
          '<td>' + escapeHtml(s.soldBy ? s.soldBy.name : '—') + '</td>' +
          '<td style="font-weight:700">' + sbFormatMoney(s.totalAmount) + '</td>' +
          '</tr>';
      }).join('')
      : '<tr><td colspan="5" class="text-center text-secondary py-4">No sales yet today.</td></tr>';
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center text-danger py-4">' + escapeHtml(err.message || 'Failed to load.') + '</td></tr>';
  }
}

// -- Small helpers --

function setText(el, text) {
  if (el) el.textContent = text;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

function statusLabel(status) {
  const map = { ACTIVE: 'Active Employee', ON_LEAVE: 'On Leave', SUSPENDED: 'Suspended', EXITED: 'Exited', ARCHIVED: 'Archived' };
  return map[status] || status || 'Unknown';
}

function statusBadgeClass(status) {
  const map = { ACTIVE: 'b-green', ON_LEAVE: 'b-amber', SUSPENDED: 'b-red', EXITED: 'b-gray', ARCHIVED: 'b-gray' };
  return map[status] || 'b-gray';
}

// -- Boot --
document.addEventListener('DOMContentLoaded', () => {
  initStaffPortal();
});