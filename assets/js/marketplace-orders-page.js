/**
 * Marketplace Vendor Orders page (marketplace-orders.html).
 * One row per vendor per web shop order. Phase 4: Hairlux picks it from the
 * vendor's stock at the Receiving Center and delivers it, so its status
 * follows the shop order. Here: cancel one vendor's part (e.g. failed quality
 * check, with or without restocking) or record a return after delivery.
 * Requires: auth.js, rbac.js, marketplace.js, tabler.min.js
 */
(function () {
    'use strict';

    var bootstrap = window.tabler.bootstrap;
    var P = { read: 'marketplace:read', manage: 'marketplace:manage_orders' };
    var STATUS = {
        NEW: { label: 'New', cls: 'bg-yellow-lt' },
        PREPARING: { label: 'Picking', cls: 'bg-blue-lt' },
        QUALITY_CHECK: { label: 'Quality check', cls: 'bg-blue-lt' },
        READY_FOR_DISPATCH: { label: 'Ready for dispatch', cls: 'bg-blue-lt' },
        OUT_FOR_DELIVERY: { label: 'Out for delivery', cls: 'bg-purple-lt' },
        DELIVERED: { label: 'Delivered', cls: 'bg-green-lt' },
        CANCELLED: { label: 'Cancelled', cls: 'bg-red-lt' },
    };
    var BY = { VENDOR: 'the vendor', ADMIN: 'Hairlux', SYSTEM: 'automatically', CUSTOMER: 'the customer' };

    var _status = '';
    var _page = 1;
    var _meta = null;
    var _searchTimer = null;
    var _order = null;

    function $(id) { return document.getElementById(id); }
    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }
    function badge(key) {
        var m = STATUS[key] || { label: key, cls: 'bg-secondary-lt' };
        return '<span class="badge ' + m.cls + '">' + esc(m.label) + '</span>';
    }
    function ngn(n) {
        if (n === null || n === undefined) return '-';
        var d = Number(n) % 1 ? 2 : 0; // ₦5,687.50, not ₦5,687.5
        return '₦' + Number(n).toLocaleString('en-NG', { minimumFractionDigits: d, maximumFractionDigits: 2 });
    }
    function fmtDateTime(v) { return v ? new Date(v).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-'; }
    function vendorName(o) { return o.seller ? (o.seller.tradingName || o.seller.legalName) : '-'; }
    function alertBox(msg, type) {
        $('page-alert').innerHTML = '<div class="alert alert-' + (type || 'success') + ' alert-dismissible">' + esc(msg) + '<a class="btn-close" data-bs-dismiss="alert"></a></div>';
    }

    async function load() {
        $('orders-tbody').innerHTML = '<tr><td colspan="8" class="text-center text-secondary py-5">Loading...</td></tr>';
        try {
            var res = await Marketplace.listOrders({
                status: _status || undefined,
                search: $('f-search').value.trim() || undefined,
                page: _page,
            });
            _meta = res.meta;
            var c = res.counts || {};
            $('c-pending').textContent = c.NEW || 0;
            $('c-preparing').textContent = (c.PREPARING || 0) + (c.QUALITY_CHECK || 0) + (c.READY_FOR_DISPATCH || 0);
            $('c-shipped').textContent = c.OUT_FOR_DELIVERY || 0;
            $('c-delivered').textContent = c.DELIVERED || 0;
            $('results-label').textContent = _meta.total + ' order' + (_meta.total === 1 ? '' : 's');
            $('page-label').textContent = _meta.totalPages > 1 ? 'Page ' + _meta.page + ' of ' + _meta.totalPages : '';
            $('btn-prev').disabled = _meta.page <= 1;
            $('btn-next').disabled = _meta.page >= _meta.totalPages;
            $('orders-tbody').innerHTML = res.data.length ? res.data.map(function (o) {
                var items = o.items.map(function (i) { return i.quantity + ' x ' + i.name; }).join(', ');
                return '<tr>' +
                    '<td><div class="fw-semibold">' + esc(o.code) + '</div><div class="small text-secondary">' + esc(o.shopOrder ? o.shopOrder.orderCode : '') + '</div></td>' +
                    '<td><a href="marketplace-vendors.html?vendor=' + esc(o.seller.id) + '">' + esc(vendorName(o)) + '</a></td>' +
                    '<td class="small" style="max-width:260px">' + esc(items) + '</td>' +
                    '<td class="text-end">' + ngn(o.subtotal) + '</td>' +
                    '<td class="text-end">' + ngn(o.vendorAmount) + '</td>' +
                    '<td>' + badge(o.status) + '</td>' +
                    '<td class="small text-secondary">' + fmtDateTime(o.createdAt) + '</td>' +
                    '<td class="text-end"><button class="btn btn-sm" data-open="' + esc(o.id) + '">View</button></td></tr>';
            }).join('') : '<tr><td colspan="8" class="text-center text-secondary py-5">No vendor orders here.</td></tr>';
        } catch (e) {
            $('orders-tbody').innerHTML = '<tr><td colspan="8" class="text-center text-danger py-4">' + esc(e.message) + '</td></tr>';
        }
    }

    function render(o) {
        _order = o;
        $('order-title').textContent = 'Vendor order ' + o.code;
        var flow = ['NEW', 'PREPARING', 'QUALITY_CHECK', 'READY_FOR_DISPATCH', 'OUT_FOR_DELIVERY', 'DELIVERED'];
        var at = flow.indexOf(o.status);
        var steps = flow.map(function (k, i) { return [STATUS[k].label, i <= at, k === 'NEW' ? o.createdAt : k === 'DELIVERED' ? o.deliveredAt : null]; });
        var lines = o.items.map(function (i) {
            return '<tr><td>' + esc(i.name) + (i.sellerSku ? '<div class="small text-secondary">SKU ' + esc(i.sellerSku) + '</div>' : '') +
                (i.returnedQuantity ? '<div class="small text-danger">' + i.returnedQuantity + ' returned</div>' : '') + '</td><td class="text-end">' + i.quantity + '</td>' +
                '<td class="text-end">' + ngn(i.lineTotal) + '</td><td class="text-end">' + i.commissionPercent + '%</td><td class="text-end">' + ngn(i.commissionAmount) + '</td><td class="text-end">' + ngn(i.vendorAmount) + '</td></tr>';
        }).join('');
        var so = o.shopOrder || {};
        $('order-body').innerHTML =
            '<div class="d-flex justify-content-between align-items-start mb-3"><div>' + badge(o.status) +
            '<div class="small text-secondary mt-1">Customer order <a href="shop.html">' + esc(so.orderCode || '-') + '</a> &middot; ' + (so.paymentMethod === 'PAY_ON_DELIVERY' ? 'Pay on Delivery' + (so.balanceDue > 0 ? ', balance of ' + ngn(so.balanceDue) + ' not paid yet' : ', balance paid') : 'Paid from wallet') + '</div></div>' +
            '<div class="text-end small"><div class="fw-semibold">' + esc(vendorName(o)) + '</div><div class="text-secondary">' + esc(o.seller.businessPhone || '') + '</div></div></div>' +
            (o.status === 'CANCELLED' ? '<div class="alert alert-danger">Cancelled ' + fmtDateTime(o.cancelledAt) + ' by ' + esc(BY[o.cancelledBy] || o.cancelledBy || '-') + ': ' + esc(o.cancelReason || '') + '. Refunded ' + ngn(o.refundedAmount) + '.</div>' : '') +
            (o.status !== 'CANCELLED' ? '<div class="row g-2 mb-3">' + steps.map(function (s) {
                return '<div class="col"><div class="small ' + (s[1] ? 'fw-semibold' : 'text-secondary') + '">' + s[0] + '</div><div class="small text-secondary">' + (s[2] ? fmtDateTime(s[2]) : '') + '</div></div>';
            }).join('') + '</div>' : '') +
            '<div class="table-responsive"><table class="table table-sm"><thead><tr><th>Item</th><th class="text-end">Qty</th><th class="text-end">Sale</th><th class="text-end">Rate</th><th class="text-end">Commission</th><th class="text-end">Vendor gets</th></tr></thead><tbody>' + lines + '</tbody>' +
            '<tfoot><tr class="fw-semibold"><td colspan="2">Total</td><td class="text-end">' + ngn(o.subtotal) + '</td><td></td><td class="text-end">' + ngn(o.commissionAmount) + '</td><td class="text-end">' + ngn(o.vendorAmount) + '</td></tr></tfoot></table></div>' +
            '<div class="subheader mb-1">Customer money for these items</div><div class="small">' +
            'Paid at checkout: ' + ngn(o.paidAmount) + '<br>Share of balance: ' + ngn(o.balanceAmount) + (o.refundedAmount > 0 ? '<br>Refunded: ' + ngn(o.refundedAmount) : '') +
            (o.returnedAmount > 0 ? '<br>Refunded for returns: ' + ngn(o.returnedAmount) : '') + '</div>' +
            (o.status === 'DELIVERED' ? '<div class="mt-3" id="returns-box"></div>' : '');
        if (o.status === 'DELIVERED') loadReturns(o.id);

        var open = o.status !== 'DELIVERED' && o.status !== 'CANCELLED';
        var foot = '<button class="btn btn-link link-secondary me-auto" data-bs-dismiss="modal">Close</button>';
        if (open && o.status !== 'OUT_FOR_DELIVERY' && RBAC.can(P.manage)) {
            foot += '<button class="btn btn-outline-danger" id="btn-open-cancel">Cancel this vendor\'s part</button>';
        }
        var returnable = o.status === 'DELIVERED' && o.items.some(function (i) { return i.quantity > (i.returnedQuantity || 0); });
        if (returnable && RBAC.can(P.manage)) foot += '<button class="btn btn-outline-primary" id="btn-open-return">Record a return</button>';
        $('order-footer').innerHTML = foot;
        var br = $('btn-open-return');
        if (br) br.addEventListener('click', openReturn);
        var bc = $('btn-open-cancel');
        if (bc) bc.addEventListener('click', function () { $('cancel-reason').value = ''; $('cancel-restock').checked = true; bootstrap.Modal.getOrCreateInstance($('modal-cancel')).show(); });
    }

    async function loadReturns(id) {
        try {
            var rows = await Marketplace.listReturns(id);
            if (!rows.length || !$('returns-box')) return;
            $('returns-box').innerHTML = '<div class="subheader mb-1">Returns</div><div class="table-responsive"><table class="table table-sm mb-0"><thead><tr><th>Date</th><th>Items</th><th class="text-end">Refunded</th><th class="text-end">Off vendor</th></tr></thead><tbody>' +
                rows.map(function (r) {
                    return '<tr><td class="small">' + fmtDateTime(r.createdAt) + '</td><td class="small">' + esc((r.items || []).map(function (i) { return i.quantity + ' x ' + i.name; }).join(', ')) +
                        '<div class="text-secondary">' + esc(r.reason) + (r.restocked ? ' (restocked)' : '') + '</div></td><td class="text-end">' + ngn(r.refundAmount) + '</td><td class="text-end">' + ngn(r.vendorAmount) + '</td></tr>';
                }).join('') + '</tbody></table></div>';
        } catch (e) { /* the order still shows */ }
    }

    function returnTotals() {
        var refund = 0;
        document.querySelectorAll('#return-lines [data-ret]').forEach(function (inp) {
            var i = _order.items.find(function (x) { return x.productId === inp.dataset.ret; });
            var q = Math.max(0, Math.min(Number(inp.max), Math.floor(Number(inp.value) || 0)));
            refund += i.price * q;
        });
        $('return-total').textContent = refund > 0 ? 'Customer refund: about ' + ngn(Math.round(refund * 100) / 100) : '';
    }

    function openReturn() {
        $('return-lines').innerHTML = '<table class="table table-sm"><thead><tr><th>Item</th><th class="text-end">Can return</th><th style="width:110px">Returned</th></tr></thead><tbody>' +
            _order.items.map(function (i) {
                var left = i.quantity - (i.returnedQuantity || 0);
                return '<tr><td>' + esc(i.name) + '<div class="small text-secondary">' + ngn(i.price) + ' each</div></td><td class="text-end">' + left + '</td>' +
                    '<td><input type="number" class="form-control form-control-sm" min="0" max="' + left + '" value="0" data-ret="' + esc(i.productId) + '"' + (left ? '' : ' disabled') + '></td></tr>';
            }).join('') + '</tbody></table>';
        $('return-reason').value = '';
        $('return-restock').checked = false;
        $('return-total').textContent = '';
        bootstrap.Modal.getOrCreateInstance($('modal-return')).show();
    }

    async function doReturn() {
        var items = [];
        document.querySelectorAll('#return-lines [data-ret]').forEach(function (inp) {
            var q = Math.floor(Number(inp.value) || 0);
            if (q > 0) items.push({ productId: inp.dataset.ret, quantity: q });
        });
        if (!items.length) { alert('Enter how many of each item came back.'); return; }
        var reason = $('return-reason').value.trim();
        if (reason.length < 3) { $('return-reason').classList.add('is-invalid'); return; }
        $('return-reason').classList.remove('is-invalid');
        var btn = $('btn-return-confirm');
        btn.disabled = true;
        try {
            var o = await Marketplace.recordReturn(_order.id, { items: items, reason: reason, restock: $('return-restock').checked });
            bootstrap.Modal.getInstance($('modal-return')).hide();
            render(o);
            alertBox('Return recorded on ' + o.code + '. The customer was refunded ' + ngn(o.lastReturn.refund) + ' and ' + ngn(o.lastReturn.vendorAmount) + ' came off the vendor balance.');
            load();
        } catch (e) { alert(e.message); }
        finally { btn.disabled = false; }
    }

    async function openOrder(id) {
        $('order-body').innerHTML = '<div class="text-center py-5"><div class="spinner-border text-primary"></div></div>';
        $('order-footer').innerHTML = '';
        bootstrap.Modal.getOrCreateInstance($('modal-order')).show();
        try { render(await Marketplace.getOrder(id)); }
        catch (e) { $('order-body').innerHTML = '<div class="alert alert-danger">' + esc(e.message) + '</div>'; }
    }

    async function doCancel() {
        var reason = $('cancel-reason').value.trim();
        if (reason.length < 3) { $('cancel-reason').classList.add('is-invalid'); return; }
        $('cancel-reason').classList.remove('is-invalid');
        var btn = $('btn-cancel-confirm');
        btn.disabled = true;
        try {
            var restock = $('cancel-restock').checked;
            var o = await Marketplace.cancelOrder(_order.id, reason, restock);
            bootstrap.Modal.getInstance($('modal-cancel')).hide();
            render(o);
            alertBox(o.code + ' cancelled. The customer was refunded ' + ngn(o.refundedAmount) + (restock ? ' and the items went back on the shelf.' : '. The items were kept off sale.') + ' The vendor was emailed.');
            load();
        } catch (e) { alert(e.message); }
        finally { btn.disabled = false; }
    }

    document.addEventListener('DOMContentLoaded', function () {
        if (!RBAC.applyPageGuard(P.read)) return;
        var params = new URLSearchParams(location.search);
        if (params.get('status')) {
            _status = params.get('status');
            document.querySelectorAll('#status-tabs .nav-link').forEach(function (x) { x.classList.toggle('active', x.dataset.status === _status); });
        }
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
        $('btn-prev').addEventListener('click', function () { if (_page > 1) { _page--; load(); } });
        $('btn-next').addEventListener('click', function () { if (_meta && _page < _meta.totalPages) { _page++; load(); } });
        $('orders-tbody').addEventListener('click', function (e) {
            var b = e.target.closest('[data-open]');
            if (b) openOrder(b.dataset.open);
        });
        $('btn-cancel-confirm').addEventListener('click', doCancel);
        $('btn-return-confirm').addEventListener('click', doReturn);
        $('return-lines').addEventListener('input', returnTotals);
        load();
        if (params.get('id')) openOrder(params.get('id'));
    });
})();
