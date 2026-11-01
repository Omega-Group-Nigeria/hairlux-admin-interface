/**
 * Marketplace Receiving Center page (marketplace-receiving.html), Phase 4.
 * Vendors bring stock here instead of shipping to customers.
 *  - Stock deliveries: count and inspect each one; accepted units go on sale.
 *  - Stock: what each vendor has on the shelf; correct counts.
 *  - Take-back requests: approve (stock comes off sale), reject, mark collected.
 *  - History: every change to vendor stock.
 * Requires: auth.js, rbac.js, marketplace.js, tabler.min.js
 */
(function () {
    'use strict';

    var bootstrap = window.tabler.bootstrap;
    var P = { read: 'marketplace:read', receive: 'marketplace:receive_stock' };
    var INTAKE = {
        SUBMITTED: { label: 'Expected', cls: 'bg-yellow-lt' },
        RECEIVED: { label: 'Received', cls: 'bg-green-lt' },
        CANCELLED: { label: 'Cancelled', cls: 'bg-secondary-lt' },
    };
    var WITHDRAWAL = {
        REQUESTED: { label: 'Requested', cls: 'bg-yellow-lt' },
        APPROVED: { label: 'Ready to collect', cls: 'bg-blue-lt' },
        COLLECTED: { label: 'Collected', cls: 'bg-green-lt' },
        REJECTED: { label: 'Rejected', cls: 'bg-red-lt' },
        CANCELLED: { label: 'Cancelled', cls: 'bg-secondary-lt' },
    };
    var MOVE = {
        INTAKE: { label: 'Received', cls: 'bg-green-lt' },
        SALE: { label: 'Sold', cls: 'bg-blue-lt' },
        SALE_CANCELLED: { label: 'Order cancelled', cls: 'bg-secondary-lt' },
        RETURN_RESTOCK: { label: 'Returned', cls: 'bg-secondary-lt' },
        WITHDRAWAL: { label: 'Taken back', cls: 'bg-yellow-lt' },
        WITHDRAWAL_REVERSED: { label: 'Take-back undone', cls: 'bg-secondary-lt' },
        ADJUSTMENT: { label: 'Correction', cls: 'bg-red-lt' },
    };
    var SUBS = {
        intakes: [['SUBMITTED', 'Expected'], ['RECEIVED', 'Received'], ['CANCELLED', 'Cancelled'], ['', 'All']],
        stock: [['', 'All'], ['low', 'Low or out']],
        withdrawals: [['REQUESTED', 'Requested'], ['APPROVED', 'Ready to collect'], ['COLLECTED', 'Collected'], ['', 'All']],
        history: [['', 'All'], ['INTAKE', 'Received'], ['SALE', 'Sold'], ['WITHDRAWAL', 'Taken back'], ['ADJUSTMENT', 'Corrections']],
    };
    var SEARCH = { intakes: 'Search delivery code or vendor', stock: 'Search product, SKU or vendor', withdrawals: '', history: '' };

    var _tab = 'intakes';
    var _sub = 'SUBMITTED';
    var _page = 1;
    var _meta = null;
    var _timer = null;
    var _product = null; // { id, name } when History is filtered to one product
    var _rows = [];
    var _formSubmit = null;

    function $(id) { return document.getElementById(id); }
    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }
    function badge(map, key) {
        var m = map[key] || { label: key, cls: 'bg-secondary-lt' };
        return '<span class="badge ' + m.cls + '">' + esc(m.label) + '</span>';
    }
    function fmtDate(v) { return v ? new Date(v).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'; }
    function fmtDateTime(v) { return v ? new Date(v).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-'; }
    function vendorName(s) { return s ? (s.tradingName || s.legalName) : '-'; }
    function alertBox(msg, type) {
        $('page-alert').innerHTML = '<div class="alert alert-' + (type || 'success') + ' alert-dismissible">' + esc(msg) + '<a class="btn-close" data-bs-dismiss="alert"></a></div>';
    }
    function canReceive() { return RBAC.can(P.receive); }

    // ------------------------------------------------------------- counts

    async function loadCounts() {
        try {
            var r = await Promise.all([
                Marketplace.rcIntakes({ status: 'SUBMITTED', limit: 1 }),
                Marketplace.rcStock({ low: 'true', limit: 1 }),
                Marketplace.rcWithdrawals({ status: 'REQUESTED', limit: 1 }),
                Marketplace.rcWithdrawals({ status: 'APPROVED', limit: 1 }),
            ]);
            $('c-expected').textContent = r[0].meta.total;
            $('c-low').textContent = r[1].meta.total;
            $('c-requests').textContent = r[2].meta.total;
            $('c-collect').textContent = r[3].meta.total;
        } catch (e) { /* the list still works */ }
    }

    // ------------------------------------------------------------- tabs

    function setTab(tab, sub) {
        _tab = tab;
        _sub = sub !== undefined ? sub : SUBS[tab][0][0];
        _page = 1;
        if (tab !== 'history') _product = null;
        document.querySelectorAll('#main-tabs .nav-link').forEach(function (a) { a.classList.toggle('active', a.dataset.tab === tab); });
        $('sub-filters').innerHTML = SUBS[tab].map(function (s) {
            return '<button type="button" class="btn btn-sm' + (s[0] === _sub ? ' btn-primary' : '') + '" data-sub="' + s[0] + '">' + esc(s[1]) + '</button>';
        }).join('');
        $('f-search').value = '';
        $('f-search').parentElement.classList.toggle('d-none', !SEARCH[tab]);
        $('f-search').placeholder = SEARCH[tab];
        load();
    }

    function setHead(cols) {
        $('list-head').innerHTML = '<tr>' + cols.map(function (c) { return '<th' + (c[1] ? ' class="' + c[1] + '"' : '') + '>' + esc(c[0]) + '</th>'; }).join('') + '</tr>';
        return cols.length;
    }

    async function load() {
        var span = { intakes: 6, stock: 6, withdrawals: 6, history: 6 }[_tab];
        $('list-body').innerHTML = '<tr><td colspan="' + span + '" class="text-center text-secondary py-5">Loading...</td></tr>';
        var search = $('f-search').value.trim() || undefined;
        try {
            var res;
            if (_tab === 'intakes') {
                res = await Marketplace.rcIntakes({ status: _sub || undefined, search: search, page: _page });
                renderIntakes(res);
            } else if (_tab === 'stock') {
                res = await Marketplace.rcStock({ low: _sub === 'low' ? 'true' : undefined, search: search, page: _page, limit: 50 });
                renderStock(res);
            } else if (_tab === 'withdrawals') {
                res = await Marketplace.rcWithdrawals({ status: _sub || undefined, page: _page });
                renderWithdrawals(res);
            } else {
                res = await Marketplace.rcMovements({ type: _sub || undefined, productId: _product ? _product.id : undefined, page: _page, limit: 50 });
                renderHistory(res);
            }
            _meta = res.meta;
            $('results-label').innerHTML = esc(_meta.total + ' result' + (_meta.total === 1 ? '' : 's')) +
                (_product ? ' for <strong>' + esc(_product.name) + '</strong> <a href="#" id="clear-product">(all products)</a>' : '');
            var cp = $('clear-product');
            if (cp) cp.addEventListener('click', function (e) { e.preventDefault(); _product = null; _page = 1; load(); });
            $('page-label').textContent = _meta.totalPages > 1 ? 'Page ' + _meta.page + ' of ' + _meta.totalPages : '';
            $('btn-prev').disabled = _meta.page <= 1;
            $('btn-next').disabled = _meta.page >= _meta.totalPages;
        } catch (e) {
            $('list-body').innerHTML = '<tr><td colspan="' + span + '" class="text-center text-danger py-4">' + esc(e.message) + '</td></tr>';
        }
    }

    function empty(cols, text) { return '<tr><td colspan="' + cols + '" class="text-center text-secondary py-5">' + esc(text) + '</td></tr>'; }

    // ------------------------------------------------------------- stock deliveries

    function renderIntakes(res) {
        _rows = res.data;
        var n = setHead([['Delivery'], ['Vendor'], ['Products'], ['Units', 'text-end'], ['Status'], ['']]);
        $('list-body').innerHTML = res.data.length ? res.data.map(function (d) {
            var units = d.status === 'RECEIVED'
                ? d.totals.accepted + ' accepted' + (d.totals.rejected ? '<div class="small text-danger">' + d.totals.rejected + ' rejected</div>' : '') + (d.totals.received < d.totals.expected ? '<div class="small text-warning">' + (d.totals.expected - d.totals.received) + ' short</div>' : '')
                : d.totals.expected + ' expected';
            var when = d.status === 'RECEIVED' ? 'Received ' + fmtDateTime(d.receivedAt) : d.expectedOn ? 'Expected ' + fmtDate(d.expectedOn) : 'Sent ' + fmtDateTime(d.createdAt);
            return '<tr><td><div class="fw-semibold">' + esc(d.code) + '</div><div class="small text-secondary">' + esc(when) + '</div></td>' +
                '<td><a href="marketplace-vendors.html?vendor=' + esc(d.seller.id) + '">' + esc(vendorName(d.seller)) + '</a>' + (d.seller.businessPhone ? '<div class="small text-secondary">' + esc(d.seller.businessPhone) + '</div>' : '') + '</td>' +
                '<td class="small" style="max-width:280px">' + esc(d.lines.map(function (l) { return l.expectedQuantity + ' x ' + l.product.name; }).join(', ')) + '</td>' +
                '<td class="text-end">' + units + '</td><td>' + badge(INTAKE, d.status) + '</td>' +
                '<td class="text-end"><button class="btn btn-sm' + (d.status === 'SUBMITTED' && canReceive() ? ' btn-primary' : '') + '" data-intake="' + esc(d.id) + '">' + (d.status === 'SUBMITTED' && canReceive() ? 'Receive' : 'View') + '</button></td></tr>';
        }).join('') : empty(n, _sub === 'SUBMITTED' ? 'No deliveries expected.' : 'No deliveries here.');
    }

    async function openIntake(id) {
        $('receive-body').innerHTML = '<div class="text-center py-5"><div class="spinner-border text-primary"></div></div>';
        $('receive-footer').innerHTML = '';
        bootstrap.Modal.getOrCreateInstance($('modal-receive')).show();
        try { renderIntake(await Marketplace.rcIntake(id)); }
        catch (e) { $('receive-body').innerHTML = '<div class="alert alert-danger">' + esc(e.message) + '</div>'; }
    }

    function renderIntake(d) {
        var receiving = d.status === 'SUBMITTED' && canReceive();
        $('receive-title').textContent = (receiving ? 'Receive ' : 'Stock delivery ') + d.code;
        var head = '<div class="d-flex justify-content-between align-items-start mb-3"><div>' + badge(INTAKE, d.status) +
            '<div class="small text-secondary mt-1">Sent ' + fmtDateTime(d.createdAt) + (d.expectedOn ? ' &middot; expected ' + fmtDate(d.expectedOn) : '') + '</div></div>' +
            '<div class="text-end small"><div class="fw-semibold">' + esc(vendorName(d.seller)) + '</div><div class="text-secondary">' + esc(d.seller.businessPhone || '') + '</div></div></div>' +
            (d.vendorNote ? '<div class="small mb-3"><span class="text-secondary">Vendor note:</span> ' + esc(d.vendorNote) + '</div>' : '') +
            (d.status === 'CANCELLED' ? '<div class="alert alert-secondary">Cancelled ' + fmtDateTime(d.cancelledAt) + ' by ' + (d.cancelledBy === 'ADMIN' ? 'Hairlux' : 'the vendor') + (d.cancelReason ? ': ' + esc(d.cancelReason) : '') + '</div>' : '');
        if (!receiving) {
            $('receive-body').innerHTML = head +
                '<div class="table-responsive"><table class="table table-sm"><thead><tr><th>Product</th><th class="text-end">Expected</th><th class="text-end">Arrived</th><th class="text-end">Accepted</th><th class="text-end">Rejected</th></tr></thead><tbody>' +
                d.lines.map(function (l) {
                    return '<tr><td>' + esc(l.product.name) + (l.product.sellerSku ? '<div class="small text-secondary">SKU ' + esc(l.product.sellerSku) + '</div>' : '') +
                        (l.rejectReason ? '<div class="small text-danger">' + esc(l.rejectReason) + '</div>' : '') + '</td><td class="text-end">' + l.expectedQuantity + '</td>' +
                        '<td class="text-end">' + (l.receivedQuantity == null ? '-' : l.receivedQuantity) + '</td><td class="text-end fw-semibold">' + (l.acceptedQuantity == null ? '-' : l.acceptedQuantity) + '</td><td class="text-end">' + (l.rejectedQuantity || '-') + '</td></tr>';
                }).join('') + '</tbody></table></div>' +
                (d.receivedNote ? '<div class="small"><span class="text-secondary">Receiving note:</span> ' + esc(d.receivedNote) + '</div>' : '') +
                (d.receivedAt ? '<div class="small text-secondary mt-2">Received ' + fmtDateTime(d.receivedAt) + '</div>' : '');
            $('receive-footer').innerHTML = '<button class="btn btn-link link-secondary me-auto" data-bs-dismiss="modal">Close</button>';
            return;
        }
        $('receive-body').innerHTML = head +
            '<p class="small text-secondary">Count what arrived and inspect it. Accepted units go on sale straight away. Hand rejected units (damaged, wrong item, expired) back to the vendor and say why; the vendor is emailed.</p>' +
            '<div class="table-responsive"><table class="table table-sm table-vcenter"><thead><tr><th>Product</th><th class="text-end">Expected</th><th style="width:100px">Arrived</th><th style="width:100px">Accepted</th><th>If rejected, why</th></tr></thead><tbody>' +
            d.lines.map(function (l) {
                return '<tr data-line="' + esc(l.id) + '"><td>' + esc(l.product.name) + (l.product.sellerSku ? '<div class="small text-secondary">SKU ' + esc(l.product.sellerSku) + '</div>' : '') + '</td>' +
                    '<td class="text-end">' + l.expectedQuantity + '</td>' +
                    '<td><input type="number" class="form-control form-control-sm" min="0" step="1" data-f="received" value="' + l.expectedQuantity + '"></td>' +
                    '<td><input type="number" class="form-control form-control-sm" min="0" step="1" data-f="accepted" value="' + l.expectedQuantity + '"></td>' +
                    '<td><input class="form-control form-control-sm" maxlength="300" data-f="reason" placeholder="e.g. 2 jars cracked"></td></tr>';
            }).join('') + '</tbody></table></div>' +
            '<label class="form-label mt-2" for="receive-note">Note for the vendor (optional)</label><input class="form-control" id="receive-note" maxlength="500" placeholder="e.g. Arrived 2pm, outer carton wet">' +
            '<div class="mt-3 fw-semibold" id="receive-total"></div>';
        $('receive-footer').innerHTML = '<button class="btn btn-outline-danger me-auto" id="btn-intake-cancel">Never arrived</button>' +
            '<button class="btn btn-link link-secondary" data-bs-dismiss="modal">Close</button><button class="btn btn-primary" id="btn-receive">Check in stock</button>';
        function totals() {
            var acc = 0, rej = 0;
            document.querySelectorAll('#receive-body [data-line]').forEach(function (tr) {
                var r = Math.max(0, Math.floor(Number(tr.querySelector('[data-f=received]').value) || 0));
                var a = Math.max(0, Math.floor(Number(tr.querySelector('[data-f=accepted]').value) || 0));
                acc += a; rej += Math.max(0, r - a);
                tr.querySelector('[data-f=reason]').classList.toggle('is-invalid', r - a > 0 && tr.querySelector('[data-f=reason]').value.trim().length < 3);
                tr.querySelector('[data-f=accepted]').classList.toggle('is-invalid', a > r);
            });
            $('receive-total').textContent = acc + ' unit' + (acc === 1 ? '' : 's') + ' go on sale' + (rej ? ', ' + rej + ' rejected' : '') + '.';
        }
        $('receive-body').addEventListener('input', totals);
        totals();
        $('btn-receive').addEventListener('click', function () { doReceive(d); });
        $('btn-intake-cancel').addEventListener('click', function () {
            bootstrap.Modal.getInstance($('modal-receive')).hide();
            openForm('Cancel delivery ' + d.code, '<p class="text-secondary small">Use this when the stock never arrived or the delivery was sent in error. The vendor is emailed.</p>' +
                '<label class="form-label required" for="ff-reason">Reason</label><textarea class="form-control" id="ff-reason" rows="2" maxlength="500"></textarea>', 'Cancel delivery', async function () {
                var reason = $('ff-reason').value.trim();
                if (reason.length < 3) { $('ff-reason').classList.add('is-invalid'); return false; }
                await Marketplace.rcCancelIntake(d.id, reason);
                alertBox('Delivery ' + d.code + ' cancelled. The vendor was emailed.');
            });
        });
    }

    async function doReceive(d) {
        var lines = [], bad = false;
        document.querySelectorAll('#receive-body [data-line]').forEach(function (tr) {
            var r = Math.floor(Number(tr.querySelector('[data-f=received]').value));
            var a = Math.floor(Number(tr.querySelector('[data-f=accepted]').value));
            var reason = tr.querySelector('[data-f=reason]').value.trim();
            if (!(r >= 0) || !(a >= 0) || a > r || (r > a && reason.length < 3)) bad = true;
            lines.push({ lineId: tr.dataset.line, receivedQuantity: r, acceptedQuantity: a, rejectReason: reason || undefined });
        });
        if (bad) { alert('Check the counts: accepted cannot be more than arrived, and rejected units need a reason.'); return; }
        var accepted = lines.reduce(function (s, l) { return s + l.acceptedQuantity; }, 0);
        if (!confirm('Check in delivery ' + d.code + '? ' + accepted + ' unit' + (accepted === 1 ? '' : 's') + ' go on sale. This cannot be undone (use a stock correction if a count was wrong).')) return;
        var btn = $('btn-receive');
        btn.disabled = true;
        try {
            var res = await Marketplace.rcReceive(d.id, { lines: lines, note: $('receive-note').value.trim() || undefined });
            bootstrap.Modal.getInstance($('modal-receive')).hide();
            alertBox(res.code + ' checked in: ' + res.totals.accepted + ' unit' + (res.totals.accepted === 1 ? '' : 's') + ' on sale' + (res.totals.rejected ? ', ' + res.totals.rejected + ' rejected' : '') + '. The vendor was emailed.');
            load(); loadCounts();
        } catch (e) { alert(e.message); btn.disabled = false; }
    }

    // ------------------------------------------------------------- stock

    function renderStock(res) {
        _rows = res.data;
        var n = setHead([['Product'], ['Vendor'], ['On the shelf', 'text-end'], ['On its way', 'text-end'], [''], ['']]);
        $('list-body').innerHTML = res.data.length ? res.data.map(function (p) {
            var flag = p.stock === 0 ? '<span class="badge bg-red-lt">Out of stock</span>' : p.lowStock ? '<span class="badge bg-yellow-lt">Low</span>' : '';
            if (p.approvalStatus === 'PENDING_REVIEW') flag += ' <span class="badge bg-secondary-lt">In review</span>';
            return '<tr><td><div class="d-flex align-items-center gap-2">' + (p.imageUrl ? '<span class="avatar avatar-sm" style="background-image:url(\'' + esc(p.imageUrl) + '\')"></span>' : '<span class="avatar avatar-sm"></span>') +
                '<div><div>' + esc(p.name) + '</div>' + (p.sellerSku ? '<div class="small text-secondary">SKU ' + esc(p.sellerSku) + '</div>' : '') + '</div></div></td>' +
                '<td>' + esc(vendorName(p.seller)) + '</td><td class="text-end fw-bold">' + p.stock + '</td><td class="text-end">' + (p.incoming || '-') + '</td><td>' + flag + '</td>' +
                '<td class="text-end text-nowrap"><button class="btn btn-sm" data-history="' + esc(p.id) + '">History</button>' +
                (canReceive() ? ' <button class="btn btn-sm" data-adjust="' + esc(p.id) + '">Correct</button>' : '') + '</td></tr>';
        }).join('') : empty(n, _sub === 'low' ? 'Nothing is running low.' : 'No vendor products yet.');
    }

    function openAdjust(p) {
        openForm('Correct stock: ' + p.name, '<p class="text-secondary small">On the shelf now: <strong>' + p.stock + '</strong>. Use this after a recount, or to take out stock damaged or lost in storage. The vendor is emailed.</p>' +
            '<label class="form-label required" for="ff-qty">Units to add (+) or remove (-)</label><input type="number" class="form-control" id="ff-qty" step="1" placeholder="e.g. -2">' +
            '<label class="form-label required mt-3" for="ff-reason">Reason</label><textarea class="form-control" id="ff-reason" rows="2" maxlength="300" placeholder="e.g. Two units damaged in storage"></textarea>', 'Save correction', async function () {
            var q = Math.trunc(Number($('ff-qty').value));
            var reason = $('ff-reason').value.trim();
            $('ff-qty').classList.toggle('is-invalid', !q || p.stock + q < 0);
            $('ff-reason').classList.toggle('is-invalid', reason.length < 3);
            if (!q || p.stock + q < 0 || reason.length < 3) return false;
            var r = await Marketplace.rcAdjust(p.id, q, reason);
            alertBox(p.name + ': stock is now ' + r.stock + '. The vendor was emailed.');
        });
    }

    // ------------------------------------------------------------- take-back requests

    function renderWithdrawals(res) {
        _rows = res.data;
        var n = setHead([['Request'], ['Vendor'], ['Items'], ['Reason'], ['Status'], ['']]);
        $('list-body').innerHTML = res.data.length ? res.data.map(function (w) {
            var acts = '';
            if (canReceive() && w.status === 'REQUESTED') acts = '<button class="btn btn-sm btn-primary" data-wd-approve="' + esc(w.id) + '">Approve</button> <button class="btn btn-sm" data-wd-reject="' + esc(w.id) + '">Reject</button>';
            if (canReceive() && w.status === 'APPROVED') acts = '<button class="btn btn-sm btn-primary" data-wd-collected="' + esc(w.id) + '">Collected</button> <button class="btn btn-sm" data-wd-reject="' + esc(w.id) + '">Undo</button>';
            return '<tr><td><div class="fw-semibold">' + esc(w.code) + '</div><div class="small text-secondary">' + fmtDateTime(w.createdAt) + '</div></td>' +
                '<td>' + esc(vendorName(w.seller)) + '</td>' +
                '<td class="small">' + w.items.map(function (i) { return esc(i.quantity + ' x ' + i.name); }).join('<br>') + '</td>' +
                '<td class="small">' + esc(w.reason || '-') + (w.adminNote ? '<div class="text-secondary">Hairlux: ' + esc(w.adminNote) + '</div>' : '') +
                (w.collectedBy ? '<div class="text-secondary">Collected by ' + esc(w.collectedBy) + ', ' + fmtDateTime(w.collectedAt) + '</div>' : '') + '</td>' +
                '<td>' + badge(WITHDRAWAL, w.status) + '</td><td class="text-end text-nowrap">' + acts + '</td></tr>';
        }).join('') : empty(n, 'No requests here.');
    }

    function findRow(id) { return _rows.find(function (r) { return r.id === id; }); }

    function approveWithdrawal(w) {
        openForm('Approve ' + w.code, '<p class="text-secondary small">' + esc(w.items.map(function (i) { return i.quantity + ' x ' + i.name; }).join(', ')) +
            ' come off sale now and are set aside for ' + esc(vendorName(w.seller)) + ' to collect. The vendor is emailed the Receiving Center address and hours.</p>' +
            '<label class="form-label" for="ff-note">Note for the vendor (optional)</label><input class="form-control" id="ff-note" maxlength="500" placeholder="e.g. Collect after 2pm">', 'Approve', async function () {
            await Marketplace.rcApproveWithdrawal(w.id, $('ff-note').value.trim() || undefined);
            alertBox(w.code + ' approved. The stock is off sale and ready to collect.');
        });
    }

    function rejectWithdrawal(w) {
        var undo = w.status === 'APPROVED';
        openForm((undo ? 'Undo ' : 'Reject ') + w.code, '<p class="text-secondary small">' + (undo ? 'The stock goes back on sale.' : 'The stock stays on sale.') + ' The vendor is emailed your reason.</p>' +
            '<label class="form-label required" for="ff-reason">Reason</label><textarea class="form-control" id="ff-reason" rows="2" maxlength="500"></textarea>', undo ? 'Undo approval' : 'Reject', async function () {
            var note = $('ff-reason').value.trim();
            if (note.length < 3) { $('ff-reason').classList.add('is-invalid'); return false; }
            await Marketplace.rcRejectWithdrawal(w.id, note);
            alertBox(w.code + (undo ? ': approval undone, stock back on sale.' : ' rejected.'));
        });
    }

    function collectedWithdrawal(w) {
        openForm('Collected: ' + w.code, '<p class="text-secondary small">Check the person has the request code ' + esc(w.code) + ' before you hand over the stock.</p>' +
            '<label class="form-label required" for="ff-name">Collected by</label><input class="form-control" id="ff-name" maxlength="120" placeholder="Name, and role if not the owner">', 'Mark collected', async function () {
            var name = $('ff-name').value.trim();
            if (name.length < 2) { $('ff-name').classList.add('is-invalid'); return false; }
            await Marketplace.rcCollectedWithdrawal(w.id, name);
            alertBox(w.code + ' marked collected.');
        });
    }

    // ------------------------------------------------------------- history

    function renderHistory(res) {
        var n = setHead([['When'], ['Product'], ['What'], ['Change', 'text-end'], ['Left', 'text-end'], ['Note']]);
        $('list-body').innerHTML = res.data.length ? res.data.map(function (m) {
            var ref = m.intakeCode || m.withdrawalCode || '';
            return '<tr><td class="small text-secondary text-nowrap">' + fmtDateTime(m.createdAt) + '</td><td>' + esc(m.product.name) + '</td>' +
                '<td>' + badge(MOVE, m.type) + (ref ? ' <span class="small text-secondary">' + esc(ref) + '</span>' : '') + '</td>' +
                '<td class="text-end fw-semibold ' + (m.quantity < 0 ? 'text-danger' : 'text-success') + '">' + (m.quantity > 0 ? '+' : '') + m.quantity + '</td>' +
                '<td class="text-end">' + m.balanceAfter + '</td><td class="small text-secondary">' + esc(m.note || '') + '</td></tr>';
        }).join('') : empty(n, 'No stock changes yet.');
    }

    // ------------------------------------------------------------- small form modal

    function openForm(title, html, submitLabel, onSubmit) {
        $('form-title').textContent = title;
        $('form-body').innerHTML = html;
        $('form-submit').textContent = submitLabel;
        $('form-submit').disabled = false;
        _formSubmit = onSubmit;
        bootstrap.Modal.getOrCreateInstance($('modal-form')).show();
    }

    async function submitForm() {
        if (!_formSubmit) return;
        var btn = $('form-submit');
        btn.disabled = true;
        try {
            var ok = await _formSubmit();
            if (ok === false) { btn.disabled = false; return; }
            bootstrap.Modal.getInstance($('modal-form')).hide();
            load(); loadCounts();
        } catch (e) { alert(e.message); btn.disabled = false; }
    }

    // ------------------------------------------------------------- start

    document.addEventListener('DOMContentLoaded', function () {
        if (!RBAC.applyPageGuard(P.read)) return;
        document.querySelectorAll('#main-tabs [data-tab]').forEach(function (a) {
            a.addEventListener('click', function (e) { e.preventDefault(); setTab(a.dataset.tab); });
        });
        document.querySelectorAll('[data-goto]').forEach(function (a) {
            a.addEventListener('click', function (e) {
                e.preventDefault();
                var g = a.dataset.goto;
                if (g === 'stock-low') setTab('stock', 'low');
                else if (g === 'withdrawals-approved') setTab('withdrawals', 'APPROVED');
                else setTab(g);
            });
        });
        $('sub-filters').addEventListener('click', function (e) {
            var b = e.target.closest('[data-sub]');
            if (!b) return;
            _sub = b.dataset.sub;
            _page = 1;
            document.querySelectorAll('#sub-filters [data-sub]').forEach(function (x) { x.classList.toggle('btn-primary', x === b); });
            load();
        });
        $('f-search').addEventListener('input', function () {
            clearTimeout(_timer);
            _timer = setTimeout(function () { _page = 1; load(); }, 300);
        });
        $('btn-prev').addEventListener('click', function () { if (_page > 1) { _page--; load(); } });
        $('btn-next').addEventListener('click', function () { if (_meta && _page < _meta.totalPages) { _page++; load(); } });
        $('list-body').addEventListener('click', function (e) {
            var b = e.target.closest('button');
            if (!b) return;
            if (b.dataset.intake) openIntake(b.dataset.intake);
            else if (b.dataset.adjust) openAdjust(findRow(b.dataset.adjust));
            else if (b.dataset.history) { var p = findRow(b.dataset.history); _product = { id: p.id, name: p.name }; setTab('history'); }
            else if (b.dataset.wdApprove) approveWithdrawal(findRow(b.dataset.wdApprove));
            else if (b.dataset.wdReject) rejectWithdrawal(findRow(b.dataset.wdReject));
            else if (b.dataset.wdCollected) collectedWithdrawal(findRow(b.dataset.wdCollected));
        });
        $('form-submit').addEventListener('click', submitForm);
        var params = new URLSearchParams(location.search);
        setTab(params.get('tab') || 'intakes');
        loadCounts();
        if (params.get('intake')) openIntake(params.get('intake'));
    });
})();
