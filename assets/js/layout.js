/**
 * layout.js — Hairlux Admin
 * Renders shared sidebar navigation and initializes header user menu.
 * Requires nav-config.js (NavConfig) to be loaded first.
 */
var Layout = window.Layout || (() => {

    function getBasePath() {
        const path = window.location.pathname;
        if (path.includes("/bookings/") || path.includes("/app/")) return "../";
        return "./";
    }

    function resolveHref(href) {
        return getBasePath() + String(href || "").replace(/^(\.\.\/|\.\/)+/, "");
    }

    function getCurrentPagePath() {
        const path = window.location.pathname;
        if (path.includes("/bookings/") || path.includes("/app/")) {
            const folder = path.includes("/bookings/") ? "bookings" : "app";
            const file = path.split("/").pop() || "index.html";
            if (file === "index.html") return folder + "/index.html";
            return folder + "/" + file;
        }
        return path.split("/").pop() || "index.html";
    }

    function getCurrentHash() {
        return (window.location.hash || "").replace(/^#/, "");
    }

    function hrefMatchesCurrent(href) {
        const normalized = String(href || "").replace(/^(\.\.\/|\.\/)+/, "");
        const parts = normalized.split("#");
        const page = parts[0].split("?")[0];
        const hash = parts[1] || "";
        if (page !== getCurrentPagePath()) return false;
        if (hash) return hash === getCurrentHash();
        return true;
    }

    function isItemActive(item) {
        if (item.children && item.children.length) {
            return item.children.some(function (child) { return hrefMatchesCurrent(child.href); });
        }
        return item.href ? hrefMatchesCurrent(item.href) : false;
    }

    function isChildActive(href) {
        return hrefMatchesCurrent(href);
    }

    function renderIcon(iconKey) {
        return NavConfig.ICONS[iconKey] || "";
    }

    function renderNavBadge(item) {
        if (item.badge !== "confirmedOrders") return "";
        return (
            '<span class="badge nav-shop-order-badge bg-warning text-dark" ' +
            'id="nav-shop-confirmed-badge" hidden ' +
            'aria-label="Confirmed orders awaiting processing"></span>'
        );
    }

    function canViewShopOrders() {
        if (typeof RBAC === "undefined" || !RBAC.can) return false;
        return [
            "shop:manage_products",
            "shop:manage_categories",
            "shop:manage_delivery",
            "shop:update_status",
        ].some(function (p) { return RBAC.can(p); });
    }

    function updateShopConfirmedBadge(count) {
        const el = document.getElementById("nav-shop-confirmed-badge");
        if (!el) return;
        const n = Number(count) || 0;
        if (n <= 0) {
            el.hidden = true;
            el.textContent = "";
            return;
        }
        el.hidden = false;
        el.textContent = n > 99 ? "99+" : String(n);
    }

    async function fetchConfirmedOrderCount() {
        if (typeof Auth === "undefined" || !Auth.fetch) return 0;
        const res = await Auth.fetch("/admin/shop/orders?status=CONFIRMED&page=1&limit=1");
        if (!res || !res.ok) return 0;
        const raw = await res.json().catch(function () { return {}; });
        const data = raw.data !== undefined ? raw.data : raw;
        if (data && data.meta && typeof data.meta.total === "number") return data.meta.total;
        if (Array.isArray(data)) return data.length;
        if (data && Array.isArray(data.data)) return data.data.length;
        return 0;
    }

    async function refreshShopOrderBadge() {
        if (!canViewShopOrders()) {
            updateShopConfirmedBadge(0);
            return;
        }
        try {
            const count = await fetchConfirmedOrderCount();
            updateShopConfirmedBadge(count);
        } catch (_) {
            updateShopConfirmedBadge(0);
        }
    }

    function renderSidebar(container) {
        const el = container || document.getElementById("app-sidebar");
        if (!el || typeof NavConfig === "undefined") return;

        const html = NavConfig.ITEMS.map(function (item) {
            const active = isItemActive(item);
            const iconHtml = '<span class="nav-link-icon d-md-none d-lg-inline-block">' + renderIcon(item.icon) + "</span>";
            const badgeHtml = renderNavBadge(item);
            const titleHtml = '<span class="nav-link-title' + (badgeHtml ? " flex-fill" : "") + '">' + item.label + "</span>";
            const linkClass = "nav-link" + (badgeHtml ? " nav-link--has-badge d-flex align-items-center w-100" : "");

            if (item.children && item.children.length) {
                const childrenHtml = item.children.map(function (child) {
                    const childActive = isChildActive(child.href) ? " active" : "";
                    return '<a class="dropdown-item' + childActive + '" href="' + resolveHref(child.href) + '">' + child.label + "</a>";
                }).join("");
                return (
                    '<li class="nav-item dropdown' + (active ? " active" : "") + '">' +
                    '<a class="' + linkClass + ' dropdown-toggle" href="#" data-bs-toggle="dropdown" role="button" aria-expanded="false">' +
                    iconHtml + titleHtml + badgeHtml +
                    "</a>" +
                    '<div class="dropdown-menu">' + childrenHtml + "</div>" +
                    "</li>"
                );
            }

            return (
                '<li class="nav-item' + (active ? " active" : "") + '">' +
                '<a class="' + linkClass + '" href="' + resolveHref(item.href) + '">' +
                iconHtml + titleHtml + badgeHtml +
                "</a></li>"
            );
        }).join("");

        el.innerHTML = html;
    }

    /** Fix relative paths in header brand logo and settings links. */
    function fixHeaderPaths() {
        const base = getBasePath();
        const brand = document.querySelector(".navbar-brand");
        if (brand) brand.setAttribute("href", base + "index.html");

        const logo = document.querySelector(".navbar-brand img");
        if (logo && !logo.getAttribute("src").startsWith("http")) {
            const src = logo.getAttribute("src") || "";
            if (!src.startsWith(base) && !src.startsWith("../") && !src.startsWith("./")) {
                logo.setAttribute("src", base + src.replace(/^(\.\.\/|\.\/)+/, ""));
            }
        }

        document.querySelectorAll('.dropdown-menu a[href*="settings.html"]').forEach(function (a) {
            const href = a.getAttribute("href") || "";
            if (href.includes("settings.html")) {
                const hash = href.includes("#") ? href.slice(href.indexOf("#")) : "";
                a.setAttribute("href", base + "settings.html" + hash);
            }
        });
    }

    function initHeader() {
        if (typeof Auth === "undefined") return;

        const user = Auth.getUser();
        if (user) {
            const initials = ((user.firstName || "")[0] + (user.lastName || "")[0]).toUpperCase() || "A";
            const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ") || "Admin";
            const roleLabel = ((user.adminRole && user.adminRole.name) || user.role || "Administrator").replace(/_/g, " ");

            const set = function (id, text) {
                const node = document.getElementById(id);
                if (node) node.textContent = text;
            };

            set("navbar-user-avatar", initials);
            set("navbar-user-name", fullName);
            set("navbar-user-role", roleLabel);
            set("dropdown-user-name", fullName);
            set("dropdown-user-email", user.email || "");
        }

        const logoutBtn = document.getElementById("logout-btn");
        if (logoutBtn && !logoutBtn.dataset.layoutBound) {
            logoutBtn.dataset.layoutBound = "1";
            logoutBtn.addEventListener("click", function (e) {
                e.preventDefault();
                Auth.logout();
            });
        }
    }

    function syncNavAccess() {
        if (typeof RBAC !== "undefined" && RBAC.syncNavFromCache) {
            RBAC.syncNavFromCache();
        }
    }

    function init() {
        renderSidebar();
        fixHeaderPaths();
        syncNavAccess();
        initHeader();
    }

    document.addEventListener("DOMContentLoaded", function () {
        syncNavAccess();
        initHeader();
        refreshShopOrderBadge();
    });

    return {
        getBasePath,
        renderSidebar,
        fixHeaderPaths,
        initHeader,
        init,
        syncNavAccess,
        refreshShopOrderBadge,
        updateShopConfirmedBadge,
    };
})();
window.Layout = Layout;