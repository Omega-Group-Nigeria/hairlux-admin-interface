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
  ]);

  renderDashboard();
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

  announcements.filter((a) => !a.isRead).forEach((a) => StaffSelf.markAnnouncementRead(a.id).catch(() => {}));
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
  }
}

// -- Inventory --

async function loadInventoryDashboard() {
  let totals;
  try {
    totals = await StaffSelf.getInventoryDashboard();
    console.log('[staff-portal] inventory dashboard loaded:', totals);
  } catch (err) {
    console.error('Failed to load inventory dashboard', err);
    return;
  }

  const LOW_STOCK_THRESHOLD = 5;
  const outOfStock = totals.filter((t) => t.total <= 0).length;
  const lowStock = totals.filter((t) => t.total > 0 && t.total <= LOW_STOCK_THRESHOLD).length;
  const healthy = totals.length - outOfStock - lowStock;

  const statEls = document.querySelectorAll('#inventory .g4 .stat-val');
  if (statEls[0]) statEls[0].textContent = String(totals.length);
  if (statEls[1]) statEls[1].textContent = String(healthy);
  if (statEls[2]) statEls[2].textContent = String(lowStock);
  if (statEls[3]) statEls[3].textContent = String(outOfStock);

  const alertCard = document.querySelectorAll('#inventory .g2 .card')[1];
  if (alertCard) {
    const badge = alertCard.querySelector('.card-h .badge');
    const body = alertCard.querySelector('.card-b');
    const critical = totals.filter((t) => t.total <= LOW_STOCK_THRESHOLD).sort((a, b) => a.total - b.total);
    if (badge) badge.textContent = critical.length + ' critical';
    if (body) {
      const bars = critical
        .slice(0, 6)
        .map((t) => {
          const pct = Math.max(0, Math.min(100, (t.total / 50) * 100));
          const cls = t.total <= 0 ? 'lo' : 'md';
          const color = t.total <= 0 ? 'var(--red)' : 'var(--amber)';
          return (
            '<div class="inv-bar"><div class="inv-name">' + escapeHtml(t.productName) + '</div>' +
            '<div class="inv-fill ' + cls + '"><span style="width:' + pct + '%"></span></div>' +
            '<span style="font-size:11px;color:' + color + ';font-weight:700;min-width:50px;text-align:right">' +
            (t.total <= 0 ? 'OUT' : t.total + ' left') + '</span></div>'
          );
        })
        .join('');
      body.innerHTML = (bars || '<div style="color:var(--muted);font-size:13px">No low-stock items \u2014 nice work.</div>') +
        '<button class="btn btn-ghost btn-sm mt3" style="width:100%" onclick="show(\'inventory\')">Refresh</button>';
    }
  }

  const table = document.querySelectorAll('#inventory table tbody')[0];
  if (table) {
    table.innerHTML = totals
      .sort((a, b) => a.productName.localeCompare(b.productName))
      .map((t) => {
        const statusBadge =
          t.total <= 0 ? '<span class="badge b-red">Out of Stock</span>' :
          t.total <= LOW_STOCK_THRESHOLD ? '<span class="badge b-amber">Low</span>' :
          '<span class="badge b-green">Good</span>';
        return (
          '<tr><td style="font-weight:600;color:var(--white)">' + escapeHtml(t.productName) + '</td><td>\u2014</td>' +
          '<td>' + t.total + ' units</td><td>\u2014</td><td>' + statusBadge + '</td>' +
          '<td><button class="btn btn-ghost btn-sm" onclick="show(\'inventory\')">Details</button></td></tr>'
        );
      })
      .join('') || '<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:24px">No inventory logged yet.</td></tr>';
  }
}

function wireInventoryForm() {
  const form = document.querySelector('#inventory .g2 .card:first-child .card-b');
  if (!form || form.dataset.wired) return;
  form.dataset.wired = '1';

  const nameInput = form.querySelector('input.input[placeholder*="Argan"]');
  const qtyInput = form.querySelector('input[type="number"]');
  const typeSelect = form.querySelector('select.input');
  const noteInput = form.querySelectorAll('input.input')[form.querySelectorAll('input.input').length - 1];
  const submitBtn = form.querySelector('button.btn-gold');

  if (submitBtn) {
    submitBtn.addEventListener('click', async () => {
      const productName = (nameInput?.value || '').trim();
      const quantity = parseInt(qtyInput?.value, 10);
      const typeRaw = (typeSelect?.value || '').toUpperCase();
      const type = typeRaw.includes('RECEIVED') ? 'RECEIVED' : 'SOLD';

      if (!productName || !quantity || quantity < 1) {
        alert('Please enter an item name and a valid quantity.');
        return;
      }

      submitBtn.disabled = true;
      try {
        await StaffSelf.logInventoryEntry({
          productName,
          type,
          quantity,
          note: (noteInput?.value || '').trim() || undefined,
        });
        if (nameInput) nameInput.value = '';
        if (qtyInput) qtyInput.value = '';
        if (noteInput) noteInput.value = '';
        await loadInventoryDashboard();
      } catch (err) {
        alert('Could not log entry: ' + err.message);
      } finally {
        submitBtn.disabled = false;
      }
    });
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
  wireInventoryForm();
});