/**
 * shop.js — Hairlux Admin
 * API helper for shop catalog, delivery regions, and order management.
 *
 * Requires:
 *   - config.js (window.API_BASE)
 *   - auth.js   (Auth.fetch, Auth.getToken, Auth.isTokenExpired, Auth.refreshAccessToken, Auth.logout)
 *
 * Permissions (see documents/shop-admin-permissions.md):
 *   shop:manage_products   — list/view/create/update/delete products
 *   shop:manage_categories — manage product categories
 *   shop:manage_delivery   — manage delivery regions & fees
 *   shop:update_status     — view orders, advance fulfilment, or cancel
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
        MANAGE_PRODUCTS:   "shop:manage_products",
        MANAGE_CATEGORIES: "shop:manage_categories",
        MANAGE_DELIVERY:   "shop:manage_delivery",
        UPDATE_STATUS:     "shop:update_status",
    };

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

    function getProductImageUrl(product) {
        if (!product) return "";
        const direct = product.imageUrl || product.image_url || "";
        if (direct) return direct;
        if (product.image && typeof product.image === "string") return product.image;
        if (product.image && product.image.url) return product.image.url;
        const publicId = product.imagePublicId || product.image_public_id;
        if (!publicId) return "";
        const cloud = (window.CLOUDINARY_CLOUD_NAME || "dkudoqsvl").replace(/\/$/, "");
        return "https://res.cloudinary.com/" + cloud + "/image/upload/f_auto,q_auto/" + publicId;
    }

    function normalizeProduct(product) {
        if (!product || typeof product !== "object") return product;
        const imageUrl = getProductImageUrl(product);
        return imageUrl && !product.imageUrl ? Object.assign({}, product, { imageUrl }) : product;
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

    return {
        PERMISSIONS,
        ORDER_STATUSES,
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
        getProductImageUrl,
        statusBadge,
        stockBadge,
        formatMoney,
        formatDate,
        formatDateTime,
        orderStatusTransitions,
    };
})();