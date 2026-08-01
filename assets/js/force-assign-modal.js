/**
 * force-assign-modal.js — Hairlux Admin
 * Shared Force Assign Beautician picker (search + paginated list).
 *
 * Requires: auth.js, beauticians.js, bookings.js, tabler (bootstrap)
 */
var ForceAssignModal = (function () {
    var bookingId = null;
    var bookingCoords = null;
    var selectedUserId = null;
    var selectedName = '';
    var onSuccess = null;
    var state = { page: 1, limit: 15, search: '', availabilityStatus: '', totalPages: 1 };
    var searchTimer = null;
    var initialized = false;

    function getBootstrap() {
        return (window.tabler && window.tabler.bootstrap) || window.bootstrap;
    }

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function el(id) {
        return document.getElementById(id);
    }

    function injectStyles() {
        if (document.getElementById('force-assign-modal-styles')) return;
        var style = document.createElement('style');
        style.id = 'force-assign-modal-styles';
        style.textContent =
            '#modal-force-assign #force-assign-list .force-assign-item {' +
            'border: 2px solid transparent; transition: background-color .15s ease, border-color .15s ease; }' +
            '#modal-force-assign #force-assign-list .force-assign-item:not(.is-selected):hover {' +
            'background-color: var(--tblr-bg-surface-secondary, #f8fafc); }' +
            '#modal-force-assign #force-assign-list .force-assign-item.is-selected {' +
            'background-color: var(--tblr-bg-surface-secondary, #f8fafc);' +
            'border-color: var(--tblr-border-color, #e6e7e9); }' +
            '#modal-force-assign .force-assign-selected-banner {' +
            'background-color: var(--tblr-bg-surface-secondary, #f8fafc);' +
            'border: 1px solid var(--tblr-border-color, #e6e7e9); }' +
            '#modal-force-assign .force-assign-check {' +
            'display: inline-flex; align-items: center; justify-content: center; width: 1.25rem; height: 1.25rem;' +
            'border-radius: 50%; background-color: var(--tblr-success, #2fb344); color: #fff; flex-shrink: 0; }' +
            '#modal-force-assign .force-assign-check svg { width: 0.75rem; height: 0.75rem; }';
        document.head.appendChild(style);
    }

    function selectedCheckIcon() {
        return '<span class="force-assign-check" aria-hidden="true">' +
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
            'stroke-width="3" stroke-linecap="round" stroke-linejoin="round">' +
            '<path d="M5 12l5 5l10 -10"/></svg></span>';
    }

    function clearSelection() {
        selectedUserId = null;
        selectedName = '';
        var hidden = el('force-assign-beautician');
        if (hidden) hidden.value = '';
        var selectedEl = el('force-assign-selected');
        if (selectedEl) {
            selectedEl.classList.add('d-none');
            selectedEl.textContent = '';
        }
        var list = el('force-assign-list');
        if (list) {
            list.querySelectorAll('.force-assign-item.is-selected').forEach(function (item) {
                item.classList.remove('is-selected');
                var check = item.querySelector('.force-assign-check');
                if (check) check.remove();
            });
        }
    }

    function showSelected() {
        var selectedEl = el('force-assign-selected');
        if (!selectedEl) return;
        if (!selectedUserId) {
            selectedEl.classList.add('d-none');
            selectedEl.textContent = '';
            return;
        }
        selectedEl.classList.remove('d-none');
        selectedEl.innerHTML = '<strong>Selected:</strong> ' + escapeHtml(selectedName);
    }

    function renderPagination(meta) {
        var info = el('force-assign-pagination-info');
        var ul = el('force-assign-pagination-btns');
        if (!info || !ul) return;

        var total = meta.total || 0;
        var page = meta.page || state.page || 1;
        var limit = meta.limit || state.limit || 15;
        var pages = meta.totalPages || 1;
        state.totalPages = pages;

        var from = total ? (page - 1) * limit + 1 : 0;
        var to = Math.min(page * limit, total);
        info.textContent = total ? 'Showing ' + from + '\u2013' + to + ' of ' + total : 'No results';

        ul.innerHTML = '';
        ul.insertAdjacentHTML('beforeend',
            '<li class="page-item ' + (page <= 1 ? 'disabled' : '') + '">' +
            '<a class="page-link" href="#" data-page="' + (page - 1) + '">\u00ab</a></li>');
        var start = Math.max(1, page - 2);
        var end = Math.min(pages, start + 4);
        for (var p = start; p <= end; p++) {
            ul.insertAdjacentHTML('beforeend',
                '<li class="page-item ' + (p === page ? 'active' : '') + '">' +
                '<a class="page-link" href="#" data-page="' + p + '">' + p + '</a></li>');
        }
        ul.insertAdjacentHTML('beforeend',
            '<li class="page-item ' + (page >= pages ? 'disabled' : '') + '">' +
            '<a class="page-link" href="#" data-page="' + (page + 1) + '">\u00bb</a></li>');
    }

    function formatRating(value) {
        if (value == null || value === '') return '\u2014';
        var num = typeof value === 'string' ? parseFloat(value) : value;
        if (Number.isNaN(num)) return '\u2014';
        return num.toFixed(1);
    }

    function toNumber(value) {
        if (value == null || value === '') return null;
        var num = typeof value === 'string' ? parseFloat(value) : value;
        return Number.isNaN(num) ? null : num;
    }

    function extractCoords(source) {
        if (!source || typeof source !== 'object') return null;

        var nested = source.lastKnownLocation || source.currentLocation || source.coordinates || null;
        if (nested && typeof nested === 'object') {
            var nestedCoords = extractCoords(nested);
            if (nestedCoords) return nestedCoords;
        }

        // Prefer temp* when both are non-null; otherwise fall back to standard fields
        var tempLat = toNumber(source.tempLatitude ?? source.tempLat);
        var tempLng = toNumber(source.tempLongitude ?? source.tempLng);
        if (tempLat != null && tempLng != null) {
            return { lat: tempLat, lng: tempLng };
        }

        var lat = toNumber(source.lat ?? source.latitude ?? source.currentLat ?? source.lastKnownLat);
        var lng = toNumber(source.lng ?? source.longitude ?? source.currentLng ?? source.lastKnownLng);
        if (lat == null || lng == null) return null;
        return { lat: lat, lng: lng };
    }

    function extractBeauticianCoords(beautician) {
        if (!beautician || typeof beautician !== 'object') return null;

        // Prefer temporary live coords when both are present (only if not null)
        var tempLat = toNumber(beautician.tempLatitude ?? beautician.tempLat);
        var tempLng = toNumber(beautician.tempLongitude ?? beautician.tempLng);
        if (tempLat != null && tempLng != null) {
            return { lat: tempLat, lng: tempLng };
        }

        return extractCoords({
            lat: beautician.currentLat ?? beautician.lastKnownLat ?? beautician.lat ?? beautician.latitude,
            lng: beautician.currentLng ?? beautician.lastKnownLng ?? beautician.lng ?? beautician.longitude,
            currentLocation: beautician.currentLocation,
            lastKnownLocation: beautician.lastKnownLocation,
            coordinates: beautician.coordinates,
            tempLatitude: beautician.tempLatitude,
            tempLongitude: beautician.tempLongitude,
        });
    }

    function extractBookingCoords(booking) {
        if (!booking || typeof booking !== 'object') return null;
        // Service / job location — temp coords first when both set, then address / location
        var tempLat = toNumber(booking.tempLatitude ?? booking.tempLat);
        var tempLng = toNumber(booking.tempLongitude ?? booking.tempLng);
        if (tempLat != null && tempLng != null) {
            return { lat: tempLat, lng: tempLng };
        }
        return extractCoords(booking.address)
            || (typeof booking.location === 'object' ? extractCoords(booking.location) : null)
            || extractCoords(booking);
    }

    async function loadBookingCoords(id) {
        bookingCoords = null;
        try {
            var booking = await Bookings.getOne(id);
            bookingCoords = extractBookingCoords(booking);
        } catch (err) {
            bookingCoords = null;
        }
    }

    function haversineKm(lat1, lng1, lat2, lng2) {
        var toRad = function (deg) { return deg * Math.PI / 180; };
        var earthRadiusKm = 6371;
        var dLat = toRad(lat2 - lat1);
        var dLng = toRad(lng2 - lng1);
        var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
        return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    function formatDistanceLabel(km) {
        if (km == null || Number.isNaN(km)) return null;
        if (km < 1) return Math.round(km * 1000) + ' m';
        return km.toFixed(1) + ' km';
    }

    function getBeauticianDistanceLabel(beautician) {
        if (beautician.distanceKm != null) {
            return formatDistanceLabel(toNumber(beautician.distanceKm));
        }
        if (!bookingCoords) return null;
        var beauticianCoords = extractBeauticianCoords(beautician);
        if (!beauticianCoords) return null;
        return formatDistanceLabel(haversineKm(
            bookingCoords.lat,
            bookingCoords.lng,
            beauticianCoords.lat,
            beauticianCoords.lng
        ));
    }

    function renderDistanceHtml(beautician) {
        var label = getBeauticianDistanceLabel(beautician);
        if (label) {
            return '<span class="text-secondary small">' + escapeHtml(label) + ' away</span>';
        }
        if (!bookingCoords) {
            return '<span class="text-secondary small">Distance unavailable</span>';
        }
        return '<span class="text-secondary small">Location unknown</span>';
    }

    function renderList(rows, meta) {
        var list = el('force-assign-list');
        if (!list) return;

        if (!rows.length) {
            var noResultsMsg = 'No eligible beauticians found.';
            if (state.search || state.availabilityStatus) {
                noResultsMsg = 'No beauticians match your filters.';
            }
            list.innerHTML = '<div class="list-group-item text-center text-secondary py-5">' +
                noResultsMsg + '</div>';
            renderPagination(meta);
            return;
        }

        list.innerHTML = rows.map(function (b) {
            var uid = Beauticians.beauticianUserId(b);
            var name = Beauticians.fullName(b);
            var user = b.user || {};
            var dob = Beauticians.formatDateOfBirth(b);
            var subParts = [user.email, user.phone];
            if (dob !== '\u2014' && dob !== '—') subParts.push('Born ' + dob);
            var sub = subParts.filter(Boolean).join(' \u00b7 ');
            var rating = formatRating(b.ratingAverage);
            var isSelected = uid && uid === selectedUserId;
            var selectedCls = isSelected ? ' is-selected' : '';
            var nameRow = '<div class="fw-semibold d-flex align-items-center gap-2">' +
                (isSelected ? selectedCheckIcon() : '') +
                '<span>' + escapeHtml(name) + '</span></div>';
            return '<button type="button" class="force-assign-item list-group-item text-start' + selectedCls + '" ' +
                'data-user-id="' + escapeHtml(uid) + '" data-user-name="' + escapeHtml(name) + '">' +
                '<div class="d-flex justify-content-between align-items-start gap-3">' +
                '<div class="min-w-0">' + nameRow +
                (sub ? '<div class="text-secondary small text-truncate">' + escapeHtml(sub) + '</div>' : '') +
                '</div>' +
                '<div class="text-end flex-shrink-0">' +
                Beauticians.availabilityBadge(b.availabilityStatus) +
                '<div class="d-flex align-items-center justify-content-end gap-2 flex-wrap mt-1">' +
                '<span class="text-secondary small"><span class="fw-semibold text-body">' + rating + '</span> rating</span>' +
                '<span class="text-secondary small opacity-50" aria-hidden="true">·</span>' +
                renderDistanceHtml(b) +
                '</div>' +
                '</div></div></button>';
        }).join('');
        renderPagination(meta);
    }

    function setListLoading() {
        var list = el('force-assign-list');
        if (list) {
            list.innerHTML = '<div class="list-group-item text-center py-5">' +
                '<div class="spinner-border spinner-border-sm text-primary" role="status"></div>' +
                '</div>';
        }
        var info = el('force-assign-pagination-info');
        if (info) info.textContent = 'Loading\u2026';
        var ul = el('force-assign-pagination-btns');
        if (ul) ul.innerHTML = '';
    }

    async function loadBeauticians() {
        setListLoading();
        try {
            var result = await Beauticians.listBeauticians({
                page: state.page,
                limit: state.limit,
                search: state.search,
                availabilityStatus: state.availabilityStatus,
                profileStatus: 'APPROVED',
                kycStatus: 'VERIFIED',
            });
            var rows = (result.data || []).filter(function (b) {
                return b.isActive !== false && Beauticians.beauticianUserId(b);
            });
            var meta = result.meta || {};
            if (!meta.page) meta.page = state.page;
            if (!meta.limit) meta.limit = state.limit;
            renderList(rows, meta);
        } catch (err) {
            var list = el('force-assign-list');
            if (list) {
                list.innerHTML = '<div class="list-group-item text-center text-danger py-5">' +
                    escapeHtml(err.message || 'Failed to load beauticians.') + '</div>';
            }
            renderPagination({});
        }
    }

    function selectBeautician(userId, name) {
        selectedUserId = userId;
        selectedName = name || '';
        var hidden = el('force-assign-beautician');
        if (hidden) hidden.value = userId || '';
        var errEl = el('force-assign-error');
        if (errEl) errEl.classList.add('d-none');

        var list = el('force-assign-list');
        if (list) {
            list.querySelectorAll('.force-assign-item').forEach(function (item) {
                var isMatch = item.dataset.userId === userId;
                item.classList.toggle('is-selected', isMatch);
                var nameRow = item.querySelector('.fw-semibold');
                if (!nameRow) return;
                var existingCheck = nameRow.querySelector('.force-assign-check');
                if (isMatch && !existingCheck) {
                    nameRow.insertAdjacentHTML('afterbegin', selectedCheckIcon());
                } else if (!isMatch && existingCheck) {
                    existingCheck.remove();
                }
            });
        }
        showSelected();
    }

    function init(options) {
        if (initialized) return;
        initialized = true;
        injectStyles();
        onSuccess = (options && options.onSuccess) || null;

        var searchInput = el('force-assign-search');
        if (searchInput) {
            searchInput.addEventListener('input', function () {
                clearTimeout(searchTimer);
                var val = this.value.trim();
                searchTimer = setTimeout(function () {
                    state.search = val;
                    state.page = 1;
                    loadBeauticians();
                }, 400);
            });
        }

        var availabilityFilter = el('force-assign-availability');
        if (availabilityFilter) {
            availabilityFilter.addEventListener('change', function () {
                state.availabilityStatus = this.value;
                state.page = 1;
                loadBeauticians();
            });
        }

        var pagination = el('force-assign-pagination-btns');
        if (pagination) {
            pagination.addEventListener('click', function (e) {
                e.preventDefault();
                var link = e.target.closest('a[data-page]');
                if (!link) return;
                var page = parseInt(link.dataset.page, 10);
                if (page < 1 || page > state.totalPages) return;
                state.page = page;
                loadBeauticians();
            });
        }

        var list = el('force-assign-list');
        if (list) {
            list.addEventListener('click', function (e) {
                var item = e.target.closest('.list-group-item[data-user-id]');
                if (!item) return;
                selectBeautician(item.dataset.userId, item.dataset.userName);
            });
        }

        var confirmBtn = el('btn-force-assign-confirm');
        if (confirmBtn) {
            confirmBtn.addEventListener('click', async function () {
                if (!bookingId) return;
                var errEl = el('force-assign-error');
                if (!selectedUserId) {
                    if (errEl) {
                        errEl.textContent = 'Please select a beautician.';
                        errEl.classList.remove('d-none');
                    }
                    return;
                }
                if (!confirm('Force assign this booking to the selected beautician?')) return;

                confirmBtn.disabled = true;
                if (errEl) errEl.classList.add('d-none');
                try {
                    await Bookings.forceAssign(bookingId, selectedUserId);
                    var modalEl = el('modal-force-assign');
                    var bs = getBootstrap();
                    if (modalEl && bs) bs.Modal.getInstance(modalEl).hide();
                    if (typeof onSuccess === 'function') {
                        await onSuccess(bookingId);
                    }
                } catch (err) {
                    if (errEl) {
                        errEl.textContent = err.message || 'Failed to force assign.';
                        errEl.classList.remove('d-none');
                    }
                } finally {
                    confirmBtn.disabled = false;
                }
            });
        }

        var modalEl = el('modal-force-assign');
        if (modalEl) {
            modalEl.addEventListener('hidden.bs.modal', function () {
                bookingId = null;
                bookingCoords = null;
                clearSelection();
                state.page = 1;
                state.search = '';
                state.availabilityStatus = '';
                if (searchInput) searchInput.value = '';
                if (availabilityFilter) availabilityFilter.value = '';
                var errEl = el('force-assign-error');
                if (errEl) errEl.classList.add('d-none');
            });
        }
    }

    function open(id) {
        if (!id) return;
        bookingId = id;
        state.page = 1;
        state.search = '';
        state.availabilityStatus = '';
        var searchInput = el('force-assign-search');
        if (searchInput) searchInput.value = '';
        var availabilityFilter = el('force-assign-availability');
        if (availabilityFilter) availabilityFilter.value = '';
        var errEl = el('force-assign-error');
        if (errEl) errEl.classList.add('d-none');
        clearSelection();
        setListLoading();
        var modalEl = el('modal-force-assign');
        var bs = getBootstrap();
        if (modalEl && bs) bs.Modal.getOrCreateInstance(modalEl).show();
        loadBookingCoords(id).then(loadBeauticians);
    }

    return { init: init, open: open };
})();