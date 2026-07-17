/**
 * shop/handlers.js — loaders, CRUD actions, event binding
 */
(function (global) {
    'use strict';

    var SP = (global.ShopPage = global.ShopPage || {});
    var State = SP.State;
    var Utils = SP.Utils;
    var UI = SP.UI;
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

    var initSectionTabs = UI.initSectionTabs;
    var applySectionFromHash = UI.applySectionFromHash;
    var switchSection = UI.switchSection;
    var initProductRowDropdowns = UI.initProductRowDropdowns;
    var renderProductsTable = UI.renderProductsTable;
    var ensureProductImageManager = UI.ensureProductImageManager;
    var updateOrderStats = UI.updateOrderStats;

async function loadNigerianStates() {
    if (State.nigerianStates) return State.nigerianStates;
    var res = await fetch("./assets/data/nigeria-states.json");
    if (!res.ok) throw new Error("Could not load states list");
    var data = await res.json();
    State.nigerianStates = Array.isArray(data) ? data : (data.states || []);
    populateStateSelect(document.getElementById("new-region-state"), "");
    return State.nigerianStates;
}

async function ensureNigerianStates() {
    if (!State.nigerianStates) await loadNigerianStates();
    return State.nigerianStates;
}

function loadActiveSection() {
    if (State.currentSection === "products") {
        if (!Shop.canViewProducts()) return Promise.resolve();
        return Promise.all([
            loadProducts(),
            loadProductStats(),
            loadCategoriesForFilters(),
        ]);
    }
    if (State.currentSection === "categories") {
        if (!Shop.canViewCategories()) return Promise.resolve();
        return loadCategoriesTable();
    }
    if (State.currentSection === "delivery") {
        if (!Shop.canViewDelivery()) return Promise.resolve();
        return loadDeliveryTable();
    }
    if (State.currentSection === "orders") {
        if (!Shop.canViewOrders()) return Promise.resolve();
        return loadOrders();
    }
    return Promise.resolve();
}

function refreshCurrentSection() {
    showSectionTableLoading(State.currentSection);
    return loadActiveSection();
}

function initProductEvents() {
    document.getElementById("product-status-tabs").addEventListener("click", function (e) {
        e.preventDefault();
        var tab = e.target.closest("a[data-status]");
        if (!tab) return;
        document.querySelectorAll("#product-status-tabs .nav-link").forEach(function (t) { t.classList.remove("active"); });
        tab.classList.add("active");
        State.product.status = tab.dataset.status;
        loadProducts();
    });
    var searchTimer;
    document.getElementById("product-filter-search").addEventListener("input", function () {
        clearTimeout(searchTimer);
        var val = this.value.trim();
        searchTimer = setTimeout(function () { State.product.search = val; loadProducts(); }, 400);
    });
    document.getElementById("product-filter-category").addEventListener("change", function () {
        State.product.categoryId = this.value;
        loadProducts();
    });
    document.getElementById("btn-product-clear").addEventListener("click", function () {
        document.getElementById("product-filter-search").value = "";
        document.getElementById("product-filter-category").value = "";
        document.querySelector("#product-status-tabs .nav-link[data-status='']").classList.add("active");
        document.querySelectorAll("#product-status-tabs .nav-link:not([data-status=''])").forEach(function (t) { t.classList.remove("active"); });
        State.product = { status: "", search: "", categoryId: "" };
        loadProducts();
    });
    document.getElementById("products-tbody").addEventListener("click", function (e) {
        var editBtn = e.target.closest(".btn-edit-product");
        var toggleBtn = e.target.closest(".btn-toggle-product");
        var deleteBtn = e.target.closest(".btn-delete-product");
        if (editBtn) {
            e.preventDefault();
            openProductModal(editBtn.dataset.id);
        }
        if (toggleBtn) {
            e.preventDefault();
            confirmToggleProduct(toggleBtn.dataset.id, toggleBtn.dataset.status, toggleBtn.dataset.name);
        }
        if (deleteBtn) {
            e.preventDefault();
            confirmDeleteProduct(deleteBtn.dataset.id, deleteBtn.dataset.name);
        }
    });
}

function initCategoryEvents() {
    document.getElementById("categories-tbody").addEventListener("click", function (e) {
        var editBtn = e.target.closest(".btn-cat-edit");
        var saveBtn = e.target.closest(".btn-cat-save");
        var cancelBtn = e.target.closest(".btn-cat-cancel");
        var deleteBtn = e.target.closest(".btn-cat-delete");
        if (editBtn) editCategoryInline(editBtn.dataset.id, editBtn.dataset.name, editBtn.dataset.desc);
        if (saveBtn) saveCategoryInline(saveBtn.dataset.id);
        if (cancelBtn) loadCategoriesTable();
        if (deleteBtn) confirmDeleteCategory(deleteBtn.dataset.id, deleteBtn.dataset.name);
    });
}

function initDeliveryEvents() {
    document.getElementById("delivery-tbody").addEventListener("click", function (e) {
        var editBtn = e.target.closest(".btn-region-edit");
        var saveBtn = e.target.closest(".btn-region-save");
        var cancelBtn = e.target.closest(".btn-region-cancel");
        var deleteBtn = e.target.closest(".btn-region-delete");
        if (editBtn) editRegionInline(editBtn.dataset.id, editBtn.dataset.name, editBtn.dataset.state, editBtn.dataset.fee, editBtn.dataset.active === "true");
        if (saveBtn) saveRegionInline(saveBtn.dataset.id);
        if (cancelBtn) loadDeliveryTable();
        if (deleteBtn) confirmDeleteRegion(deleteBtn.dataset.id, deleteBtn.dataset.name);
    });
}

function initOrderEvents() {
    var orderSearchTimer;
    document.getElementById("order-status-tabs").addEventListener("click", function (e) {
        e.preventDefault();
        var tab = e.target.closest("a[data-status]");
        if (!tab) return;
        document.querySelectorAll("#order-status-tabs .nav-link").forEach(function (t) { t.classList.remove("active"); });
        tab.classList.add("active");
        State.order.status = tab.dataset.status;
        loadOrders();
    });
    document.getElementById("order-filter-search").addEventListener("input", function () {
        clearTimeout(orderSearchTimer);
        var val = this.value.trim();
        orderSearchTimer = setTimeout(function () { State.order.search = val; loadOrders(); }, 400);
    });
    document.getElementById("order-filter-start").addEventListener("change", function () { State.order.startDate = this.value; loadOrders(); });
    document.getElementById("order-filter-end").addEventListener("change", function () { State.order.endDate = this.value; loadOrders(); });
    document.getElementById("btn-order-clear").addEventListener("click", function () {
        document.getElementById("order-filter-search").value = "";
        document.getElementById("order-filter-start").value = "";
        document.getElementById("order-filter-end").value = "";
        document.querySelector("#order-status-tabs .nav-link[data-status='']").classList.add("active");
        document.querySelectorAll("#order-status-tabs .nav-link:not([data-status=''])").forEach(function (t) { t.classList.remove("active"); });
        State.order = { status: "", startDate: "", endDate: "", search: "" };
        loadOrders();
    });
    document.getElementById("orders-tbody").addEventListener("click", function (e) {
        var row = e.target.closest(".order-row");
        if (row) openOrderDetail(row.dataset.id);
    });
}

function loadProductSection() {
    showSectionTableLoading("products");
    return Promise.all([
        loadProducts(),
        loadProductStats(),
        loadCategoriesForFilters(),
    ]);
}

async function loadCategoriesForFilters() {
    try {
        State.categories = await Api.getCategories();
        var sel = document.getElementById("product-filter-category");
        var modalSel = document.getElementById("product-category");
        var opts = '<option value="">All categories</option>' + State.categories.map(function (c) {
            return '<option value="' + c.id + '">' + esc(c.name) + '</option>';
        }).join("");
        sel.innerHTML = opts;
        modalSel.innerHTML = '<option value="">Select…</option>' + State.categories.map(function (c) {
            return '<option value="' + c.id + '">' + esc(c.name) + '</option>';
        }).join("");
        document.getElementById("stat-products-categories").textContent = State.categories.length;
    } catch (e) { console.warn(e); }
}

async function loadProductStats() {
    try {
        var all = await Api.getProducts({});
        var active = await Api.getProducts({ status: "ACTIVE" });
        var inactive = await Api.getProducts({ status: "INACTIVE" });
        document.getElementById("stat-products-total").textContent = all.items.length;
        document.getElementById("stat-products-active").textContent = active.items.length;
        document.getElementById("stat-products-inactive").textContent = inactive.items.length;
    } catch (e) { console.warn(e); }
}

async function loadProducts() {
    setTableLoading("products-tbody", 7);
    document.getElementById("products-results-label").textContent = "Loading…";
    var tbody = document.getElementById("products-tbody");
    try {
        var result = await Api.getProducts({
            status: State.product.status || undefined,
            search: State.product.search || undefined,
            categoryId: State.product.categoryId || undefined,
        });
        var rows = result.items;
        document.getElementById("products-results-label").textContent = rows.length + " product" + (rows.length !== 1 ? "s" : "");
        document.getElementById("products-pagination").textContent = rows.length + " product" + (rows.length !== 1 ? "s" : "") + " found";
        renderProductsTable(rows);
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-danger py-4">' + esc(e.message) + '</td></tr>';
    }
}

async function openProductModal(id) {
    if (!RBAC.can(Shop.PERMISSIONS.MANAGE_PRODUCTS)) return;
    var images = ensureProductImageManager();
    State.editProductId = id;
    images.reset();
    document.getElementById("modal-product-error").classList.add("d-none");
    document.getElementById("modal-product-title").textContent = id ? "Edit Product" : "Add Product";
    document.getElementById("btn-save-product").textContent = id ? "Save Changes" : "Create Product";
    document.getElementById("product-status-row").style.display = id ? "" : "none";
    document.getElementById("product-name").value = "";
    document.getElementById("product-description").value = "";
    document.getElementById("product-price").value = "";
    document.getElementById("product-stock").value = "";
    await loadCategoriesForFilters();
    if (id) {
        try {
            var p = await Api.getProduct(id);
            document.getElementById("product-name").value = p.name || "";
            document.getElementById("product-description").value = p.description || "";
            document.getElementById("product-category").value = p.categoryId || "";
            document.getElementById("product-price").value = p.price ?? "";
            document.getElementById("product-stock").value = p.stock ?? "";
            document.getElementById("product-status").value = p.status || "ACTIVE";
            State.editProductStatus = p.status || "ACTIVE";
            images.loadProduct(p);
        } catch (e) {
            document.getElementById("modal-product-error").textContent = e.message;
            document.getElementById("modal-product-error").classList.remove("d-none");
        }
    }
    new bootstrap.Modal(document.getElementById("modal-product")).show();
}

async function saveProduct() {
    var errEl = document.getElementById("modal-product-error");
    errEl.classList.add("d-none");
    var name = document.getElementById("product-name").value.trim();
    var description = document.getElementById("product-description").value.trim();
    var categoryId = document.getElementById("product-category").value;
    var price = parseFloat(document.getElementById("product-price").value);
    var stock = parseInt(document.getElementById("product-stock").value, 10);
    var status = document.getElementById("product-status").value;
    if (!name || !categoryId || isNaN(price) || isNaN(stock)) {
        errEl.textContent = "Please fill in all required fields.";
        errEl.classList.remove("d-none");
        return;
    }
    var images = ensureProductImageManager();
    var imageValidation = images.validate();
    if (!imageValidation.ok) {
        errEl.textContent = imageValidation.message;
        errEl.classList.remove("d-none");
        return;
    }
    var fd = new FormData();
    fd.append("name", name);
    fd.append("description", description);
    fd.append("categoryId", categoryId);
    fd.append("price", price);
    fd.append("stock", stock);
    images.appendToFormData(fd);
    var btn = document.getElementById("btn-save-product");
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-inline me-1"></span>Saving…';
    try {
        if (State.editProductId) {
            await Api.updateProduct(State.editProductId, fd);
            if (status !== State.editProductStatus) await Api.updateProductStatus(State.editProductId, status);
        } else {
            await Api.createProduct(fd);
        }
        bootstrap.Modal.getInstance(document.getElementById("modal-product")).hide();
        loadProductSection();
        flashPageAlert("success", State.editProductId ? "Product updated successfully." : "Product created successfully.");
    } catch (e) {
        errEl.textContent = e.message || "Failed to save product.";
        errEl.classList.remove("d-none");
    } finally {
        btn.disabled = false;
        btn.textContent = State.editProductId ? "Save Changes" : "Create Product";
    }
}

function confirmToggleProduct(id, status, name) {
    var newStatus = status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    State.pendingOp = { type: "toggleProduct", id: id, newStatus: newStatus };
    document.getElementById("confirm-title").textContent = newStatus === "INACTIVE" ? "Deactivate Product" : "Activate Product";
    document.getElementById("confirm-msg").textContent = 'Change "' + name + '" to ' + newStatus + "?";
    document.getElementById("confirm-notes-wrap").classList.add("d-none");
    document.getElementById("btn-confirm-action").className = "btn btn-warning";
    document.getElementById("btn-confirm-action").textContent = "Confirm";
    new bootstrap.Modal(document.getElementById("modal-confirm")).show();
}

function confirmDeleteProduct(id, name) {
    State.pendingOp = { type: "deleteProduct", id: id };
    document.getElementById("confirm-title").textContent = "Delete Product";
    document.getElementById("confirm-msg").textContent = 'Permanently delete "' + name + '"?';
    document.getElementById("confirm-notes-wrap").classList.add("d-none");
    document.getElementById("btn-confirm-action").className = "btn btn-danger";
    document.getElementById("btn-confirm-action").textContent = "Delete";
    new bootstrap.Modal(document.getElementById("modal-confirm")).show();
}

async function loadCategoriesTable() {
    setTableLoading("categories-tbody", 4, "py-4");
    var tbody = document.getElementById("categories-tbody");
    try {
        var cats = await Api.getCategories();
        if (!cats.length) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center text-secondary py-4">No categories yet.</td></tr>';
            return;
        }
        tbody.innerHTML = cats.map(function (c) {
            var actions = "";
            if (RBAC.can(Shop.PERMISSIONS.MANAGE_CATEGORIES)) {
                actions = '<div class="d-flex gap-1">' +
                    '<button class="btn btn-sm btn-ghost-primary btn-cat-edit" data-id="' + c.id + '" data-name="' + escAttr(c.name) + '" data-desc="' + escAttr(c.description || "") + '">Edit</button>' +
                    '<button class="btn btn-sm btn-ghost-danger btn-cat-delete" data-id="' + c.id + '" data-name="' + escAttr(c.name) + '">Delete</button></div>';
            }
            return '<tr data-id="' + c.id + '"><td class="fw-semibold">' + esc(c.name) + '</td><td class="text-secondary small">' + esc(c.description || "—") + '</td><td class="text-center">' + (c.productCount || 0) + '</td><td>' + actions + '</td></tr>';
        }).join("");
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center text-danger py-4">' + esc(e.message) + '</td></tr>';
    }
}

function openCategoryModal() {
    if (!RBAC.can(Shop.PERMISSIONS.MANAGE_CATEGORIES)) return;
    document.getElementById("modal-category-error").classList.add("d-none");
    document.getElementById("new-category-name").value = "";
    document.getElementById("new-category-desc").value = "";
    new bootstrap.Modal(document.getElementById("modal-category")).show();
    setTimeout(function () { document.getElementById("new-category-name").focus(); }, 300);
}

async function addCategory() {
    if (!RBAC.can(Shop.PERMISSIONS.MANAGE_CATEGORIES)) return;
    var errEl = document.getElementById("modal-category-error");
    errEl.classList.add("d-none");
    var nameEl = document.getElementById("new-category-name");
    var descEl = document.getElementById("new-category-desc");
    var name = nameEl.value.trim();
    var desc = descEl.value.trim();
    if (!name) {
        errEl.textContent = "Please enter a category name.";
        errEl.classList.remove("d-none");
        nameEl.classList.add("is-invalid");
        return;
    }
    nameEl.classList.remove("is-invalid");
    var btn = document.getElementById("btn-save-category");
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-inline me-1"></span>Adding…';
    try {
        await Api.createCategory({ name: name, description: desc });
        bootstrap.Modal.getInstance(document.getElementById("modal-category")).hide();
        loadCategoriesTable();
        if (State.currentSection === "products") loadCategoriesForFilters();
        flashPageAlert("success", "Category added successfully.");
    } catch (e) {
        errEl.textContent = e.message || "Failed to add category.";
        errEl.classList.remove("d-none");
    } finally {
        btn.disabled = false;
        btn.textContent = "Add Category";
    }
}

function editCategoryInline(id, name, desc) {
    var row = document.querySelector('#categories-tbody tr[data-id="' + id + '"]');
    if (!row) return;
    row.innerHTML =
        '<td><input class="form-control form-control-sm" id="edit-cat-name" value="' + escAttr(name) + '"></td>' +
        '<td><input class="form-control form-control-sm" id="edit-cat-desc" value="' + escAttr(desc) + '"></td><td></td>' +
        '<td><div class="d-flex gap-1"><button class="btn btn-sm btn-success btn-cat-save" data-id="' + id + '">Save</button><button class="btn btn-sm btn-outline-secondary btn-cat-cancel">Cancel</button></div></td>';
}

async function saveCategoryInline(id) {
    var name = document.getElementById("edit-cat-name").value.trim();
    var desc = document.getElementById("edit-cat-desc").value.trim();
    if (!name) return;
    try {
        await Api.updateCategory(id, { name: name, description: desc });
        loadCategoriesTable();
        flashPageAlert("success", "Category updated successfully.");
    } catch (e) { flashPageAlert("danger", e.message || "Failed to update category."); }
}

function confirmDeleteCategory(id, name) {
    State.pendingOp = { type: "deleteCategory", id: id };
    document.getElementById("confirm-title").textContent = "Delete Category";
    document.getElementById("confirm-msg").textContent = 'Delete "' + name + '"? Fails if products are still assigned.';
    document.getElementById("confirm-notes-wrap").classList.add("d-none");
    document.getElementById("btn-confirm-action").className = "btn btn-danger";
    document.getElementById("btn-confirm-action").textContent = "Delete";
    new bootstrap.Modal(document.getElementById("modal-confirm")).show();
}

async function loadDeliveryTable() {
    setTableLoading("delivery-tbody", 5, "py-4");
    var tbody = document.getElementById("delivery-tbody");
    try {
        var regions = await Api.getDeliveryRegions();
        if (!regions.length) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center text-secondary py-4">No delivery regions configured.</td></tr>';
            return;
        }
        tbody.innerHTML = regions.map(function (r) {
            var fee = r.deliveryFee != null ? r.deliveryFee : r.fee;
            var isActive = r.isActive !== false;
            var actions = "";
            if (RBAC.can(Shop.PERMISSIONS.MANAGE_DELIVERY)) {
                actions = '<div class="d-flex gap-1">' +
                    '<button class="btn btn-sm btn-ghost-primary btn-region-edit" data-id="' + r.id + '" data-name="' + escAttr(r.name) + '" data-state="' + escAttr(r.state) + '" data-fee="' + fee + '" data-active="' + (isActive ? "true" : "false") + '">Edit</button>' +
                    '<button class="btn btn-sm btn-ghost-danger btn-region-delete" data-id="' + r.id + '" data-name="' + escAttr(r.name) + '">Delete</button></div>';
            }
            return '<tr data-id="' + r.id + '"><td class="fw-semibold">' + esc(r.name) + '</td><td>' + esc(r.state) + '</td><td>' + Shop.formatMoney(fee) + '</td><td>' + regionActiveBadge(isActive) + '</td><td>' + actions + '</td></tr>';
        }).join("");
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-danger py-4">' + esc(e.message) + '</td></tr>';
    }
}

