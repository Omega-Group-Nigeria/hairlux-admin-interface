/**
 * staff-portal-app.js — wires staff-portal.html screens to real data.
 * Depends on auth.js and api-utils/staff-self.js being loaded first.
 */

let currentStaff = null;
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
    loadCompensation(),
  ]);

  renderDashboard();
  renderOnboardingStatusStrip();
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
      previewHtml +=
        '<div class="banner"><div class="tag">\uD83D\uDCE2 Management \u2014 ' +
        (topAnnouncement.target === 'ALL' ? 'All Staff' : topAnnouncement.target === 'BRANCH' ? 'Your Branch' : 'You') +
        '</div><h3>' + escapeHtml(topAnnouncement.title) + '</h3><p>' + escapeHtml(topAnnouncement.body) + '</p>' +
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
    const input = document.querySelector('#inventory input.input[placeholder*="Argan"]');
    if (input) input.focus();
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

// -- Onboarding + Verification checklist (Profile) -----------------------------

async function loadOnboarding() {
  try {
    currentOnboarding = await StaffSelf.getOnboarding();
    console.log('[staff-portal] onboarding loaded:', currentOnboarding);
  } catch (err) {
    console.error('Failed to load onboarding', err);
    return;
  }
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
}

function renderVerificationChecklist() {
  if (!currentOnboarding) return;

  const rows = currentOnboarding.items
    .filter((i) => i.type !== 'POLICY_ACKNOWLEDGMENT')
    .map((item) => {
      const label = ONBOARDING_ITEM_LABELS[item.type] || item.type;

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
      return (
        '<div class="banner" data-announcement-id="' + a.id + '" ' +
        (a.isRead ? '' : 'style="border-color:var(--gold)"') + '>' +
        '<div class="tag">\uD83D\uDCE2 ' + targetLabel + (a.isRead ? '' : ' \u00B7 New') + '</div>' +
        '<h3>' + escapeHtml(a.title) + '</h3>' +
        '<p>' + escapeHtml(a.body) + '</p>' +
        '<div class="meta">From: ' + escapeHtml(fromName) + ' \u00B7 ' + StaffSelf.timeAgo(a.createdAt) + '</div>' +
        '</div>'
      );
    })
    .join('');

  announcements.filter((a) => !a.isRead).forEach((a) => StaffSelf.markAnnouncementRead(a.id).catch(() => { }));
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
}

