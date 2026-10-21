/**
 * Marketplace Vendor Orders page (marketplace-orders.html).
 * One row per vendor per web shop order: who ships what, confirm deadlines,
 * cancel with a refund, or confirm delivery with the customer's code.
 * Requires: auth.js, rbac.js, marketplace.js, tabler.min.js
 */
(function () {
    'use strict';

    var bootstrap = window.tabler.bootstrap;
    var P = { read: 'marketplace:read', manage: 'marketplace:manage_orders' };
    var STATUS = {
        PENDING_CONFIRMATION: { label: 'To confirm', cls: 'bg-yellow-lt' },
        CONFIRMED: { label: 'Confirmed', cls: 'bg-blue-lt' },
        PACKED: { label: 'Packed', cls: 'bg-blue-lt' },
        HANDED_TO_DELIVERY: { label: 'On the way', cls: 'bg-purple-lt' },
        DELIVERED: { label: 'Delivered', cls: 'bg-green-lt' },
        CANCELLED: { label: 'Cancelled', cls: 'bg-red-lt' },
    };
    var BY = { VENDOR: 'the vendor', ADMIN: 'Hairlux', SYSTEM: 'automatically (not confirmed in time)' };

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
            var overdue = _status === 'OVERDUE';
            var res = await Marketplace.listOrders({
                status: overdue ? undefined : (_status || undefined),
                overdue: overdue ? 'true' : undefined,
                search: $('f-search').value.trim() || undefined,
                page: _page,
            });
            _meta = res.meta;
            var c = res.counts || {};
            $('c-pending').textContent = c.PENDING_CONFIRMATION || 0;
            $('c-overdue').textContent = c.OVERDUE || 0;
            $('c-shipped').textContent = c.HANDED_TO_DELIVERY || 0;
            $('c-delivered').textContent = c.DELIVERED || 0;
            $('results-label').textContent = _meta.total + ' order' + (_meta.total === 1 ? '' : 's');
            $('page-label').textContent = _meta.totalPages > 1 ? 'Page ' + _meta.page + ' of ' + _meta.totalPages : '';
            $('btn-prev').disabled = _meta.page <= 1;
            $('btn-next').disabled = _meta.page >= _meta.totalPages;
            $('orders-tbody').innerHTML = res.data.length ? res.data.map(function (o) {
                var items = o.items.map(function (i) { return i.quantity + ' x ' + i.name; }).join(', ');
                return '<tr>' +
                    '<td><div class="fw-semibold">' + esc(o.code) + '</div><div class="small text-secondary">' + esc(o.recipient.name) + '</div></td>' +
                    '<td><a href="marketplace-vendors.html?vendor=' + esc(o.seller.id) + '">' + esc(vendorName(o)) + '</a></td>' +
                    '<td class="small" style="max-width:260px">' + esc(items) + '</td>' +
                    '<td class="text-end">' + ngn(o.subtotal) + '</td>' +
                    '<td class="text-end">' + ngn(o.vendorAmount) + '</td>' +
                    '<td>' + badge(o.status) + (o.overdue ? ' <span class="badge bg-red-lt">Overdue</span>' : '') +
                        (o.status === 'PENDING_CONFIRMATION' && !o.overdue ? '<div class="small text-secondary">by ' + fmtDateTime(o.confirmBy) + '</div>' : '') + '</td>' +
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
        var a = o.recipient.address || {};
        var steps = [['Placed', o.createdAt], ['Confirmed', o.confirmedAt], ['Packed', o.packedAt], ['Handed to delivery', o.handedOverAt], ['Delivered', o.deliveredAt]];
        var lines = o.items.map(function (i) {
            return '<tr><td>' + esc(i.name) + (i.sellerSku ? '<div class="small text-secondary">SKU ' + esc(i.sellerSku) + '</div>' : '') + '</td><td class="text-end">' + i.quantity + '</td>' +
                '<td class="text-end">' + ngn(i.lineTotal) + '</td><td class="text-end">' + i.commissionPercent + '%</td><td class="text-end">' + ngn(i.commissionAmount) + '</td><td class="text-end">' + ngn(i.vendorAmount) + '</td></tr>';
        }).join('');
        var so = o.shopOrder || {};
        $('order-body').innerHTML =
            '<div class="d-flex justify-content-between align-items-start mb-3"><div>' + badge(o.status) + (o.overdue ? ' <span class="badge bg-red-lt">Overdue</span>' : '') +
            '<div class="small text-secondary mt-1">Customer order ' + esc(so.orderCode || '-') + ' &middot; ' + (so.paymentMethod === 'PAY_ON_DELIVERY' ? 'Pay on Delivery' + (so.balanceDue > 0 ? ', balance of ' + ngn(so.balanceDue) + ' not paid yet' : ', balance paid') : 'Paid from wallet') + '</div></div>' +
            '<div class="text-end small"><div class="fw-semibold">' + esc(vendorName(o)) + '</div><div class="text-secondary">' + esc(o.seller.businessPhone || '') + '</div></div></div>' +
            (o.status === 'CANCELLED' ? '<div class="alert alert-danger">Cancelled ' + fmtDateTime(o.cancelledAt) + ' by ' + esc(BY[o.cancelledBy] || o.cancelledBy || '-') + ': ' + esc(o.cancelReason || '') + '. Refunded ' + ngn(o.refundedAmount) + '.</div>' : '') +
            (o.deliveryCodeLocked && o.status !== 'DELIVERED' && o.status !== 'CANCELLED' ? '<div class="alert alert-warning">The vendor entered too many wrong delivery codes. Call the customer, then confirm delivery here with their code.</div>' : '') +
            '<div class="row g-2 mb-3">' + steps.map(function (s) {
                return '<div class="col"><div class="small ' + (s[1] ? 'fw-semibold' : 'text-secondary') + '">' + s[0] + '</div><div class="small text-secondary">' + (s[1] ? fmtDateTime(s[1]) : '-') + '</div></div>';
            }).join('') + '</div>' +
            (o.status === 'PENDING_CONFIRMATION' ? '<div class="small mb-3">Vendor must confirm by <strong>' + fmtDateTime(o.confirmBy) + '</strong>.</div>' : '') +
            '<div class="table-responsive"><table class="table table-sm"><thead><tr><th>Item</th><th class="text-end">Qty</th><th class="text-end">Sale</th><th class="text-end">Rate</th><th class="text-end">Commission</th><th class="text-end">Vendor gets</th></tr></thead><tbody>' + lines + '</tbody>' +
            '<tfoot><tr class="fw-semibold"><td colspan="2">Total</td><td class="text-end">' + ngn(o.subtotal) + '</td><td></td><td class="text-end">' + ngn(o.commissionAmount) + '</td><td class="text-end">' + ngn(o.vendorAmount) + '</td></tr></tfoot></table></div>' +
            '<div class="row g-3"><div class="col-md-6"><div class="subheader mb-1">Customer money for this shipment</div><div class="small">' +
            'Paid at checkout: ' + ngn(o.paidAmount) + ' (includes delivery ' + ngn(o.deliveryFee) + ')<br>Share of balance: ' + ngn(o.balanceAmount) + (o.refundedAmount > 0 ? '<br>Refunded: ' + ngn(o.refundedAmount) : '') + '</div></div>' +
            '<div class="col-md-6"><div class="subheader mb-1">Deliver to</div><div class="small">' + esc(o.recipient.name) + (o.recipient.phone ? ', ' + esc(o.recipient.phone) : '') + '<br>' + esc(a.fullAddress || [a.streetAddress, a.city, a.state].filter(Boolean).join(', ')) +
            (o.trackingNote ? '<br><span class="text-secondary">Courier: ' + esc(o.trackingNote) + '</span>' : '') + '</div></div></div>';

        var open = o.status !== 'DELIVERED' && o.status !== 'CANCELLED';
        var foot = '<button class="btn btn-link link-secondary me-auto" data-bs-dismiss="modal">Close</button>';
        if (open && RBAC.can(P.manage)) {
            foot += '<button class="btn btn-outline-danger" id="btn-open-cancel">Cancel and refund</button>';
            if (o.status !== 'PENDING_CONFIRMATION') foot += '<button class="btn btn-primary" id="btn-open-deliver"' + (so.balanceDue > 0 ? ' disabled title="The customer has not paid the balance yet"' : '') + '>Confirm delivery</button>';
        }
        $('order-footer').innerHTML = foot;
        var bc = $('btn-open-cancel');
        if (bc) bc.addEventListener('click', function () { $('cancel-reason').value = ''; bootstrap.Modal.getOrCreateInstance($('modal-cancel')).show(); });
        var bd = $('btn-open-deliver');
        if (bd) bd.addEventListener('click', function () { $('deliver-code').value = ''; bootstrap.Modal.getOrCreateInstance($('modal-deliver')).show(); });
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
            var o = await Marketplace.cancelOrder(_order.id, reason);
            bootstrap.Modal.getInstance($('modal-cancel')).hide();
            render(o);
            alertBox(o.code + ' cancelled. The customer was refunded ' + ngn(o.refundedAmount) + ' and the vendor was emailed.');
            load();
        } catch (e) { alert(e.message); }
        finally { btn.disabled = false; }
    }

    async function doDeliver() {
        var code = $('deliver-code').value.replace(/\D/g, '');
        if (code.length !== 6) { $('deliver-code').classList.add('is-invalid'); return; }
        $('deliver-code').classList.remove('is-invalid');
        var btn = $('btn-deliver-confirm');
        btn.disabled = true;
        try {
            var o = await Marketplace.confirmDelivery(_order.id, code);
            bootstrap.Modal.getInstance($('modal-deliver')).hide();
            render(o);
            alertBox(o.code + ' marked as delivered.');
            load();
        } catch (e) { $('deliver-code').classList.add('is-invalid'); alert(e.message); }
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
        $('btn-deliver-confirm').addEventListener('click', doDeliver);
        $('deliver-code').addEventListener('input', function () { this.value = this.value.replace(/\D/g, '').slice(0, 6); });
        load();
        if (params.get('id')) openOrder(params.get('id'));
    });
})();