async function openRegionModal() {
    if (!RBAC.can(Shop.PERMISSIONS.MANAGE_DELIVERY)) return;
    document.getElementById("modal-region-error").classList.add("d-none");
    document.getElementById("new-region-name").value = "";
    document.getElementById("new-region-fee").value = "";
    document.getElementById("new-region-active").checked = true;
    try {
        await ensureNigerianStates();
        populateStateSelect(document.getElementById("new-region-state"), "");
    } catch (e) {
        flashPageAlert("danger", e.message || "Failed to load states list.");
        return;
    }
    new bootstrap.Modal(document.getElementById("modal-region")).show();
    setTimeout(function () { document.getElementById("new-region-name").focus(); }, 300);
}

async function addDeliveryRegion() {
    if (!RBAC.can(Shop.PERMISSIONS.MANAGE_DELIVERY)) return;
    var errEl = document.getElementById("modal-region-error");
    errEl.classList.add("d-none");
    var name = document.getElementById("new-region-name").value.trim();
    var state = document.getElementById("new-region-state").value.trim();
    var deliveryFee = parseFloat(document.getElementById("new-region-fee").value);
    var isActive = document.getElementById("new-region-active").checked;
    if (!name || !state || isNaN(deliveryFee)) {
        errEl.textContent = "Please fill in all required fields.";
        errEl.classList.remove("d-none");
        return;
    }
    var btn = document.getElementById("btn-save-region");
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-inline me-1"></span>Adding…';
    try {
        await Api.createDeliveryRegion({ name: name, state: state, deliveryFee: deliveryFee, isActive: isActive });
        bootstrap.Modal.getInstance(document.getElementById("modal-region")).hide();
        loadDeliveryTable();
        flashPageAlert("success", "Delivery region added successfully.");
    } catch (e) {
        errEl.textContent = e.message || "Failed to add region.";
        errEl.classList.remove("d-none");
    } finally {
        btn.disabled = false;
        btn.textContent = "Add Region";
    }
}

