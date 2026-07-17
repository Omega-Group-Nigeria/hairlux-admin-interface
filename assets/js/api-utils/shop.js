/**
 * shop.js — Hairlux Admin
 * API helper for shop catalog, delivery regions, and order management.
 *
 * Requires:
 *   - config.js (window.API_BASE)
 *   - auth.js   (Auth.fetch, Auth.getToken, Auth.isTokenExpired, Auth.refreshAccessToken, Auth.logout)
 *
 * Permissions (see documents/PERMISSIONS.md + shop-admin-permissions.md):
 *   shop:read              — view products, categories, delivery regions & orders
 *   shop:manage_products   — create/update/delete products
 *   shop:manage_categories — manage product categories
 *   shop:manage_delivery   — manage delivery regions & fees
 *   shop:update_status     — advance fulfilment / cancel orders
 *
 * Admin endpoints:
 *   GET    /admin/shop/categories
 *   POST   /admin/shop/categories
 *   PUT    /admin/shop/categories/:id
 *   DELETE /admin/shop/categories/:id
 *   GET    /admin/shop/products
 *   GET    /admin/shop/products/:id
 *   POST   /admin/shop/products              (multipart/form-data)
 *   PUT    /admin/shop/products/:id          (multipart/form-data)
 *   PATCH  /admin/shop/products/:id/status   (JSON)
 *   DELETE /admin/shop/products/:id
 *   GET    /admin/shop/delivery-regions
 *   POST   /admin/shop/delivery-regions      (JSON)
 *   PUT    /admin/shop/delivery-regions/:id  (JSON)
 *   DELETE /admin/shop/delivery-regions/:id
 *   GET    /admin/shop/orders
 *   GET    /admin/shop/orders/:id
 *   PATCH  /admin/shop/orders/:id/status     (JSON)
 */

