/**
 * Marketplace Product Approvals page (marketplace-products.html).
 * Vendor products waiting for review: photos, NAFDAC number, price,
 * possible duplicates; approve, request changes or reject.
 * Requires: auth.js, rbac.js, marketplace.js, tabler.min.js
 */
(function () {
    'use strict';

    var bootstrap = window.tabler.bootstrap;
    var P = { read: 'marketplace:read', review: 'marketplace:review_products' };
    var STATUS = {
        DRAFT: { label: 'Draft', cls: 'bg-secondary-lt' },
        PENDING_REVIEW: { label: 'Waiting for review', cls: 'bg-yellow-lt' },
        CHANGES_REQUESTED: { label: 'Changes requested', cls: 'bg-orange-lt' },
        APPROVED: { label: 'Approved', cls: 'bg-green-lt' },
        REJECTED: { label: 'Rejected', cls: 'bg-red-lt' },
    };

    var _status = 'PENDING_REVIEW';
    var _page = 1;
    var _meta = null;
    var _sellerId = new URLSearchParams(location.search).get('sellerId') || '';
    var _searchTimer = null;
    var _product = null;
    var _action = null;

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
    function ngn(n) { return n === null || n === undefined ? '-' : '₦' + Number(n).toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 2 }); }
    function fmtDate(v) { return v ? new Date(v).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'; }
    function fmtDateTime(v) { return v ? new Date(v).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-'; }
    function waited(h) { return h === null || h === undefined ? '' : h < 1 ? 'under an hour' : h < 48 ? h + ' hours' : Math.floor(h / 24) + ' days'; }

    async function load() {
        $('products-tbody').innerHTML = '<tr><td colspan="10" class="text-center text-secondary py-5">Loading...</td></tr>';
        try {
            var res = await Marketplace.listProducts({ approvalStatus: _status || undefined, sellerId: _sellerId || undefined, search: $('f-search').value.trim() || undefined, page: _page });
            _meta = res.meta;
            $('results-label').textContent = _meta.total + ' product' + (_meta.total === 1 ? '' : 's');
            $('page-label').textContent = _meta.totalPages > 1 ? 'Page ' + _meta.page + ' of ' + _meta.totalPages : '';
            $('btn-prev').disabled = _meta.page <= 1;
            $('btn-next').disabled = _meta.page >= _meta.totalPages;
            if (_sellerId && res.data.length) {
                $('vendor-filter-note').innerHTML = '<div class="alert alert-secondary">Showing products from <strong>' + esc(res.data[0].seller.legalName) + '</strong> only. <a href="marketplace-products.html">Show all vendors</a></div>';
            }
            $('products-tbody').innerHTML = res.data.length ? res.data.map(function (p) {
                return '<tr>' +
                    '<td>' + (p.image ? '<span class="avatar avatar-md" style="background-image:url(' + esc(p.image) + ')"></span>' : '<span class="avatar avatar-md">-</span>') + '</td>' +
                    '<td><div class="fw-semibold">' + esc(p.name) + '</div><div class="small text-secondary">' + esc(p.brand || '') + '</div></td>' +
                    '<td><a href="marketplace-vendors.html?vendor=' + esc(p.seller.id) + '">' + esc(p.seller.legalName) + '</a></td>' +
                    '<td>' + esc(p.category ? p.category.name : '-') + '</td>' +
                    '<td class="text-end">' + ngn(p.price) + '</td>' +
                    '<td class="text-end">' + p.stock + '</td>' +
                    '<td class="font-monospace small">' + esc(p.nafdacNumber || '-') + '</td>' +
                    '<td>' + badge(p.approvalStatus) + (p.status === 'INACTIVE' ? '<div class="small text-secondary">hidden by vendor</div>' : '') + '</td>' +
                    '<td>' + fmtDate(p.submittedAt) + (p.waitingHours !== null ? '<div class="small text-secondary">waiting ' + esc(waited(p.waitingHours)) + '</div>' : '') + '</td>' +
                    '<td class="text-end"><button class="btn btn-sm btn-primary" data-open="' + esc(p.id) + '">' + (p.approvalStatus === 'PENDING_REVIEW' && RBAC.can(P.review) ? 'Review' : 'View') + '</button></td></tr>';
            }).join('') : '<tr><td colspan="10" class="text-center text-secondary py-5">No products here.</td></tr>';
        } catch (e) {
            $('products-tbody').innerHTML = '<tr><td colspan="10" class="text-center text-danger py-5">' + esc(e.message) + '</td></tr>';
        }
    }

    function cell(label, value) {
        return '<div class="col-sm-6 col-lg-4 mb-3"><div class="text-secondary small">' + esc(label) + '</div><div>' + (value === null || value === undefined || value === '' ? '<span class="text-secondary">-</span>' : value) + '</div></div>';
    }

    async function openProduct(id) {
        $('product-title').textContent = 'Loading...';
        $('product-body').innerHTML = '<div class="text-center text-secondary py-5">Loading...</div>';
        $('product-footer').innerHTML = '';
        bootstrap.Modal.getOrCreateInstance($('modal-product')).show();
        try {
            _product = await Marketplace.getProduct(id);
            renderProduct();
        } catch (e) {
            $('product-body').innerHTML = '<div class="alert alert-danger">' + esc(e.message) + '</div>';
        }
    }

    function renderProduct() {
        var p = _product;
        $('product-title').innerHTML = esc(p.name) + ' ' + badge(p.approvalStatus);
        var parts = [];
        if (p.seller.status !== 'APPROVED') parts.push('<div class="alert alert-warning">The vendor is ' + esc(p.seller.status.replace(/_/g, ' ').toLowerCase()) + '.</div>');
        if (p.seller.riskFlags && p.seller.riskFlags.length) parts.push('<div class="alert alert-warning">This vendor has open risk flags. <a href="marketplace-vendors.html?vendor=' + esc(p.seller.id) + '">Check the vendor</a></div>');
        if (p.possibleDuplicates.length) {
            parts.push('<div class="alert alert-warning"><strong>Same name already in the catalogue:</strong><ul class="mb-0">' + p.possibleDuplicates.map(function (d) {
                return '<li>' + esc(d.name) + ' (' + esc(d.owner) + ', ' + esc((d.approvalStatus || '').replace(/_/g, ' ').toLowerCase()) + ')</li>';
            }).join('') + '</ul></div>');
        }
        if (p.sameNafdacNumber.length) {
            parts.push('<div class="alert alert-warning"><strong>Same NAFDAC number used on:</strong><ul class="mb-0">' + p.sameNafdacNumber.map(function (d) {
                return '<li>' + esc(d.name) + ' (' + esc(d.owner) + ')</li>';
            }).join('') + '</ul><div class="small">One NAFDAC number normally belongs to one product. Check the label photo.</div></div>');
        }
        if (p.reviewNotes && p.approvalStatus !== 'APPROVED') parts.push('<div class="alert alert-secondary"><strong>Last note to the vendor:</strong> ' + esc(p.reviewNotes) + '</div>');

        parts.push('<div class="row g-2 mb-4">' + (p.images.length ? p.images.map(function (i) {
            return '<div class="col-6 col-md-3"><a href="' + esc(i.url) + '" target="_blank" rel="noopener"><img src="' + esc(i.url) + '" class="img-fluid rounded border" alt="Product photo" style="aspect-ratio:1;object-fit:cover;width:100%"></a></div>';
        }).join('') : '<div class="col-12 text-secondary">No photos.</div>') + '</div>');

        var dims = [p.lengthCm, p.widthCm, p.heightCm].some(function (x) { return x; }) ? [p.lengthCm || '-', p.widthCm || '-', p.heightCm || '-'].join(' x ') + ' cm' : '';
        parts.push('<div class="row">' +
            cell('Vendor', '<a href="marketplace-vendors.html?vendor=' + esc(p.seller.id) + '">' + esc(p.seller.legalName) + '</a>') +
            cell('Category', esc(p.category ? p.category.name : '')) +
            cell('Brand', esc(p.brand)) +
            cell('NAFDAC number', '<span class="font-monospace">' + esc(p.nafdacNumber || '') + '</span>') +
            cell('Price', ngn(p.price)) +
            cell('Stock (vendor)', String(p.stock)) +
            cell('Packed weight', p.weightGrams ? p.weightGrams + ' g' : '') +
            cell('Size', esc(dims)) +
            cell('Vendor SKU', esc(p.sellerSku)) +
            cell('Pay on Delivery', p.payOnDeliveryAllowed ? 'Allowed' : 'Not allowed') +
            cell('Visible', p.status === 'ACTIVE' ? 'Yes' : 'Hidden by the vendor') +
            cell('Submitted', fmtDateTime(p.submittedAt)) +
            '<div class="col-12 mb-3"><div class="text-secondary small">Description</div><div style="white-space:pre-wrap">' + esc(p.description || '') + '</div></div>' +
            '</div>');

        parts.push('<h3 class="mb-2">History</h3><ul class="list-unstyled mb-0">' + p.history.map(function (h) {
            return '<li class="mb-2"><span class="text-secondary small">' + fmtDateTime(h.createdAt) + '</span> ' + badge(h.toStatus) + (h.notes ? '<div class="small">' + esc(h.notes) + '</div>' : '') + '</li>';
        }).join('') + '</ul>');
        $('product-body').innerHTML = parts.join('');

        var btns = '';
        if (p.approvalStatus === 'PENDING_REVIEW' && RBAC.can(P.review)) {
            btns = '<button class="btn btn-outline-danger" data-decide="REJECT">Reject</button>' +
                '<button class="btn btn-outline-warning" data-decide="REQUEST_CHANGES">Request changes</button>' +
                '<button class="btn btn-success" data-decide="APPROVE">Approve</button>';
        }
        $('product-footer').innerHTML = '<button class="btn btn-link link-secondary me-auto" data-bs-dismiss="modal">Close</button>' + btns;
    }

    var DECISIONS = {
        APPROVE: { title: 'Approve product', help: 'The product goes on sale in the web shop while the vendor is live.', notes: false, btn: 'Approve', cls: 'btn-success' },
        REQUEST_CHANGES: { title: 'Request changes', help: 'The vendor edits the product and sends it for review again.', notes: true, btn: 'Send back', cls: 'btn-warning' },
        REJECT: { title: 'Reject product', help: 'The product cannot be edited after this. The vendor would need to add it again.', notes: true, btn: 'Reject', cls: 'btn-danger' },
    };

    function openDecision(action) {
        var d = DECISIONS[action];
        _action = action;
        $('decision-title').textContent = d.title;
        $('decision-help').textContent = d.help;
        $('decision-pod-wrap').hidden = action !== 'APPROVE';
        $('decision-pod').checked = _product.payOnDeliveryAllowed !== false;
        $('decision-notes-wrap').hidden = !d.notes;
        $('decision-notes').value = '';
        $('decision-error').hidden = true;
        $('btn-decision-confirm').className = 'btn ' + d.cls;
        $('btn-decision-confirm').textContent = d.btn;
        bootstrap.Modal.getOrCreateInstance($('modal-decision')).show();
    }

    async function confirmDecision() {
        var btn = $('btn-decision-confirm');
        var notes = $('decision-notes').value.trim();
        try {
            if (DECISIONS[_action].notes && !notes) throw new Error('Tell the vendor what to change or why.');
            btn.disabled = true;
            await Marketplace.decideProduct(_product.id, {
                action: _action, notes: notes || undefined,
                payOnDeliveryAllowed: _action === 'APPROVE' ? $('decision-pod').checked : undefined,
            });
            bootstrap.Modal.getOrCreateInstance($('modal-decision')).hide();
            bootstrap.Modal.getOrCreateInstance($('modal-product')).hide();
            $('page-alert').innerHTML = '<div class="alert alert-success alert-dismissible">' + esc(_product.name) + ': ' + esc(DECISIONS[_action].title.toLowerCase()) + ' done. The vendor has been emailed.<a class="btn-close" data-bs-dismiss="alert"></a></div>';
            load();
            if (window.Layout && Layout.refreshMarketplaceBadge) Layout.refreshMarketplaceBadge();
        } catch (e) {
            $('decision-error').textContent = e.message;
            $('decision-error').hidden = false;
        } finally {
            btn.disabled = false;
        }
    }

    document.addEventListener('DOMContentLoaded', function () {
        if (!RBAC.applyPageGuard(P.read)) return;
        if (_sellerId) {
            // Coming from a vendor: show all of their products, not only the queue.
            _status = '';
            document.querySelectorAll('#status-tabs .nav-link').forEach(function (x) { x.classList.toggle('active', x.dataset.status === ''); });
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
        $('products-tbody').addEventListener('click', function (e) {
            var b = e.target.closest('[data-open]');
            if (b) openProduct(b.dataset.open);
        });
        $('product-footer').addEventListener('click', function (e) {
            var b = e.target.closest('[data-decide]');
            if (b) openDecision(b.dataset.decide);
        });
        $('btn-decision-confirm').addEventListener('click', confirmDecision);
        load();
    });
})();