async function editRegionInline(id, name, state, fee, isActive) {
    var row = document.querySelector('#delivery-tbody tr[data-id="' + id + '"]');
    if (!row) return;
    try {
        await ensureNigerianStates();
    } catch (e) {
        flashPageAlert("danger", e.message || "Failed to load states list.");
        return;
    }
    var matchedState = (State.nigerianStates || []).find(function (s) {
        return s.toLowerCase() === String(state || "").toLowerCase();
    }) || state;
    var active = isActive !== false;
    row.innerHTML =
        '<td><input class="form-control form-control-sm" id="edit-region-name" value="' + escAttr(name) + '"></td>' +
        '<td><select class="form-select form-select-sm" id="edit-region-state">' + buildStateSelectOptions(matchedState, true) + '</select></td>' +
        '<td><input type="number" class="form-control form-control-sm" id="edit-region-fee" value="' + fee + '" min="0" step="100"></td>' +
        '<td><select class="form-select form-select-sm" id="edit-region-active"><option value="true"' + (active ? " selected" : "") + '>Active</option><option value="false"' + (!active ? " selected" : "") + '>Inactive</option></select></td>' +
        '<td><div class="d-flex gap-1"><button class="btn btn-sm btn-success btn-region-save" data-id="' + id + '">Save</button><button class="btn btn-sm btn-outline-secondary btn-region-cancel">Cancel</button></div></td>';
}

