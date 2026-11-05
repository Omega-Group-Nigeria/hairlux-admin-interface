/**
 * Company Property page (company-property.html): equipment and other company
 * items per branch, who has them, condition, transfers and history.
 * Requires: auth.js, rbac.js, api-utils/company-property.js, tabler.min.js
 */
(function () {
    'use strict';

    var CP = CompanyProperty;
    var bootstrap = window.tabler.bootstrap;
    var $ = function (id) { return document.getElementById(id); };
    var opts = { branches: [], allBranches: [], staff: [], suppliers: [] };
    var canManage = false;
    var current = null;     // the item open in the side panel
    var formSubmit = null;  // the open form's submit handler

    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }
    function money(n) { return n == null ? '-' : '₦' + Number(n).toLocaleString('en-NG', { maximumFractionDigits: 2 }); }
    function date(d) { return d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'; }
    function dateTime(d) { return d ? new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'; }
    function condBadge(c) { return '<span class="badge ' + (CP.CONDITION_BADGE[c] || 'bg-secondary-lt') + '">' + esc(CP.CONDITIONS[c] || c) + '</span>'; }
    function optionList(map, selected) {
        return Object.keys(map).map(function (k) { return '<option value="' + k + '"' + (k === selected ? ' selected' : '') + '>' + esc(map[k]) + '</option>'; }).join('');
    }
    function alertBox(msg, type) {
        $('page-alert').innerHTML = msg ? '<div class="alert alert-' + type + ' alert-dismissible">' + esc(msg) + '<a class="btn-close" data-bs-dismiss="alert"></a></div>' : '';
    }

    // ── Summary ────────────────────────────────────────────────────────────

    async function loadSummary() {
        try {
            var s = await CP.summary();
            $('sum-items').textContent = s.totals.items;
            $('sum-value').textContent = money(s.totals.value);
            $('sum-issued').textContent = s.totals.issued;
            $('sum-unconfirmed').textContent = s.totals.unconfirmed ? s.totals.unconfirmed + ' not yet confirmed by staff' : '';
            $('sum-notworking').textContent = s.totals.notWorking;
            $('sum-transit').textContent = s.totals.inTransit;
            $('transit-badge').textContent = s.totals.inTransit;
            $('transit-badge').classList.toggle('d-none', !s.totals.inTransit);
            $('branch-tbody').innerHTML = s.branches.length ? s.branches.map(function (b) {
                var n = function (v, cls) { return v ? '<span class="' + (cls || '') + '">' + v + '</span>' : '<span class="text-secondary">0</span>'; };
                return '<tr><td><a href="#" data-branch-filter="' + esc(b.branchId) + '">' + esc(b.branchName) + '</a></td>' +
                    '<td class="text-end">' + b.items + '</td><td class="text-end">' + money(b.value) + '</td><td class="text-end">' + n(b.issued) + '</td>' +
                    '<td class="text-end">' + n(b.conditions.NEEDS_REPAIR, 'text-warning') + '</td><td class="text-end">' + n(b.conditions.UNDER_REPAIR) + '</td>' +
                    '<td class="text-end">' + n(b.conditions.INOPERABLE, 'text-danger fw-bold') + '</td><td class="text-end">' + n(b.conditions.LOST, 'text-danger') + '</td>' +
                    '<td class="text-end">' + n(b.inTransit) + '</td></tr>';
            }).join('') : '<tr><td colspan="9" class="text-center text-secondary py-4">No company property recorded yet.</td></tr>';
        } catch (e) {
            $('branch-tbody').innerHTML = '<tr><td colspan="9" class="text-center text-danger py-4">' + esc(e.message) + '</td></tr>';
        }
    }

    // ── Items ──────────────────────────────────────────────────────────────

    async function loadItems() {
        $('items-tbody').innerHTML = '<tr><td colspan="7" class="text-center py-4"><div class="spinner-border text-primary"></div></td></tr>';
        try {
            var rows = await CP.list({
                search: $('f-search').value.trim(),
                branchId: $('f-branch').value,
                category: $('f-category').value,
                condition: $('f-condition').value,
                assigned: $('f-assigned').value,
                includeDisposed: $('f-disposed').checked ? 'true' : '',
            });
            $('items-count').textContent = rows.length + ' item' + (rows.length === 1 ? '' : 's');
            $('items-tbody').innerHTML = rows.length ? rows.map(function (a) {
                var who = a.assignedStaff
                    ? esc(a.assignedStaff.name) + (a.acknowledgedAt ? ' <span class="badge bg-success-lt">Confirmed</span>' : ' <span class="badge bg-warning-lt">Not confirmed</span>')
                    : '<span class="text-secondary">-</span>';
                return '<tr>' +
                    '<td class="text-nowrap fw-semibold">' + esc(a.assetTag) + '</td>' +
                    '<td>' + esc(a.name) + '<div class="small text-secondary">' + esc(CP.CATEGORIES[a.category] || a.category) + [a.brand, a.model].filter(Boolean).map(function (x) { return ' &middot; ' + esc(x); }).join('') + '</div></td>' +
                    '<td>' + esc(a.branch && a.branch.name) + (a.inTransit ? '<div class="small text-azure">In transit to ' + esc(a.inTransit.toBranch.name) + '</div>' : '') + '</td>' +
                    '<td>' + condBadge(a.condition) + '</td>' +
                    '<td>' + who + '</td>' +
                    '<td class="text-end">' + money(a.purchaseCost) + '</td>' +
                    '<td class="text-end"><button class="btn btn-sm" data-open="' + a.id + '">View</button></td></tr>';
            }).join('') : '<tr><td colspan="7" class="text-center text-secondary py-4">No items match.</td></tr>';
        } catch (e) {
            $('items-tbody').innerHTML = '<tr><td colspan="7" class="text-center text-danger py-4">' + esc(e.message) + '</td></tr>';
        }
    }

    // ── Item panel ─────────────────────────────────────────────────────────

    var EVENT_TEXT = {
        CREATED: function () { return 'Added'; },
        EDITED: function () { return 'Details edited'; },
        ASSIGNED: function (e) { return 'Issued to ' + esc(e.toValue); },
        ACKNOWLEDGED: function (e) { return esc(e.toValue) + ' confirmed receipt'; },
        RETURNED: function (e) { return 'Returned' + (e.fromValue ? ' by ' + esc(e.fromValue) : ''); },
        CONDITION: function (e) { return 'Condition: ' + esc(CP.CONDITIONS[e.fromValue] || e.fromValue) + ' &rarr; ' + esc(CP.CONDITIONS[e.toValue] || e.toValue); },
        TRANSFER_SENT: function (e) { return 'Sent from ' + esc(e.fromValue) + ' to ' + esc(e.toValue); },
        TRANSFER_RECEIVED: function (e) { return 'Received at ' + esc(e.toValue); },
        TRANSFER_CANCELLED: function (e) { return 'Transfer to ' + esc(e.toValue) + ' cancelled'; },
    };

    async function openItem(id) {
        $('oc-body').innerHTML = '<div class="text-center py-5"><div class="spinner-border text-primary"></div></div>';
        bootstrap.Offcanvas.getOrCreateInstance($('oc-asset')).show();
        try {
            var a = current = await CP.get(id);
            $('oc-title').textContent = a.assetTag + ': ' + a.name;
            var gone = a.condition === 'LOST' || a.condition === 'DISPOSED';
            var actions = !canManage ? '' : '<div class="d-flex flex-wrap gap-2 mb-3">' +
                '<button class="btn btn-sm" data-act="edit">Edit details</button>' +
                '<button class="btn btn-sm" data-act="condition">Change condition</button>' +
                (a.assignedStaff ? '<button class="btn btn-sm" data-act="return">Record return</button>'
                    : (!gone && !a.inTransit ? '<button class="btn btn-sm" data-act="assign">Issue to staff</button>' : '')) +
                (a.inTransit ? '<button class="btn btn-sm btn-primary" data-act="receive">Confirm received</button><button class="btn btn-sm btn-outline-danger" data-act="cancel-transfer">Cancel transfer</button>'
                    : (!gone && !a.assignedStaff ? '<button class="btn btn-sm" data-act="transfer">Send to another branch</button>' : '')) +
                '</div>';
            var row = function (k, v) { return '<dt class="col-5 text-secondary">' + k + '</dt><dd class="col-7">' + v + '</dd>'; };
            $('oc-body').innerHTML = actions +
                '<dl class="row small mb-3">' +
                row('Condition', condBadge(a.condition)) +
                row('Branch', esc(a.branch && a.branch.name) + (a.inTransit ? '<div class="text-azure">In transit to ' + esc(a.inTransit.toBranch.name) + ' since ' + date(a.inTransit.sentAt) + '</div>' : '')) +
                row('Issued to', a.assignedStaff
                    ? esc(a.assignedStaff.name) + ' (' + esc(a.assignedStaff.staffCode) + ')<div class="text-secondary">Since ' + date(a.assignedAt) + ' &middot; ' +
                    (a.acknowledgedAt ? 'confirmed ' + date(a.acknowledgedAt) : '<span class="text-warning">not yet confirmed in the Staff Portal</span>') + '</div>' +
                    (a.assignedStaff.employmentStatus !== 'ACTIVE' && a.assignedStaff.employmentStatus !== 'ON_LEAVE' ? '<div class="text-danger">Staff member is ' + esc(a.assignedStaff.employmentStatus.toLowerCase()) + ': recover this item</div>' : '')
                    : '<span class="text-secondary">Not issued</span>') +
                row('Category', esc(CP.CATEGORIES[a.category] || a.category)) +
                row('Brand / model', esc([a.brand, a.model].filter(Boolean).join(' ') || '-')) +
                row('Serial number', esc(a.serialNumber || '-')) +
                row('Purchase', money(a.purchaseCost) + ' &middot; ' + date(a.purchaseDate)) +
                row('Supplier', esc(a.supplier ? a.supplier.name : '-')) +
                row('Warranty ends', a.warrantyEndsAt ? date(a.warrantyEndsAt) + (new Date(a.warrantyEndsAt) < new Date() ? ' <span class="text-secondary">(expired)</span>' : '') : '-') +
                (a.notes ? row('Notes', esc(a.notes)) : '') +
                '</dl>' +
                '<div class="fw-semibold mb-2">History</div>' +
                '<div class="d-flex flex-column gap-2">' + a.events.map(function (e) {
                    var t = (EVENT_TEXT[e.type] || function () { return esc(e.type); })(e);
                    return '<div class="border-start border-2 ps-2"><div class="small fw-semibold">' + t + '</div>' +
                        (e.note ? '<div class="small">' + esc(e.note) + '</div>' : '') +
                        '<div class="small text-secondary">' + dateTime(e.createdAt) + (e.actorName ? ' &middot; ' + esc(e.actorName) : '') + '</div></div>';
                }).join('') + '</div>';
        } catch (e) {
            $('oc-body').innerHTML = '<div class="alert alert-danger">' + esc(e.message) + '</div>';
        }
    }

    // ── Forms ──────────────────────────────────────────────────────────────

    function field(col, label, html, hint, required) {
        return '<div class="' + col + '"><label class="form-label' + (required ? ' required' : '') + '">' + label + '</label>' + html + (hint ? '<div class="form-hint">' + hint + '</div>' : '') + '</div>';
    }
    function input(id, value, type, extra) { return '<input class="form-control" id="' + id + '" type="' + (type || 'text') + '" value="' + esc(value == null ? '' : value) + '" ' + (extra || '') + '>'; }
    function select(id, html) { return '<select class="form-select" id="' + id + '">' + html + '</select>'; }
    function val(id) { var el = $(id); return el ? el.value.trim() : ''; }

    function openForm(title, bodyHtml, submitLabel, onSubmit) {
        $('mf-title').textContent = title;
        $('mf-body').innerHTML = bodyHtml;
        $('mf-error').classList.add('d-none');
        $('mf-submit').textContent = submitLabel;
        formSubmit = onSubmit;
        bootstrap.Modal.getOrCreateInstance($('modal-form')).show();
    }

    function branchOptions(list, selected, blank) {
        return (blank ? '<option value="">' + blank + '</option>' : '') + list.map(function (b) {
            return '<option value="' + b.id + '"' + (b.id === selected ? ' selected' : '') + '>' + esc(b.name) + '</option>';
        }).join('');
    }

    function itemForm(a) {
        var isNew = !a;
        a = a || {};
        var supplierOpts = '<option value="">None</option>' + opts.suppliers.map(function (s) {
            return '<option value="' + s.id + '"' + (a.supplier && a.supplier.id === s.id ? ' selected' : '') + '>' + esc(s.name) + '</option>';
        }).join('');
        openForm(isNew ? 'Add company property' : 'Edit ' + a.assetTag,
            field('col-md-6', 'Name', input('mf-name', a.name, 'text', 'maxlength="150" placeholder="e.g. Hood hair dryer"'), null, true) +
            field('col-md-3', 'Category', select('mf-category', optionList(CP.CATEGORIES, a.category || 'EQUIPMENT')), null, true) +
            (isNew ? field('col-md-3', 'Branch', select('mf-branch', branchOptions(opts.branches, opts.branches.length === 1 ? opts.branches[0].id : '', 'Choose...')), null, true) : '') +
            field('col-md-4', 'Brand', input('mf-brand', a.brand, 'text', 'maxlength="80"')) +
            field('col-md-4', 'Model', input('mf-model', a.model, 'text', 'maxlength="80"')) +
            (isNew
                ? field('col-md-4', 'How many', input('mf-qty', 1, 'number', 'min="1" max="100"'), 'Identical items each get their own tag')
                : field('col-md-4', 'Serial number', input('mf-serial', a.serialNumber, 'text', 'maxlength="120"'))) +
            (isNew ? field('col-12', 'Serial number(s)', '<textarea class="form-control" id="mf-serials" rows="2" placeholder="One per line, in order (optional)"></textarea>') : '') +
            field('col-md-4', 'Purchase cost (per item)', input('mf-cost', a.purchaseCost, 'number', 'min="0" step="0.01"')) +
            field('col-md-4', 'Purchase date', input('mf-pdate', a.purchaseDate ? String(a.purchaseDate).slice(0, 10) : '', 'date')) +
            field('col-md-4', 'Warranty ends', input('mf-warranty', a.warrantyEndsAt ? String(a.warrantyEndsAt).slice(0, 10) : '', 'date')) +
            field('col-md-6', 'Supplier', select('mf-supplier', supplierOpts)) +
            (isNew ? field('col-md-6', 'Condition', select('mf-cond', optionList({ WORKING: 'Working', NEEDS_REPAIR: 'Needs repair', INOPERABLE: 'Inoperable' }, 'WORKING'))) : '') +
            field('col-12', 'Notes', '<textarea class="form-control" id="mf-notes" rows="2" maxlength="1000">' + esc(a.notes || '') + '</textarea>'),
            isNew ? 'Add' : 'Save',
            async function () {
                if (!val('mf-name')) throw new Error('Enter a name.');
                var body = {
                    name: val('mf-name'),
                    category: val('mf-category'),
                    brand: val('mf-brand') || null,
                    model: val('mf-model') || null,
                    purchaseCost: val('mf-cost') === '' ? null : Number(val('mf-cost')),
                    purchaseDate: val('mf-pdate') || null,
                    warrantyEndsAt: val('mf-warranty') || null,
                    supplierId: val('mf-supplier') || null,
                    notes: val('mf-notes') || null,
                };
                if (isNew) {
                    if (!val('mf-branch')) throw new Error('Choose the branch that holds it.');
                    body.branchId = val('mf-branch');
                    body.quantity = Math.max(1, Number(val('mf-qty')) || 1);
                    body.condition = val('mf-cond');
                    var serials = $('mf-serials').value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
                    if (body.quantity === 1) body.serialNumber = serials[0] || null; else if (serials.length) body.serialNumbers = serials;
                    var res = await CP.create(body);
                    alertBox(res.created ? res.created + ' items added: ' + res.assetTags.join(', ') : res.assetTag + ' added.', 'success');
                    return res.id;
                }
                body.serialNumber = val('mf-serial') || null;
                await CP.update(a.id, body);
                return a.id;
            });
    }

    function conditionForm(a) {
        var choices = {};
        Object.keys(CP.CONDITIONS).forEach(function (k) { if (k !== a.condition) choices[k] = CP.CONDITIONS[k]; });
        openForm('Change condition: ' + a.assetTag,
            '<div class="col-12 small text-secondary">Now: ' + condBadge(a.condition) + '</div>' +
            field('col-md-6', 'New condition', select('mf-cond', optionList(choices, a.condition === 'WORKING' ? 'INOPERABLE' : 'WORKING')), null, true) +
            field('col-12', 'Reason', '<textarea class="form-control" id="mf-reason" rows="3" maxlength="1000" placeholder="e.g. Motor burnt out; repair quoted at ₦25,000"></textarea>',
                'Kept in the item\'s history. Lost or disposed items are taken back from whoever has them.', true),
            'Save',
            async function () {
                if (!val('mf-reason')) throw new Error('Give the reason.');
                await CP.setCondition(a.id, { condition: val('mf-cond'), reason: val('mf-reason') });
                return a.id;
            });
    }

    function assignForm(a) {
        var staffOpts = '<option value="">Choose staff...</option>' + opts.staff.map(function (s) {
            var here = a.branch && s.locationId === a.branch.id;
            return '<option value="' + s.id + '">' + esc(s.name) + ' (' + esc(s.staffCode) + ')' + (here ? '' : ' - other branch') + '</option>';
        }).join('');
        openForm('Issue ' + a.assetTag + ' to staff',
            field('col-md-8', 'Staff member', select('mf-staff', staffOpts), 'They confirm receipt in the Staff Portal.', true) +
            field('col-12', 'Note', input('mf-note', '', 'text', 'maxlength="500" placeholder="Optional, e.g. with charger and case"')),
            'Issue',
            async function () {
                if (!val('mf-staff')) throw new Error('Choose a staff member.');
                await CP.assign(a.id, { staffId: val('mf-staff'), note: val('mf-note') || null });
                return a.id;
            });
    }

    function returnForm(a) {
        openForm('Record return: ' + a.assetTag,
            '<div class="col-12 small">Returned by <strong>' + esc(a.assignedStaff.name) + '</strong></div>' +
            field('col-md-6', 'Condition on return', select('mf-cond', optionList(CP.CONDITIONS, a.condition))) +
            field('col-12', 'Note', input('mf-note', '', 'text', 'maxlength="500" placeholder="Optional, e.g. returned on exit"')),
            'Record return',
            async function () {
                await CP.returnItem(a.id, { condition: val('mf-cond'), note: val('mf-note') || null });
                return a.id;
            });
    }

    function transferForm(a) {
        var targets = opts.allBranches.filter(function (b) { return !a.branch || b.id !== a.branch.id; });
        openForm('Send ' + a.assetTag + ' to another branch',
            '<div class="col-12 small text-secondary">From <strong>' + esc(a.branch && a.branch.name) + '</strong>. It stays there, marked in transit, until the receiving branch confirms it arrived.</div>' +
            field('col-md-6', 'To branch', select('mf-to', branchOptions(targets, '', 'Choose...')), null, true) +
            field('col-12', 'Reason', input('mf-reason', '', 'text', 'maxlength="500" placeholder="e.g. Lekki needs a second dryer"'), null, true),
            'Send',
            async function () {
                if (!val('mf-to')) throw new Error('Choose the branch.');
                if (!val('mf-reason')) throw new Error('Give the reason.');
                await CP.transfer(a.id, { toBranchId: val('mf-to'), reason: val('mf-reason') });
                return a.id;
            });
    }

    function closeTransferForm(transferId, assetId, receive, label) {
        openForm((receive ? 'Confirm received: ' : 'Cancel transfer: ') + label,
            field('col-12', 'Note', input('mf-note', '', 'text', 'maxlength="500" placeholder="' + (receive ? 'Optional, e.g. arrived in good condition' : 'Optional, why') + '"')),
            receive ? 'Confirm received' : 'Cancel transfer',
            async function () {
                if (receive) await CP.receive(transferId, { note: val('mf-note') || null });
                else await CP.cancelTransfer(transferId, { note: val('mf-note') || null });
                return assetId;
            });
    }

    async function submitForm() {
        var btn = $('mf-submit');
        btn.disabled = true;
        try {
            var id = await formSubmit();
            bootstrap.Modal.getInstance($('modal-form')).hide();
            await Promise.all([loadSummary(), loadItems(), loadTransfers()]);
            if (id) openItem(id);
        } catch (e) {
            $('mf-error').textContent = e.message;
            $('mf-error').classList.remove('d-none');
        } finally {
            btn.disabled = false;
        }
    }

    // ── Transfers ──────────────────────────────────────────────────────────

    async function loadTransfers() {
        try {
            var rows = await CP.transfers({ status: $('t-status').value });
            var STATUS = { IN_TRANSIT: 'bg-azure-lt', RECEIVED: 'bg-success-lt', CANCELLED: 'bg-secondary-lt' };
            $('transfers-tbody').innerHTML = rows.length ? rows.map(function (t) {
                var label = t.asset.assetTag + ' ' + t.asset.name;
                return '<tr><td><a href="#" data-open="' + t.asset.id + '">' + esc(t.asset.assetTag) + '</a><div class="small text-secondary">' + esc(t.asset.name) + '</div></td>' +
                    '<td>' + esc(t.fromBranch.name) + '</td><td>' + esc(t.toBranch.name) + '</td>' +
                    '<td class="small">' + esc(t.reason) + (t.closeNote ? '<div class="text-secondary">' + esc(t.closeNote) + '</div>' : '') + '</td>' +
                    '<td class="small">' + date(t.sentAt) + '<div class="text-secondary">' + esc(t.sentByName || '') + '</div></td>' +
                    '<td><span class="badge ' + (STATUS[t.status] || '') + '">' + esc(t.status.replace(/_/g, ' ').toLowerCase()) + '</span>' +
                    (t.closedAt ? '<div class="small text-secondary">' + date(t.closedAt) + (t.closedByName ? ' &middot; ' + esc(t.closedByName) : '') + '</div>' : '') + '</td>' +
                    '<td class="text-end text-nowrap">' + (canManage && t.status === 'IN_TRANSIT'
                        ? '<button class="btn btn-sm btn-primary" data-receive="' + t.id + '" data-asset="' + t.asset.id + '" data-label="' + esc(label) + '">Received</button> ' +
                        '<button class="btn btn-sm btn-outline-danger" data-cancel="' + t.id + '" data-asset="' + t.asset.id + '" data-label="' + esc(label) + '">Cancel</button>'
                        : '') + '</td></tr>';
            }).join('') : '<tr><td colspan="7" class="text-center text-secondary py-4">No transfers.</td></tr>';
        } catch (e) {
            $('transfers-tbody').innerHTML = '<tr><td colspan="7" class="text-center text-danger py-4">' + esc(e.message) + '</td></tr>';
        }
    }

    // ── Wiring ─────────────────────────────────────────────────────────────

    document.addEventListener('DOMContentLoaded', async function () {
        if (!RBAC.applyPageGuard('company_property:read')) return;
        canManage = RBAC.can('company_property:manage');
        if (canManage) $('btn-add-asset').classList.remove('d-none');

        $('f-category').innerHTML += optionList(CP.CATEGORIES, '');
        $('f-condition').innerHTML += optionList(CP.CONDITIONS, '');
        try {
            opts = await CP.options();
            $('f-branch').innerHTML += branchOptions(opts.branches, '');
        } catch (e) { alertBox(e.message, 'danger'); }

        var debounce;
        $('f-search').addEventListener('input', function () { clearTimeout(debounce); debounce = setTimeout(loadItems, 300); });
        ['f-branch', 'f-category', 'f-condition', 'f-assigned', 'f-disposed'].forEach(function (id) { $(id).addEventListener('change', loadItems); });
        $('t-status').addEventListener('change', loadTransfers);
        $('btn-add-asset').addEventListener('click', function () { itemForm(null); });
        $('mf-submit').addEventListener('click', submitForm);

        $('cp-tabs').addEventListener('click', function (e) {
            var tab = e.target.closest('[data-tab]');
            if (!tab) return;
            e.preventDefault();
            document.querySelectorAll('#cp-tabs .nav-link').forEach(function (t) { t.classList.toggle('active', t === tab); });
            $('tab-items').style.display = tab.dataset.tab === 'items' ? '' : 'none';
            $('tab-transfers').style.display = tab.dataset.tab === 'transfers' ? '' : 'none';
        });

        document.body.addEventListener('click', function (e) {
            var open = e.target.closest('[data-open]');
            if (open) { e.preventDefault(); openItem(open.dataset.open); return; }
            var bf = e.target.closest('[data-branch-filter]');
            if (bf) { e.preventDefault(); $('f-branch').value = bf.dataset.branchFilter; loadItems(); return; }
            var rec = e.target.closest('[data-receive]');
            if (rec) { closeTransferForm(rec.dataset.receive, rec.dataset.asset, true, rec.dataset.label); return; }
            var can = e.target.closest('[data-cancel]');
            if (can) { closeTransferForm(can.dataset.cancel, can.dataset.asset, false, can.dataset.label); return; }
            var act = e.target.closest('#oc-body [data-act]');
            if (act && current) {
                var a = current;
                var map = {
                    edit: function () { itemForm(a); },
                    condition: function () { conditionForm(a); },
                    assign: function () { assignForm(a); },
                    'return': function () { returnForm(a); },
                    transfer: function () { transferForm(a); },
                    receive: function () { closeTransferForm(a.inTransit.transferId, a.id, true, a.assetTag + ' ' + a.name); },
                    'cancel-transfer': function () { closeTransferForm(a.inTransit.transferId, a.id, false, a.assetTag + ' ' + a.name); },
                };
                if (map[act.dataset.act]) map[act.dataset.act]();
            }
        });

        loadSummary();
        loadItems();
        loadTransfers();
    });
})();
