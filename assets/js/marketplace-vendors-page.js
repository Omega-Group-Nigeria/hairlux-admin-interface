/**
 * Marketplace Vendors page (marketplace-vendors.html).
 * Review vendors who registered on the vendor site: their business details,
 * KYC documents (every view is logged), owner NIN check, payout accounts,
 * decisions (approve, request changes, reject, suspend, reinstate),
 * commission and internal notes.
 * Requires: auth.js, rbac.js, marketplace.js, tabler.min.js
 */
(function () {
    'use strict';

    var bootstrap = window.tabler.bootstrap;
    var P = {
        read: 'marketplace:read',
        review: 'marketplace:review_vendors',
        docs: 'marketplace:view_documents',
        settings: 'marketplace:manage_settings',
    };

    var STATUS = {
        DRAFT: { label: 'Still registering', cls: 'bg-secondary-lt' },
        PENDING_REVIEW: { label: 'Waiting for review', cls: 'bg-yellow-lt' },
        CHANGES_REQUESTED: { label: 'Changes requested', cls: 'bg-orange-lt' },
        APPROVED: { label: 'Approved', cls: 'bg-green-lt' },
        REJECTED: { label: 'Rejected', cls: 'bg-red-lt' },
        SUSPENDED: { label: 'Suspended', cls: 'bg-red' },
    };
    var NIN = {
        NOT_CHECKED: { label: 'Not checked', cls: 'bg-secondary-lt' },
        VERIFIED: { label: 'Matched', cls: 'bg-green-lt' },
        MISMATCH: { label: 'Did not match', cls: 'bg-red-lt' },
        ERROR: { label: 'Check failed', cls: 'bg-orange-lt' },
    };
    var DOC_TYPES = {
        CAC_CERTIFICATE: 'CAC certificate', OWNER_ID: "Owner's government ID", SHOP_PHOTO: 'Shop photo',
        PROOF_OF_ADDRESS: 'Proof of address', OTHER: 'Other',
    };
    var DOC_STATUS = { PENDING: 'bg-yellow-lt', ACCEPTED: 'bg-green-lt', REJECTED: 'bg-red-lt' };
    var BUSINESS_TYPES = {
        SOLE_PROPRIETOR: 'Sole proprietor (not registered)', BUSINESS_NAME: 'Registered business name (BN)',
        LIMITED_COMPANY: 'Limited company (RC)', OTHER: 'Other',
    };
    var FLAGS = {
        BANK_NAME_MISMATCH: 'Bank account name does not match the business or owner',
        PAYOUT_ACCOUNT_CHANGED_AFTER_APPROVAL: 'Payout account changed after approval',
        NIN_MISMATCH: "Owner's NIN did not match the owner's name",
    };

    var _status = 'PENDING_REVIEW';
    var _page = 1;
    var _limit = 25;
    var _meta = null;
    var _searchTimer = null;
    var _vendor = null;
    var _decision = null; // { kind: 'vendor' | 'doc', action, docId }

    function $(id) { return document.getElementById(id); }
    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }
    function can(p) { return RBAC.can(p); }
    function badge(map, key) {
        var m = map[key] || { label: key, cls: 'bg-secondary-lt' };
        return '<span class="badge ' + m.cls + '">' + esc(m.label) + '</span>';
    }
    function fmtDate(v) {
        if (!v) return '-';
        return new Date(v).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    }
    function fmtDateTime(v) {
        if (!v) return '-';
        return new Date(v).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    }
    function waited(hours) {
        if (hours === null || hours === undefined) return '';
        if (hours < 1) return 'under an hour';
        if (hours < 48) return hours + ' hour' + (hours === 1 ? '' : 's');
        return Math.floor(hours / 24) + ' days';
    }
    function showAlert(msg, type) {
        $('page-alert').innerHTML = msg ? '<div class="alert alert-' + (type || 'danger') + ' alert-dismissible">' + esc(msg) +
            '<a class="btn-close" data-bs-dismiss="alert"></a></div>' : '';
    }
    function kb(n) { return n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'; }

    // ── Summary and list ────────────────────────────────────────────────────

    async function loadSummary() {
        try {
            var s = await Marketplace.summary();
            $('kpi-pending').textContent = s.pendingVendors;
            var late = s.oldestVendorWaitingHours !== null && s.oldestVendorWaitingHours > s.reviewSlaHours;
            $('kpi-pending-sub').innerHTML = s.oldestVendorWaitingHours === null ? 'Nothing waiting'
                : '<span class="' + (late ? 'text-danger fw-bold' : '') + '">Oldest waiting ' + esc(waited(s.oldestVendorWaitingHours)) + '</span> (target ' + s.reviewSlaHours + ' hours)';
            $('kpi-products').textContent = s.pendingProducts;
            $('kpi-approved').textContent = (s.vendors && s.vendors.APPROVED) || 0;
            $('kpi-approved-sub').textContent = ((s.vendors && s.vendors.SUSPENDED) || 0) + ' suspended';
            $('kpi-flagged').textContent = s.flaggedVendors;
        } catch (e) { /* the list still loads */ }
    }

    async function load() {
        $('vendors-tbody').innerHTML = '<tr><td colspan="9" class="text-center text-secondary py-5">Loading...</td></tr>';
        try {
            var res = await Marketplace.listVendors({
                status: _status || undefined, search: $('f-search').value.trim() || undefined,
                flagged: $('f-flagged').checked ? 'true' : undefined, page: _page, limit: _limit,
            });
            _meta = res.meta;
            render(res.data);
        } catch (e) {
            $('vendors-tbody').innerHTML = '<tr><td colspan="9" class="text-center text-danger py-5">' + esc(e.message) + '</td></tr>';
        }
    }

    function render(rows) {
        $('results-label').textContent = _meta.total + ' vendor' + (_meta.total === 1 ? '' : 's');
        $('page-label').textContent = _meta.totalPages > 1 ? 'Page ' + _meta.page + ' of ' + _meta.totalPages : '';
        $('btn-prev').disabled = _meta.page <= 1;
        $('btn-next').disabled = _meta.page >= _meta.totalPages;
        if (!rows.length) {
            $('vendors-tbody').innerHTML = '<tr><td colspan="9" class="text-center text-secondary py-5">No vendors here.</td></tr>';
            return;
        }
        $('vendors-tbody').innerHTML = rows.map(function (v) {
            var flags = v.riskFlags.length ? '<span class="badge bg-red-lt" title="' + esc(v.riskFlags.map(function (f) { return FLAGS[f] || f; }).join('\n')) + '">' + v.riskFlags.length + ' flag' + (v.riskFlags.length > 1 ? 's' : '') + '</span>' : '<span class="text-secondary">-</span>';
            var submitted = v.submittedAt ? fmtDate(v.submittedAt) + (v.waitingHours !== null ? '<div class="small text-secondary">waiting ' + esc(waited(v.waitingHours)) + '</div>' : '') : '<span class="text-secondary">Not yet</span>';
            return '<tr>' +
                '<td><div class="fw-semibold">' + esc(v.legalName) + '</div>' + (v.tradingName ? '<div class="small text-secondary">' + esc(v.tradingName) + '</div>' : '') + '</td>' +
                '<td><div>' + esc(v.owner.name) + '</div><div class="small text-secondary">' + esc(v.owner.email) + '</div></td>' +
                '<td>' + esc([v.city, v.state].filter(Boolean).join(', ') || '-') + '</td>' +
                '<td>' + badge(STATUS, v.status) + (v.status === 'APPROVED' ? '<div class="small text-secondary mt-1">' + (v.isLive ? 'Live' : 'Paused') + '</div>' : '') + '</td>' +
                '<td>' + badge(NIN, v.ownerNinStatus) + '</td>' +
                '<td>' + flags + '</td>' +
                '<td>' + submitted + '</td>' +
                '<td class="text-end">' + v.productCount + '</td>' +
                '<td class="text-end"><button class="btn btn-sm btn-primary" data-open="' + esc(v.id) + '">' + (v.status === 'PENDING_REVIEW' && can(P.review) ? 'Review' : 'View') + '</button></td>' +
                '</tr>';
        }).join('');
    }

    // ── Vendor details ──────────────────────────────────────────────────────

    async function openVendor(id) {
        $('vendor-title').textContent = 'Loading...';
        $('vendor-body').innerHTML = '<div class="text-center text-secondary py-5">Loading...</div>';
        $('vendor-footer').innerHTML = '';
        bootstrap.Modal.getOrCreateInstance($('modal-vendor')).show();
        try {
            _vendor = await Marketplace.getVendor(id);
            renderVendor();
        } catch (e) {
            $('vendor-body').innerHTML = '<div class="alert alert-danger">' + esc(e.message) + '</div>';
        }
    }

    function row(label, value) {
        return '<div class="col-sm-6 col-lg-4 mb-3"><div class="text-secondary small">' + esc(label) + '</div><div>' + (value === null || value === undefined || value === '' ? '<span class="text-secondary">-</span>' : value) + '</div></div>';
    }

    function renderVendor() {
        var v = _vendor;
        $('vendor-title').innerHTML = esc(v.legalName) + ' ' + badge(STATUS, v.status);
        var parts = [];

        if (v.statusReason && v.status !== 'APPROVED') {
            parts.push('<div class="alert alert-' + (v.status === 'SUSPENDED' || v.status === 'REJECTED' ? 'danger' : 'warning') + '"><strong>Last message to the vendor:</strong> ' + esc(v.statusReason) + '</div>');
        }
        if (v.riskFlags.length) {
            parts.push('<div class="alert alert-danger"><strong>Check before deciding:</strong><ul class="mb-0">' +
                v.riskFlags.map(function (f) { return '<li>' + esc(FLAGS[f] || f) + '</li>'; }).join('') + '</ul></div>');
        }

        // Application checklist
        var done = v.checklist.filter(function (c) { return c.done; }).length;
        parts.push('<h3 class="mb-2">Application <span class="text-secondary small fw-normal">' + done + ' of ' + v.checklist.length + ' complete</span></h3>' +
            '<div class="d-flex flex-wrap gap-2 mb-4">' + v.checklist.map(function (c) {
                return '<span class="badge ' + (c.done ? 'bg-green-lt' : 'bg-red-lt') + '">' + (c.done ? '&#10003; ' : '&#10007; ') + esc(c.label) + '</span>';
            }).join('') + '</div>');

        // Business
        parts.push('<h3 class="mb-2">Business</h3><div class="row">' +
            row('Business name', esc(v.legalName)) +
            row('Trading name', esc(v.tradingName)) +
            row('Business type', esc(BUSINESS_TYPES[v.businessType] || v.businessType)) +
            row('CAC number', esc(v.cacNumber)) +
            row('Business phone', esc(v.businessPhone)) +
            row('Business email', esc(v.businessEmail)) +
            row('Address', esc([v.address, v.city, v.state].filter(Boolean).join(', '))) +
            row('Sells', esc(v.categories.join(', '))) +
            row('Joined', fmtDate(v.createdAt)) +
            (v.description ? '<div class="col-12 mb-3"><div class="text-secondary small">About</div><div>' + esc(v.description) + '</div></div>' : '') +
            '</div>');

        // Owner and NIN
        var o = v.owner;
        var ninBtn = can(P.review) && v.ownerNin ? ' <button class="btn btn-sm btn-outline-primary ms-2" id="btn-check-nin">Check NIN with QoreID</button>' : '';
        parts.push('<h3 class="mb-2">Owner</h3><div class="row">' +
            row('Name', esc(o.firstName + ' ' + o.lastName)) +
            row('Email', esc(o.email) + ' ' + (o.emailVerified ? '<span class="badge bg-green-lt">verified</span>' : '<span class="badge bg-red-lt">not verified</span>')) +
            row('Phone', esc(o.phone) + ' ' + (o.phoneVerified ? '<span class="badge bg-green-lt">verified</span>' : '<span class="badge bg-red-lt">not verified</span>')) +
            '<div class="col-12 mb-3"><div class="text-secondary small">NIN</div><div class="d-flex align-items-center flex-wrap gap-2">' +
            '<span class="font-monospace">' + esc(v.ownerNin || '-') + '</span> ' + badge(NIN, v.ownerNinStatus) +
            (v.ownerNinCheckedAt ? '<span class="small text-secondary">checked ' + fmtDateTime(v.ownerNinCheckedAt) + '</span>' : '') + ninBtn +
            '</div><div class="form-hint">Checks the NIN against the owner\'s account name. Each check is a paid QoreID lookup.</div></div>' +
            '</div>');

        // Documents
        var docRows = v.documents.map(function (d) {
            var actions = [];
            if (can(P.docs)) actions.push('<button class="btn btn-sm" data-doc-view="' + d.id + '">Open</button>');
            if (can(P.review) && d.status !== 'ACCEPTED') actions.push('<button class="btn btn-sm btn-outline-success" data-doc-accept="' + d.id + '">Accept</button>');
            if (can(P.review) && d.status !== 'REJECTED') actions.push('<button class="btn btn-sm btn-outline-danger" data-doc-reject="' + d.id + '">Reject</button>');
            return '<tr><td>' + esc(DOC_TYPES[d.type] || d.type) + '</td><td>' + esc(d.fileName) + '<div class="small text-secondary">' + kb(d.sizeBytes) + ', ' + fmtDate(d.createdAt) + '</div></td>' +
                '<td><span class="badge ' + (DOC_STATUS[d.status] || '') + '">' + esc(d.status.toLowerCase()) + '</span>' + (d.reviewNote ? '<div class="small text-secondary">' + esc(d.reviewNote) + '</div>' : '') + '</td>' +
                '<td class="small">' + (can(P.docs) ? '<a href="#" data-doc-views="' + d.id + '">' + d.viewCount + ' view' + (d.viewCount === 1 ? '' : 's') + '</a>' : d.viewCount) + '</td>' +
                '<td class="text-end"><div class="btn-list justify-content-end">' + actions.join('') + '</div></td></tr>';
        }).join('');
        parts.push('<h3 class="mb-2">Documents</h3>' + (can(P.docs) ? '' : '<div class="text-secondary small mb-2">You need permission to open vendor documents.</div>') +
            '<div class="table-responsive mb-4"><table class="table table-sm table-vcenter"><thead><tr><th>Type</th><th>File</th><th>Status</th><th>Opened</th><th></th></tr></thead><tbody>' +
            (docRows || '<tr><td colspan="5" class="text-secondary">No documents uploaded.</td></tr>') + '</tbody></table></div><div id="doc-views-box"></div>');

        // Payout accounts
        var banks = v.bankAccounts.map(function (b) {
            return '<tr class="' + (b.isActive ? '' : 'text-secondary') + '"><td>' + esc(b.bankName) + '</td><td class="font-monospace">' + esc(b.accountNumber) + '</td><td>' + esc(b.accountName) +
                (b.nameMatchesBusiness ? '' : ' <span class="badge bg-red-lt">name does not match</span>') + '</td><td>' +
                (b.isActive ? (b.isDefault ? '<span class="badge bg-blue-lt">payouts go here</span>' : 'active') : 'removed') + '</td><td>' + fmtDate(b.createdAt) + '</td></tr>';
        }).join('');
        parts.push('<h3 class="mb-2">Payout accounts</h3><div class="text-secondary small mb-2">Only the vendor can add or change these. Names are checked with Paystack.</div>' +
            '<div class="table-responsive mb-4"><table class="table table-sm table-vcenter"><thead><tr><th>Bank</th><th>Account</th><th>Account name</th><th></th><th>Added</th></tr></thead><tbody>' +
            (banks || '<tr><td colspan="5" class="text-secondary">No payout account yet.</td></tr>') + '</tbody></table></div>');

        // Commission, agreement, notes
        var commission = v.commissionPercent === null ? 'Default (' + v.defaultCommissionPercent + '%)' : v.commissionPercent + '%';
        var commissionEdit = can(P.settings)
            ? '<div class="input-group input-group-sm mt-1" style="max-width:260px"><input type="number" class="form-control" id="f-commission" min="0" max="100" step="0.01" placeholder="Default ' + v.defaultCommissionPercent + '" value="' + (v.commissionPercent === null ? '' : v.commissionPercent) + '"><span class="input-group-text">%</span><button class="btn btn-outline-primary" id="btn-save-commission">Save</button></div><div class="form-hint">Leave empty to use the default.</div>'
            : '';
        parts.push('<h3 class="mb-2">Terms</h3><div class="row">' +
            row('Commission', esc(commission) + commissionEdit) +
            row('Vendor agreement', v.agreementAcceptedAt ? 'Version ' + esc(v.agreementVersion) + ', accepted ' + fmtDate(v.agreementAcceptedAt) + (v.agreementIsCurrent ? '' : ' <span class="badge bg-orange-lt">not the current version</span>') : '<span class="text-secondary">Not accepted</span>') +
            row('Listings', v.status === 'APPROVED' ? (v.isLive ? 'Live' : 'Paused by the vendor') : '-') +
            row('Products', Object.keys(v.products).length ? Object.keys(v.products).map(function (k) { return v.products[k] + ' ' + k.replace(/_/g, ' ').toLowerCase(); }).join(', ') + ' <a href="marketplace-products.html?sellerId=' + esc(v.id) + '">view</a>' : 'None yet') +
            '</div>');

        if (can(P.review)) {
            parts.push('<h3 class="mb-2">Internal notes</h3><div class="mb-2"><textarea class="form-control" id="f-admin-notes" rows="3" maxlength="4000" placeholder="Only Hairlux staff see this">' + esc(v.adminNotes || '') + '</textarea></div>' +
                '<div class="mb-2"><label class="form-label small text-secondary mb-1">Risk flags (comma separated, clear one once checked)</label><input class="form-control" id="f-risk-flags" value="' + esc(v.riskFlags.join(', ')) + '"></div>' +
                '<button class="btn btn-sm btn-outline-primary mb-4" id="btn-save-notes">Save notes and flags</button>');
        }

        // History
        parts.push('<h3 class="mb-2">History</h3><ul class="list-unstyled mb-0">' + v.history.map(function (h) {
            return '<li class="mb-2"><span class="text-secondary small">' + fmtDateTime(h.createdAt) + '</span> ' + badge(STATUS, h.toStatus) + ' <span class="small">' + esc(h.by) + '</span>' + (h.reason ? '<div class="small">' + esc(h.reason) + '</div>' : '') + '</li>';
        }).join('') + '</ul>');

        $('vendor-body').innerHTML = parts.join('');

        // Footer: decisions allowed from this status
        var actions = [];
        if (can(P.review)) {
            if (v.status === 'PENDING_REVIEW') {
                actions.push('<button class="btn btn-outline-danger" data-decide="REJECT">Reject</button>');
                actions.push('<button class="btn btn-outline-warning" data-decide="REQUEST_CHANGES">Request changes</button>');
                actions.push('<button class="btn btn-success" data-decide="APPROVE">Approve</button>');
            } else if (v.status === 'CHANGES_REQUESTED') {
                actions.push('<button class="btn btn-outline-danger" data-decide="REJECT">Reject</button>');
            } else if (v.status === 'APPROVED') {
                actions.push('<button class="btn btn-outline-danger" data-decide="SUSPEND">Suspend</button>');
            } else if (v.status === 'SUSPENDED') {
                actions.push('<button class="btn btn-success" data-decide="REINSTATE">Reinstate</button>');
            }
        }
        $('vendor-footer').innerHTML = '<button class="btn btn-link link-secondary me-auto" data-bs-dismiss="modal">Close</button>' + actions.join('');
    }

    // ── Decisions ───────────────────────────────────────────────────────────

    var DECISIONS = {
        APPROVE: { title: 'Approve vendor', help: 'The vendor can then add products. Every product is still reviewed before it goes on sale. Pending documents are marked accepted.', reason: 'Note (optional, shown to the vendor only if you override the NIN check)', btn: 'Approve', cls: 'btn-success', needsReason: false },
        REQUEST_CHANGES: { title: 'Request changes', help: 'The vendor can edit the application and submit it again.', reason: 'What needs to change', btn: 'Send back', cls: 'btn-warning', needsReason: true },
        REJECT: { title: 'Reject vendor', help: 'This is final: the vendor cannot submit this application again.', reason: 'Reason', btn: 'Reject', cls: 'btn-danger', needsReason: true },
        SUSPEND: { title: 'Suspend vendor', help: 'Their listings stop at once and they cannot add or edit products.', reason: 'Reason', btn: 'Suspend', cls: 'btn-danger', needsReason: true },
        REINSTATE: { title: 'Reinstate vendor', help: 'The vendor becomes approved again. Their listings stay paused until they turn Go live back on.', reason: 'Reason', btn: 'Reinstate', cls: 'btn-success', needsReason: true },
    };

    function openDecision(action) {
        var d = DECISIONS[action];
        _decision = { kind: 'vendor', action: action };
        $('decision-title').textContent = d.title;
        $('decision-help').textContent = d.help;
        $('decision-reason-label').textContent = d.reason;
        $('decision-reason').value = '';
        $('decision-error').hidden = true;
        var needsOverride = action === 'APPROVE' && _vendor.ownerNinStatus !== 'VERIFIED';
        $('decision-override-wrap').hidden = !needsOverride;
        $('decision-override').checked = false;
        $('decision-reason-hint').textContent = 'The vendor will see this in their email and on the vendor site.';
        var btn = $('btn-decision-confirm');
        btn.className = 'btn ' + d.cls;
        btn.textContent = d.btn;
        bootstrap.Modal.getOrCreateInstance($('modal-decision')).show();
    }

    function openDocReject(docId) {
        _decision = { kind: 'doc', action: 'REJECTED', docId: docId };
        $('decision-title').textContent = 'Reject document';
        $('decision-help').textContent = 'The vendor will be asked to upload a new one when you request changes.';
        $('decision-reason-label').textContent = 'What is wrong with it';
        $('decision-reason').value = '';
        $('decision-error').hidden = true;
        $('decision-override-wrap').hidden = true;
        $('decision-reason-hint').textContent = 'Shown to the vendor next to the document.';
        $('btn-decision-confirm').className = 'btn btn-danger';
        $('btn-decision-confirm').textContent = 'Reject document';
        bootstrap.Modal.getOrCreateInstance($('modal-decision')).show();
    }

    async function confirmDecision() {
        var reason = $('decision-reason').value.trim();
        var err = $('decision-error');
        err.hidden = true;
        var btn = $('btn-decision-confirm');
        try {
            btn.disabled = true;
            if (_decision.kind === 'doc') {
                if (!reason) throw new Error('Tell the vendor what is wrong with the document.');
                await Marketplace.reviewDocument(_vendor.id, _decision.docId, 'REJECTED', reason);
            } else {
                var d = DECISIONS[_decision.action];
                var override = !$('decision-override-wrap').hidden && $('decision-override').checked;
                if (d.needsReason && !reason) throw new Error('Give a reason. The vendor will see it.');
                if (_decision.action === 'APPROVE' && !$('decision-override-wrap').hidden) {
                    if (!override) throw new Error("Run the NIN check first, or tick the box to approve without a NIN match.");
                    if (!reason) throw new Error('Give the reason for approving without a NIN match.');
                }
                await Marketplace.decideVendor(_vendor.id, { action: _decision.action, reason: reason || undefined, overrideNinCheck: override || undefined });
                loadSummary();
                load();
                if (window.Layout && Layout.refreshMarketplaceBadge) Layout.refreshMarketplaceBadge();
            }
            bootstrap.Modal.getOrCreateInstance($('modal-decision')).hide();
            await openVendor(_vendor.id);
        } catch (e) {
            err.textContent = e.message;
            err.hidden = false;
        } finally {
            btn.disabled = false;
        }
    }

    // ── Body actions ────────────────────────────────────────────────────────

    async function onBodyClick(e) {
        var t = e.target.closest('button, a');
        if (!t) return;
        try {
            if (t.dataset.docView) {
                e.preventDefault();
                // Opened before the request so the browser does not block the new tab.
                var win = window.open('', '_blank');
                var link = await Marketplace.documentUrl(_vendor.id, t.dataset.docView);
                if (win) win.location = link.url; else window.location = link.url;
                _vendor = await Marketplace.getVendor(_vendor.id);
                renderVendor();
            } else if (t.dataset.docAccept) {
                await Marketplace.reviewDocument(_vendor.id, t.dataset.docAccept, 'ACCEPTED');
                await openVendor(_vendor.id);
            } else if (t.dataset.docReject) {
                openDocReject(t.dataset.docReject);
            } else if (t.dataset.docViews) {
                e.preventDefault();
                var views = await Marketplace.documentViews(_vendor.id, t.dataset.docViews);
                $('doc-views-box').innerHTML = '<div class="card card-sm mb-4"><div class="card-body small"><strong>Opened by</strong><ul class="mb-0">' +
                    (views.length ? views.map(function (x) { return '<li>' + esc(x.by) + (x.email ? ' (' + esc(x.email) + ')' : '') + ', ' + fmtDateTime(x.viewedAt) + '</li>'; }).join('') : '<li>Nobody yet</li>') + '</ul></div></div>';
            } else if (t.id === 'btn-check-nin') {
                t.disabled = true;
                t.textContent = 'Checking...';
                var r = await Marketplace.verifyNin(_vendor.id);
                await openVendor(_vendor.id);
                showInModal(r.message, r.ownerNinStatus === 'VERIFIED' ? 'success' : 'warning');
            } else if (t.id === 'btn-save-commission') {
                var raw = $('f-commission').value.trim();
                await Marketplace.setCommission(_vendor.id, raw === '' ? null : Number(raw));
                await openVendor(_vendor.id);
                showInModal('Commission saved.', 'success');
            } else if (t.id === 'btn-save-notes') {
                await Marketplace.saveNotes(_vendor.id, {
                    adminNotes: $('f-admin-notes').value,
                    riskFlags: $('f-risk-flags').value.split(',').map(function (s) { return s.trim(); }).filter(Boolean),
                });
                await openVendor(_vendor.id);
                showInModal('Notes saved.', 'success');
                loadSummary();
            }
        } catch (err) {
            showInModal(err.message, 'danger');
        }
    }

    function showInModal(msg, type) {
        var box = document.createElement('div');
        box.className = 'alert alert-' + type + ' alert-dismissible';
        box.innerHTML = esc(msg) + '<a class="btn-close" data-bs-dismiss="alert"></a>';
        $('vendor-body').prepend(box);
        $('vendor-body').scrollTop = 0;
    }

    // ── Init ────────────────────────────────────────────────────────────────

    document.addEventListener('DOMContentLoaded', function () {
        if (!RBAC.applyPageGuard(P.read)) return;

        document.querySelectorAll('#status-tabs [data-status]').forEach(function (a) {
            a.addEventListener('click', function (e) {
                e.preventDefault();
                document.querySelectorAll('#status-tabs .nav-link').forEach(function (x) { x.classList.remove('active'); });
                a.classList.add('active');
                _status = a.dataset.status;
                _page = 1;
                load();
            });
        });
        $('f-search').addEventListener('input', function () {
            clearTimeout(_searchTimer);
            _searchTimer = setTimeout(function () { _page = 1; load(); }, 300);
        });
        $('f-flagged').addEventListener('change', function () { _page = 1; load(); });
        $('btn-prev').addEventListener('click', function () { if (_page > 1) { _page--; load(); } });
        $('btn-next').addEventListener('click', function () { if (_meta && _page < _meta.totalPages) { _page++; load(); } });
        $('vendors-tbody').addEventListener('click', function (e) {
            var b = e.target.closest('[data-open]');
            if (b) openVendor(b.dataset.open);
        });
        $('vendor-body').addEventListener('click', onBodyClick);
        $('vendor-footer').addEventListener('click', function (e) {
            var b = e.target.closest('[data-decide]');
            if (b) openDecision(b.dataset.decide);
        });
        $('btn-decision-confirm').addEventListener('click', confirmDecision);

        var open = new URLSearchParams(location.search).get('vendor');
        loadSummary();
        load();
        if (open) openVendor(open);
    });
})();