async function saveRegionInline(id) {
    var name = document.getElementById("edit-region-name").value.trim();
    var state = document.getElementById("edit-region-state").value.trim();
    var deliveryFee = parseFloat(document.getElementById("edit-region-fee").value);
    var isActive = document.getElementById("edit-region-active").value === "true";
    if (!name || !state || isNaN(deliveryFee)) return;
    try {
        await Api.updateDeliveryRegion(id, { name: name, state: state, deliveryFee: deliveryFee, isActive: isActive });
        loadDeliveryTable();
        flashPageAlert("success", "Delivery region updated successfully.");
    } catch (e) { flashPageAlert("danger", e.message || "Failed to update delivery region."); }
}

function confirmDeleteRegion(id, name) {
    State.pendingOp = { type: "deleteRegion", id: id };
    document.getElementById("confirm-title").textContent = "Delete Delivery Region";
    document.getElementById("confirm-msg").textContent = 'Delete region "' + name + '"?';
    document.getElementById("confirm-notes-wrap").classList.add("d-none");
    document.getElementById("btn-confirm-action").className = "btn btn-danger";
    document.getElementById("btn-confirm-action").textContent = "Delete";
    new bootstrap.Modal(document.getElementById("modal-confirm")).show();
}

async function loadOrders() {
    if (!Shop.canViewOrders()) {
        document.getElementById("orders-tbody").innerHTML =
            '<tr><td colspan="6" class="text-center text-secondary py-5">You do not have permission to view orders.</td></tr>';
        document.getElementById("orders-results-label").textContent = "—";
        return;
    }
    setTableLoading("orders-tbody", 6);
    document.getElementById("orders-results-label").textContent = "Loading…";
    var tbody = document.getElementById("orders-tbody");
    try {
        var result = await Api.getOrders({
            status: State.order.status || undefined,
            startDate: State.order.startDate || undefined,
            endDate: State.order.endDate || undefined,
            search: State.order.search || undefined,
        });
        var rows = result.items;
        updateOrderStats(rows);
        document.getElementById("orders-results-label").textContent = rows.length + " order" + (rows.length !== 1 ? "s" : "");
        if (typeof Layout !== "undefined" && Layout.refreshShopOrderBadge) Layout.refreshShopOrderBadge();
        if (!rows.length) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center text-secondary py-5">No orders found.</td></tr>';
            return;
        }
        tbody.innerHTML = rows.map(function (o) {
            var itemCount = (o.items || []).reduce(function (sum, i) { return sum + (i.quantity || 1); }, 0);
            var customer = (o.user && (o.user.firstName || o.user.email)) ? [o.user.firstName, o.user.lastName].filter(Boolean).join(" ") || o.user.email : (o.userId ? o.userId.slice(0, 8) + "…" : "—");
            return '<tr class="order-row" data-id="' + o.id + '">' +
                '<td><span class="fw-semibold">' + esc(Shop.orderRef(o)) + '</span></td>' +
                '<td class="small">' + esc(customer) + '</td>' +
                '<td class="small">' + itemCount + ' item' + (itemCount !== 1 ? "s" : "") + '</td>' +
                '<td class="fw-semibold">' + Shop.formatMoney(o.totalAmount) + '</td>' +
                '<td>' + Shop.statusBadge(o.status) + '</td>' +
                '<td class="text-secondary small">' + Shop.formatDateTime(o.createdAt) + '</td></tr>';
        }).join("");
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-danger py-4">' + esc(e.message) + '</td></tr>';
    }
}