function directiveRow(d) {
  const fromName = d.createdBy ? [d.createdBy.firstName, d.createdBy.lastName].filter(Boolean).join(' ') : 'Management';
  if (d.status === 'COMPLETED') {
    return (
      '<div class="task done"><div class="task-chk checked">\u2713</div><div style="flex:1">' +
      '<div class="task-title" style="text-decoration:line-through;opacity:.5">' + escapeHtml(d.title) + '</div>' +
      '<div class="task-due">Completed ' + StaffSelf.formatDate(d.respondedAt) + '</div></div></div>'
    );
  }
  const nextAction = d.status === 'PENDING'
    ? '<button class="btn btn-ghost btn-sm" onclick="handleDirectiveStatus(\'' + d.id + '\',\'ACKNOWLEDGED\')">Acknowledge</button>'
    : '<button class="btn btn-gold btn-sm" onclick="handleDirectiveStatus(\'' + d.id + '\',\'COMPLETED\')">Mark Done</button>';
  return (
    '<div class="task' + (d.status === 'PENDING' ? ' urgent' : '') + '"><div class="task-chk">' + (d.status === 'PENDING' ? '!' : '\u2192') + '</div>' +
    '<div style="flex:1"><div class="task-title">' + escapeHtml(d.title) + '</div>' +
    '<div class="task-due">' + escapeHtml(d.body) + ' \u00B7 From ' + escapeHtml(fromName) + '</div></div>' +
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

// -- Attendance --

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
        const status = !r.checkOutAt
          ? '<span class="badge b-amber">Open</span>'
          : '<span class="badge b-green">Present</span>';
        const hours = r.checkOutAt
          ? (((new Date(r.checkOutAt) - new Date(r.checkInAt)) / 3600000).toFixed(1))
          : '\u2014';
        return (
          '<tr><td>' + StaffSelf.formatDate(r.date, { day: '2-digit', month: 'short' }) + '</td><td>' + day + '</td>' +
          '<td>' + StaffSelf.formatTime(r.checkInAt) + '</td><td>' + (r.checkOutAt ? StaffSelf.formatTime(r.checkOutAt) : '\u2014') + '</td>' +
          '<td>' + hours + '</td><td>' + status + '</td></tr>'
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
  const btn = document.getElementById('attendance-toggle-btn');
  const st = document.querySelectorAll('#attendance .info-item .val')[0];
  const originalText = btn ? btn.textContent : '';

  if (btn) {
    btn.disabled = true;
    btn.textContent = '…';
  }

  try {
    if (checkedInToday) {
      await StaffSelf.checkOut();
    } else {
      await StaffSelf.checkIn();
    }
    await loadAttendance();
    renderDashboard();
  } catch (err) {
    alert(err.message);
    if (btn) {
      btn.disabled = false;
      btn.textContent = originalText;
    }
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

function sbFormatMoney(amount) {
  if (amount == null) return '—';
  return '₦' + Number(amount).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function loadSalonBookings() {
  var container = document.getElementById('bookings-list-container');
  try {
    var result = await SalonBookingsSelf.getAll({ limit: 30 });
    var bookings = result.data || [];
    if (!bookings.length) {
      container.innerHTML = '<div class="text-secondary small py-3">No bookings yet for your branch.</div>';
      return;
    }
    container.innerHTML = '<div class="tbl-wrap"><table><thead><tr>' +
      '<th>Date / Time</th><th>Customer</th><th>Stylist</th><th>Services</th><th>Total</th><th>Status</th><th></th>' +
      '</tr></thead><tbody>' +
      bookings.map(function (b, idx) {
        var services = (b.services || []).map(function (s) { return escapeHtml(s.service ? s.service.name : ''); }).join(', ');
        return '<tr>' +
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
    container.querySelectorAll('.btn-sb-no-show').forEach(function (btn) { btn.addEventListener('click', function () { sbNoShow(btn.dataset.id); }); });
  } catch (err) {
    container.innerHTML = '<div class="text-danger small py-3">' + err.message + '</div>';
  }
}

function sbActionsHtml(b) {
  if (b.status === 'SCHEDULED') {
    return '<button class="btn btn-gold btn-sm me-1 btn-sb-start" data-id="' + b.id + '">Start</button>' +
      '<button class="btn btn-ghost btn-sm me-1 btn-sb-cancel" data-id="' + b.id + '">Cancel</button>' +
      '<button class="btn btn-ghost btn-sm btn-sb-no-show" data-id="' + b.id + '">No-Show</button>';
  }
  if (b.status === 'IN_PROGRESS') {
    return '<button class="btn btn-gold btn-sm me-1 btn-sb-complete" data-id="' + b.id + '">Complete</button>' +
      '<button class="btn btn-ghost btn-sm btn-sb-cancel" data-id="' + b.id + '">Cancel</button>';
  }
  return '';
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
  try { await SalonBookingsSelf.cancel(id, reason); await loadSalonBookings(); } catch (err) { alert(err.message); }
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
      var res = await Auth.fetch('/services?status=ACTIVE');
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
    '<div class="row g-2 mb-3">' +
    '<div class="col-6"><label class="form-label small mb-1">Customer Name</label>' +
    '<input type="text" class="input" id="sb-customer-name" placeholder="Ngozi Adeyemi"></div>' +
    '<div class="col-6"><label class="form-label small mb-1">Customer Phone (optional)</label>' +
    '<input type="text" class="input" id="sb-customer-phone" placeholder="+2348012345678"></div>' +
    '<div class="col-6"><label class="form-label small mb-1">Assigned Stylist</label>' +
    '<select class="input" id="sb-staff">' + staffOptions + '</select></div>' +
    '<div class="col-6"></div>' +
    '<div class="col-6"><label class="form-label small mb-1">Date</label>' +
    '<input type="date" class="input" id="sb-date" value="' + new Date().toISOString().slice(0, 10) + '"></div>' +
    '<div class="col-6"><label class="form-label small mb-1">Time</label>' +
    '<input type="time" class="input" id="sb-time"></div>' +
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
  sbAddServiceLine();
}

function cancelBookingForm() {
  document.getElementById('booking-form-container').style.display = 'none';
  document.getElementById('booking-form-container').innerHTML = '';
}

function sbAddServiceLine() {
  var container = document.getElementById('sb-service-lines');
  var row = document.createElement('div');
  row.style.display = 'grid';
  row.style.gridTemplateColumns = '1fr 70px 32px';
  row.style.gap = '8px';
  row.style.marginBottom = '6px';
  var options = '<option value="">Select service…</option>' + sbServicesCache.map(function (s) {
    return '<option value="' + s.id + '" data-price="' + s.walkInPrice + '">' + escapeHtml(s.name) + ' — ' + sbFormatMoney(s.walkInPrice) + '</option>';
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

async function loadCompensation() {
  var container = document.getElementById('comp-content');
  try {
    var result = await StaffSelf.getCompensation();
    var comp = result.data || result;

    if (!comp) {
      container.innerHTML = '<div class="text-secondary small">No compensation record found — this may apply to staff added before the recruitment system was in use.</div>';
      return;
    }

    var effectiveDateStr = comp.effectiveDate ? StaffSelf.formatDate(comp.effectiveDate) : '—';

    container.innerHTML =
      '<div class="g2">' +
      '<div class="stat green"><div class="stat-lbl">Base Salary</div><div class="stat-val">\u20a6' + Number(comp.baseSalary).toLocaleString() + '</div><div class="stat-delta neu">Monthly</div></div>' +
      (comp.allowances
        ? '<div class="stat gold"><div class="stat-lbl">Allowances</div><div class="stat-val">\u20a6' + Number(comp.allowances).toLocaleString() + '</div><div class="stat-delta neu">Monthly</div></div>'
        : '<div class="stat"><div class="stat-lbl">Allowances</div><div class="stat-val">\u2014</div></div>') +
      '</div>' +
      (comp.compensationNote ? '<div class="text-secondary small mt3">' + escapeHtml(comp.compensationNote) + '</div>' : '') +
      '<div class="text-secondary small mt3">Effective from ' + effectiveDateStr + ' \u00b7 ' + escapeHtml(comp.role || '') + '</div>';
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