const Shop = (() => {

    const PERMISSIONS = {
        READ:              "shop:read",
        MANAGE_PRODUCTS:   "shop:manage_products",
        MANAGE_CATEGORIES: "shop:manage_categories",
        MANAGE_DELIVERY:   "shop:manage_delivery",
        UPDATE_STATUS:     "shop:update_status",
    };

    /** True if user can open the Shop page at all. */
    function canAccessShop() {
        if (typeof RBAC === "undefined" || !RBAC.can) return false;
        return RBAC.can(PERMISSIONS.READ)
            || RBAC.can(PERMISSIONS.MANAGE_PRODUCTS)
            || RBAC.can(PERMISSIONS.MANAGE_CATEGORIES)
            || RBAC.can(PERMISSIONS.MANAGE_DELIVERY)
            || RBAC.can(PERMISSIONS.UPDATE_STATUS);
    }

    /** True if user may view the products catalog (read-only or manage). */
    function canViewProducts() {
        if (typeof RBAC === "undefined" || !RBAC.can) return false;
        return RBAC.can(PERMISSIONS.READ) || RBAC.can(PERMISSIONS.MANAGE_PRODUCTS);
    }

    function canViewCategories() {
        if (typeof RBAC === "undefined" || !RBAC.can) return false;
        return RBAC.can(PERMISSIONS.READ) || RBAC.can(PERMISSIONS.MANAGE_CATEGORIES);
    }

    function canViewDelivery() {
        if (typeof RBAC === "undefined" || !RBAC.can) return false;
        return RBAC.can(PERMISSIONS.READ) || RBAC.can(PERMISSIONS.MANAGE_DELIVERY);
    }

    function canViewOrders() {
        if (typeof RBAC === "undefined" || !RBAC.can) return false;
        return RBAC.can(PERMISSIONS.READ) || RBAC.can(PERMISSIONS.UPDATE_STATUS);
    }

    const ORDER_STATUSES = ["CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"];

    function getBase() {
        return (window.API_BASE || "").replace(/\/$/, "");
    }

    async function apiFetch(path, options = {}) {
        const res = await Auth.fetch(path, options);
        const raw = await res.json().catch(() => ({}));
        if (!res || !res.ok) throw new Error(raw.message || `Request failed (${res ? res.status : "no response"})`);
        return raw.data !== undefined ? raw.data : raw;
    }

    async function multipartFetch(path, method, formData) {
        if (Auth.isTokenExpired()) {
            try { await Auth.refreshAccessToken(); } catch { Auth.logout(); return; }
        }

        const doFetch = () => fetch(`${getBase()}${path}`, {
            method,
            headers: { Authorization: `Bearer ${Auth.getToken()}` },
            body: formData,
        });

        let res = await doFetch();
        if (res.status === 401) {
            try { await Auth.refreshAccessToken(); res = await doFetch(); } catch { Auth.logout(); return; }
        }

        const raw = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(raw.message || `Request failed (${res.status})`);
        return raw.data !== undefined ? raw.data : raw;
    }

    function parseList(data) {
        if (Array.isArray(data)) return { items: data, meta: null };
        if (data && Array.isArray(data.data)) {
            return { items: data.data, meta: data.meta || null };
        }
        if (data && Array.isArray(data.items)) {
            return { items: data.items, meta: data.meta || null };
        }
        if (data && Array.isArray(data.products)) {
            return { items: data.products, meta: data.meta || null };
        }
        if (data && Array.isArray(data.orders)) {
            return { items: data.orders, meta: data.meta || null };
        }
        return { items: [], meta: null };
    }

    function getProductImages(product) {
        if (!product) return [];
        if (typeof ShopProductImages !== "undefined" && ShopProductImages.sortImages) {
            return ShopProductImages.sortImages(product.images);
        }
        const images = Array.isArray(product.images) ? product.images.slice() : [];
        return images
            .filter(function (img) { return img && img.url; })
            .sort(function (a, b) { return (a.sortOrder ?? 0) - (b.sortOrder ?? 0); });
    }

    function getProductImageUrl(product) {
        if (!product) return "";
        const images = getProductImages(product);
        if (images.length && images[0].url) return images[0].url;
        return product.imageUrl || product.image_url || "";
    }

    function normalizeProduct(product) {
        if (!product || typeof product !== "object") return product;
        const images = getProductImages(product);
        const imageUrl = images.length ? images[0].url : getProductImageUrl(product);
        return Object.assign({}, product, {
            images: images,
            imageUrl: imageUrl || null,
        });
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // CATEGORIES
    // ═══════════════════════════════════════════════════════════════════════════════

    async function getCategories() {
        const data = await apiFetch("/admin/shop/categories");
        return Array.isArray(data) ? data : (data.categories || []);
    }

    async function createCategory(payload) {
        return apiFetch("/admin/shop/categories", {
            method: "POST",
            body: JSON.stringify(payload),
        });
    }

    async function updateCategory(id, payload) {
        return apiFetch(`/admin/shop/categories/${id}`, {
            method: "PUT",
            body: JSON.stringify(payload),
        });
    }

    async function deleteCategory(id) {
        return apiFetch(`/admin/shop/categories/${id}`, { method: "DELETE" });
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // PRODUCTS
    // ═══════════════════════════════════════════════════════════════════════════════

    async function getProducts(params = {}) {
        const q = new URLSearchParams();
        if (params.categoryId) q.set("categoryId", params.categoryId);
        if (params.search)     q.set("search", params.search);
        if (params.status)     q.set("status", params.status);
        if (params.page)       q.set("page", String(params.page));
        if (params.limit)      q.set("limit", String(params.limit));
        const qs   = q.toString();
        const data = await apiFetch("/admin/shop/products" + (qs ? "?" + qs : ""));
        const parsed = parseList(data);
        return {
            items: parsed.items.map(normalizeProduct),
            meta: parsed.meta,
        };
    }

    async function getProduct(id) {
        return normalizeProduct(await apiFetch(`/admin/shop/products/${id}`));
    }

    async function createProduct(formData) {
        return multipartFetch("/admin/shop/products", "POST", formData);
    }

    async function updateProduct(id, formData) {
        return multipartFetch(`/admin/shop/products/${id}`, "PUT", formData);
    }

    async function updateProductStatus(id, status) {
        return apiFetch(`/admin/shop/products/${id}/status`, {
            method: "PATCH",
            body: JSON.stringify({ status }),
        });
    }

    async function deleteProduct(id) {
        return apiFetch(`/admin/shop/products/${id}`, { method: "DELETE" });
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // DELIVERY REGIONS
    // ═══════════════════════════════════════════════════════════════════════════════

    async function getDeliveryRegions() {
        const data = await apiFetch("/admin/shop/delivery-regions");
        return Array.isArray(data) ? data : (data.regions || data.deliveryRegions || []);
    }

    async function createDeliveryRegion(payload) {
        return apiFetch("/admin/shop/delivery-regions", {
            method: "POST",
            body: JSON.stringify(payload),
        });
    }

    async function updateDeliveryRegion(id, payload) {
        return apiFetch(`/admin/shop/delivery-regions/${id}`, {
            method: "PUT",
            body: JSON.stringify(payload),
        });
    }

    async function deleteDeliveryRegion(id) {
        return apiFetch(`/admin/shop/delivery-regions/${id}`, { method: "DELETE" });
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // ORDERS
    // ═══════════════════════════════════════════════════════════════════════════════

    async function getOrders(params = {}) {
        const q = new URLSearchParams();
        if (params.status)    q.set("status", params.status);
        if (params.startDate) q.set("startDate", params.startDate);
        if (params.endDate)   q.set("endDate", params.endDate);
        if (params.page)      q.set("page", String(params.page));
        if (params.limit)     q.set("limit", String(params.limit));
        if (params.search)    q.set("search", params.search);
        const qs   = q.toString();
        const data = await apiFetch("/admin/shop/orders" + (qs ? "?" + qs : ""));
        if (Array.isArray(data)) return { items: data, meta: null };
        return parseList(data);
    }

    async function getOrder(id) {
        return apiFetch(`/admin/shop/orders/${id}`);
    }

    async function updateOrderStatus(id, status, notes) {
        const body = { status };
        if (notes) body.notes = notes;
        return apiFetch(`/admin/shop/orders/${id}/status`, {
            method: "PATCH",
            body: JSON.stringify(body),
        });
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // DISPLAY HELPERS
    // ═══════════════════════════════════════════════════════════════════════════════

    function statusBadge(status) {
        const map = {
            ACTIVE:   "bg-success-lt text-success",
            INACTIVE: "bg-secondary-lt text-secondary",
            CONFIRMED:  "bg-primary-lt text-primary",
            PROCESSING: "bg-warning-lt text-warning",
            SHIPPED:    "bg-info-lt text-info",
            DELIVERED:  "bg-success-lt text-success",
            CANCELLED:  "bg-danger-lt text-danger",
        };
        const cls = map[status] || "bg-secondary-lt text-secondary";
        const label = (status || "—").replace(/_/g, " ");
        return '<span class="badge ' + cls + '">' + label + '</span>';
    }

    function stockBadge(stock, inStock) {
        const qty = Number(stock) || 0;
        if (inStock === false || qty <= 0) {
            return '<span class="badge bg-danger-lt text-danger">Out of stock</span>';
        }
        if (qty <= 5) {
            return '<span class="badge bg-warning-lt text-warning">' + qty + ' left</span>';
        }
        return '<span class="badge bg-success-lt text-success">' + qty + ' in stock</span>';
    }

    function formatMoney(amount) {
        return "₦" + Number(amount || 0).toLocaleString("en-NG", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });
    }

    function formatDate(iso) {
        if (!iso) return "—";
        try {
            return new Date(iso).toLocaleDateString("en-GB", {
                day: "numeric", month: "short", year: "numeric",
            });
        } catch { return iso; }
    }

    function formatDateTime(iso) {
        if (!iso) return "—";
        try {
            return new Date(iso).toLocaleString("en-GB", {
                day: "numeric", month: "short", year: "numeric",
                hour: "2-digit", minute: "2-digit",
            });
        } catch { return iso; }
    }

    function orderStatusTransitions(current) {
        const map = {
            CONFIRMED:  ["PROCESSING", "CANCELLED"],
            PROCESSING: ["SHIPPED", "CANCELLED"],
            SHIPPED:    ["DELIVERED", "CANCELLED"],
            DELIVERED:  [],
            CANCELLED:  [],
        };
        return map[current] || [];
    }

    /** Human-readable order reference for display (orderCode preferred). */
    function orderRef(order) {
        if (!order) return "—";
        if (order.orderCode) return order.orderCode;
        const id = order.id || "";
        return id ? id.slice(0, 8) + "…" : "—";
    }

    return {
        PERMISSIONS,
        ORDER_STATUSES,
        canAccessShop,
        canViewProducts,
        canViewCategories,
        canViewDelivery,
        canViewOrders,
        getCategories,
        createCategory,
        updateCategory,
        deleteCategory,
        getProducts,
        getProduct,
        createProduct,
        updateProduct,
        updateProductStatus,
        deleteProduct,
        getDeliveryRegions,
        createDeliveryRegion,
        updateDeliveryRegion,
        deleteDeliveryRegion,
        getOrders,
        getOrder,
        updateOrderStatus,
        getProductImages,
        getProductImageUrl,
        statusBadge,
        stockBadge,
        formatMoney,
        formatDate,
        formatDateTime,
        orderStatusTransitions,
        orderRef,
    };
})();