async function openOrderDetail(id) {
    if (!Shop.canViewOrders()) return;
    var body = document.getElementById("offcanvas-order-body");
    var actions = document.getElementById("offcanvas-order-actions");
    body.innerHTML = '<div class="text-center py-5"><div class="spinner-border text-primary"></div></div>';
    actions.innerHTML = '<button class="btn btn-link link-secondary me-auto" data-bs-dismiss="offcanvas">Close</button>';
    new bootstrap.Offcanvas(document.getElementById("offcanvas-order")).show();
    try {
        var o = await Api.getOrder(id);
        document.querySelector("#offcanvas-order .offcanvas-title").textContent = "Order " + Shop.orderRef(o);
        var itemsHtml = (o.items || []).map(function (i) {
            return '<tr><td>' + esc(i.name) + '</td><td class="text-end">' + (i.quantity || 1) + '</td><td class="text-end">' + Shop.formatMoney(i.price) + '</td></tr>';
        }).join("");
        var addr = o.deliveryAddress || {};
        body.innerHTML =
            '<div class="p-3 border-bottom"><div class="text-secondary small">Order Code</div><div class="fw-semibold">' + esc(Shop.orderRef(o)) + '</div></div>' +
            '<div class="p-3 border-bottom"><div class="d-flex justify-content-between"><span>Status</span>' + Shop.statusBadge(o.status) + '</div>' +
            '<div class="mt-2 text-secondary small">Placed ' + Shop.formatDateTime(o.createdAt) + '</div></div>' +
            '<div class="p-3 border-bottom"><div class="subheader mb-2">Delivery Address</div><div class="small">' + esc(addr.fullAddress || [addr.streetAddress, addr.city, addr.state].filter(Boolean).join(", ") || "—") + '</div></div>' +
            '<div class="p-3 border-bottom"><table class="table table-sm mb-0"><thead><tr><th>Item</th><th class="text-end">Qty</th><th class="text-end">Price</th></tr></thead><tbody>' + itemsHtml + '</tbody></table>' +
            '<div class="mt-3 small"><div class="d-flex justify-content-between"><span>Subtotal</span><span>' + Shop.formatMoney(o.subtotal) + '</span></div>' +
            '<div class="d-flex justify-content-between"><span>Delivery</span><span>' + Shop.formatMoney(o.deliveryFee) + '</span></div>' +
            '<div class="d-flex justify-content-between fw-semibold mt-1"><span>Total</span><span>' + Shop.formatMoney(o.totalAmount) + '</span></div></div></div>' +
            (o.notes ? '<div class="p-3"><div class="subheader mb-1">Notes</div><div class="small text-secondary">' + esc(o.notes) + '</div></div>' : "");
        if (RBAC.can(Shop.PERMISSIONS.UPDATE_STATUS)) {
            var transitions = Shop.orderStatusTransitions(o.status);
            transitions.forEach(function (s) {
                var col = s === "CANCELLED" ? "danger" : "primary";
                actions.innerHTML += '<button class="btn btn-' + col + ' btn-order-status" data-id="' + o.id + '" data-status="' + s + '">' + s.replace(/_/g, " ") + '</button>';
            });
            actions.querySelectorAll(".btn-order-status").forEach(function (btn) {
                btn.addEventListener("click", function () {
                    confirmOrderStatus(btn.dataset.id, btn.dataset.status, o.status, Shop.orderRef(o));
                });
            });
        }
    } catch (e) {
        body.innerHTML = '<div class="alert alert-danger m-3">' + esc(e.message) + '</div>';
    }
}

