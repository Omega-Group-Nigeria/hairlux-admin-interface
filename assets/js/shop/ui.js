/**
 * shop/ui.js — section navigation and table/detail rendering
 */
(function (global) {
    'use strict';

    var SP = (global.ShopPage = global.ShopPage || {});
    var State = SP.State;
    var Utils = SP.Utils;
    var Api = SP.Api;
    var bootstrap = global.tabler && global.tabler.bootstrap;

    var setPageAlert = Utils.setPageAlert;
    var flashPageAlert = Utils.flashPageAlert;
    var setTableLoading = Utils.setTableLoading;
    var showSectionTableLoading = Utils.showSectionTableLoading;
    var esc = Utils.esc;
    var escAttr = Utils.escAttr;
    var buildStateSelectOptions = Utils.buildStateSelectOptions;
    var populateStateSelect = Utils.populateStateSelect;
    var regionActiveBadge = Utils.regionActiveBadge;

function initSectionTabs() {
    document.getElementById("section-tabs").addEventListener("click", function (e) {
        e.preventDefault();
        var tab = e.target.closest("a[data-section]");
        if (!tab) return;
        switchSection(tab.dataset.section, true);
    });
    window.addEventListener("hashchange", applySectionFromHash);
}

function applySectionFromHash() {
    var hash = (window.location.hash || "").replace(/^#/, "").toLowerCase();
    if (State.VALID_SECTIONS.indexOf(hash) === -1) hash = "products";
    switchSection(hash, false);
}

function switchSection(section, updateHash) {
    if (State.VALID_SECTIONS.indexOf(section) === -1) section = "products";
    State.currentSection = section;
    if (updateHash !== false && window.location.hash.replace(/^#/, "") !== section) {
        history.replaceState(null, "", "#" + section);
    }
    document.querySelectorAll("#section-tabs .nav-link").forEach(function (t) { t.classList.toggle("active", t.dataset.section === section); });
    ["products", "categories", "delivery", "orders"].forEach(function (s) {
        var pane = document.getElementById("section-" + s);
        if (pane) pane.classList.toggle("d-none", s !== section);
    });
    var headerBtn = document.getElementById("btn-header-action");
    headerBtn.classList.add("d-none");
    if (section === "products" && RBAC.can(Shop.PERMISSIONS.MANAGE_PRODUCTS)) {
        headerBtn.classList.remove("d-none");
        headerBtn.textContent = "Add Product";
    } else if (section === "categories" && RBAC.can(Shop.PERMISSIONS.MANAGE_CATEGORIES)) {
        headerBtn.classList.remove("d-none");
        headerBtn.textContent = "Add Category";
    } else if (section === "delivery" && RBAC.can(Shop.PERMISSIONS.MANAGE_DELIVERY)) {
        headerBtn.classList.remove("d-none");
        headerBtn.textContent = "Add Region";
    }
    refreshCurrentSection();
}

function initProductRowDropdowns() {
    document.getElementById("products-tbody").querySelectorAll('[data-bs-toggle="dropdown"]').forEach(function (el) {
        bootstrap.Dropdown.getOrCreateInstance(el, {
            popperConfig: { strategy: "fixed" },
        });
    });
}

function renderProductsTable(rows) {
    var tbody = document.getElementById("products-tbody");
    if (!rows.length) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-secondary py-5">No products found.</td></tr>';
        return;
    }
    var imgDefault = '<span class="avatar avatar-sm bg-secondary-lt text-secondary" style="width:48px;height:48px;border-radius:6px;font-size:10px">IMG</span>';
    tbody.innerHTML = rows.map(function (p) {
        var catName = (p.category && p.category.name) || "—";
        var imageUrl = Shop.getProductImageUrl(p);
        var thumb = imageUrl
            ? '<img src="' + esc(imageUrl) + '" class="product-thumb" alt="" loading="lazy">'
            : imgDefault;
        var actions = "—";
        if (RBAC.can(Shop.PERMISSIONS.MANAGE_PRODUCTS)) {
            var toggleLabel = p.status === "ACTIVE" ? "Deactivate" : "Activate";
            actions =
                '<div class="dropdown dropup">' +
                '<button type="button" class="btn btn-sm btn-icon btn-ghost-secondary" data-bs-toggle="dropdown" data-bs-boundary="window" aria-expanded="false" aria-label="More actions">' +
                State.PRODUCT_ACTIONS_ICON +
                "</button>" +
                '<div class="dropdown-menu dropdown-menu-end">' +
                '<button type="button" class="dropdown-item btn-edit-product" data-id="' + p.id + '">Edit</button>' +
                '<button type="button" class="dropdown-item btn-toggle-product" data-id="' + p.id + '" data-status="' + p.status + '" data-name="' + escAttr(p.name) + '">' + toggleLabel + '</button>' +
                '<div class="dropdown-divider"></div>' +
                '<button type="button" class="dropdown-item text-danger btn-delete-product" data-id="' + p.id + '" data-name="' + escAttr(p.name) + '">Delete</button>' +
                "</div></div>";
        }
        return '<tr>' +
            '<td style="width:56px;padding-right:0">' + thumb + '</td>' +
            '<td>' +
                '<div class="fw-semibold">' + esc(p.name) + '</div>' +
                '<div class="text-secondary small text-truncate" style="max-width:260px">' + esc(p.description || "") + '</div>' +
            '</td>' +
            '<td><span class="badge bg-primary-lt text-primary">' + esc(catName) + '</span></td>' +
            '<td class="fw-semibold">' + Shop.formatMoney(p.price) + '</td>' +
            '<td>' + Shop.stockBadge(p.stock, p.inStock) + '</td>' +
            '<td>' + Shop.statusBadge(p.status) + '</td>' +
            '<td class="products-actions-cell">' + actions + '</td></tr>';
    }).join("");
    initProductRowDropdowns();
}

function ensureProductImageManager() {
    if (State.productImages) return State.productImages;
    State.productImages = new ShopProductImages.ProductImageManager({
        galleryEl: document.getElementById("product-images-gallery"),
        dropzoneEl: document.getElementById("dz-product-images"),
        countEl: document.getElementById("product-images-count"),
        hintEl: document.getElementById("product-images-hint"),
        requiredMarkEl: document.getElementById("img-required-mark"),
    });
    State.productImages.initDropzone();
    return State.productImages;
}

function updateOrderStats(rows) {
    document.getElementById("stat-orders-total").textContent = rows.length;
    document.getElementById("stat-orders-pending").textContent = rows.filter(function (o) { return o.status === "CONFIRMED" || o.status === "PROCESSING"; }).length;
    document.getElementById("stat-orders-shipped").textContent = rows.filter(function (o) { return o.status === "SHIPPED"; }).length;
    document.getElementById("stat-orders-delivered").textContent = rows.filter(function (o) { return o.status === "DELIVERED"; }).length;
}

    SP.UI = {
        initSectionTabs: initSectionTabs,
        applySectionFromHash: applySectionFromHash,
        switchSection: switchSection,
        initProductRowDropdowns: initProductRowDropdowns,
        renderProductsTable: renderProductsTable,
        ensureProductImageManager: ensureProductImageManager,
        updateOrderStats: updateOrderStats,
    };
})(window);