function confirmOrderStatus(id, newStatus, currentStatus, orderLabel) {
    if (!RBAC.can(Shop.PERMISSIONS.UPDATE_STATUS)) return;
    State.pendingOp = { type: "orderStatus", id: id, newStatus: newStatus };
    document.getElementById("confirm-title").textContent = "Update Order Status";
    document.getElementById("confirm-msg").textContent = "Change order " + (orderLabel || "") + " from " + currentStatus + " to " + newStatus + "?";
    var notesWrap = document.getElementById("confirm-notes-wrap");
    notesWrap.classList.toggle("d-none", newStatus !== "CANCELLED");
    document.getElementById("confirm-notes").value = "";
    document.getElementById("btn-confirm-action").className = "btn " + (newStatus === "CANCELLED" ? "btn-danger" : "btn-primary");
    document.getElementById("btn-confirm-action").textContent = newStatus === "CANCELLED" ? "Cancel Order" : "Update";
    new bootstrap.Modal(document.getElementById("modal-confirm")).show();
}

async function executeConfirmedOp() {
    if (!State.pendingOp) return;
    var btn = document.getElementById("btn-confirm-action");
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-inline"></span>';
    try {
        if (State.pendingOp.type === "toggleProduct") {
            await Api.updateProductStatus(State.pendingOp.id, State.pendingOp.newStatus);
            loadProductSection();
            flashPageAlert("success", State.pendingOp.newStatus === "ACTIVE" ? "Product activated." : "Product deactivated.");
        } else if (State.pendingOp.type === "deleteProduct") {
            await Api.deleteProduct(State.pendingOp.id);
            loadProductSection();
            flashPageAlert("success", "Product deleted successfully.");
        } else if (State.pendingOp.type === "deleteCategory") {
            await Api.deleteCategory(State.pendingOp.id);
            loadCategoriesTable();
            flashPageAlert("success", "Category deleted successfully.");
        } else if (State.pendingOp.type === "deleteRegion") {
            await Api.deleteDeliveryRegion(State.pendingOp.id);
            loadDeliveryTable();
            flashPageAlert("success", "Delivery region deleted successfully.");
        } else if (State.pendingOp.type === "orderStatus") {
            var orderId = State.pendingOp.id;
            var newStatus = State.pendingOp.newStatus;
            var notes = newStatus === "CANCELLED" ? document.getElementById("confirm-notes").value.trim() : "";
            await Api.updateOrderStatus(orderId, newStatus, notes || undefined);
            bootstrap.Modal.getInstance(document.getElementById("modal-confirm")).hide();
            if (typeof Layout !== "undefined" && Layout.refreshShopOrderBadge) Layout.refreshShopOrderBadge();
            loadOrders();
            openOrderDetail(orderId);
            flashPageAlert("success", newStatus === "CANCELLED"
                ? "Order cancelled successfully."
                : "Order status updated to " + newStatus.replace(/_/g, " ") + ".");
            State.pendingOp = null;
            btn.disabled = false;
            btn.textContent = "Confirm";
            return;
        }
        bootstrap.Modal.getInstance(document.getElementById("modal-confirm")).hide();
    } catch (e) {
        flashPageAlert("danger", e.message || "Operation failed.");
    } finally {
        btn.disabled = false;
        btn.textContent = "Confirm";
        State.pendingOp = null;
    }
}

async function init() {

    RBAC.fetchMe().then(function () {
        RBAC.applyPageGuardForCurrentPage();
        RBAC.applyNavVisibility();
    });
    initSectionTabs();
    initProductEvents();
    initCategoryEvents();
    initDeliveryEvents();
    initOrderEvents();

    document.getElementById("btn-refresh").addEventListener("click", function () {
        var btn = this;
        if (btn.disabled) return;
        var origHtml = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1" role="status"></span>Refresh';
        showSectionTableLoading(State.currentSection);
        loadActiveSection().finally(function () {
            btn.disabled = false;
            btn.innerHTML = origHtml;
        });
    });
    document.getElementById("btn-header-action").addEventListener("click", function () {
        if (State.currentSection === "products") openProductModal(null);
        else if (State.currentSection === "categories") openCategoryModal();
        else if (State.currentSection === "delivery") openRegionModal();
    });
    document.getElementById("btn-save-product").addEventListener("click", saveProduct);
    document.getElementById("btn-save-category").addEventListener("click", addCategory);
    document.getElementById("btn-save-region").addEventListener("click", addDeliveryRegion);
    document.getElementById("btn-confirm-action").addEventListener("click", executeConfirmedOp);

    applySectionFromHash();
    loadNigerianStates().catch(function (e) { console.warn("Failed to load Nigerian states:", e); });
}


    SP.Handlers = {
        loadNigerianStates: loadNigerianStates,
        ensureNigerianStates: ensureNigerianStates,
        loadActiveSection: loadActiveSection,
        refreshCurrentSection: refreshCurrentSection,
        initProductEvents: initProductEvents,
        initCategoryEvents: initCategoryEvents,
        initDeliveryEvents: initDeliveryEvents,
        initOrderEvents: initOrderEvents,
        loadProductSection: loadProductSection,
        loadCategoriesForFilters: loadCategoriesForFilters,
        loadProductStats: loadProductStats,
        loadProducts: loadProducts,
        openProductModal: openProductModal,
        saveProduct: saveProduct,
        confirmToggleProduct: confirmToggleProduct,
        confirmDeleteProduct: confirmDeleteProduct,
        loadCategoriesTable: loadCategoriesTable,
        openCategoryModal: openCategoryModal,
        addCategory: addCategory,
        editCategoryInline: editCategoryInline,
        saveCategoryInline: saveCategoryInline,
        confirmDeleteCategory: confirmDeleteCategory,
        loadDeliveryTable: loadDeliveryTable,
        openRegionModal: openRegionModal,
        addDeliveryRegion: addDeliveryRegion,
        editRegionInline: editRegionInline,
        saveRegionInline: saveRegionInline,
        confirmDeleteRegion: confirmDeleteRegion,
        loadOrders: loadOrders,
        openOrderDetail: openOrderDetail,
        confirmOrderStatus: confirmOrderStatus,
        executeConfirmedOp: executeConfirmedOp,
        init: init,
    };
})(window);
