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
                    return '<a class="nav-subnav-link' + childActive + '" href="' + resolveHref(child.href) + '">' + child.label + "</a>";
                }).join("");
                const openClass = active ? " is-open" : "";
                return (
                    '<li class="nav-item nav-item--subnav' + (active ? " active" : "") + openClass + '" data-nav-subnav>' +
                    '<button type="button" class="' + linkClass + ' nav-link--toggle w-100" ' +
                    'aria-expanded="' + (active ? "true" : "false") + '" ' +
                    'aria-controls="nav-sub-' + item.id + '">' +
                    iconHtml + titleHtml + badgeHtml +
                    '<span class="nav-chevron" aria-hidden="true"></span>' +
                    "</button>" +
                    '<div class="nav-subnav-wrap" id="nav-sub-' + item.id + '">' +
                    '<div class="nav-subnav">' + childrenHtml + "</div>" +
                    "</div></li>"
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
        initSidebarNav(el);
    }

    function initSidebarNav(container) {
        const el = container || document.getElementById("app-sidebar");
        if (!el) return;

        el.querySelectorAll("[data-nav-subnav]").forEach(function (li) {
            const btn = li.querySelector(".nav-link--toggle");
            if (!btn) return;

            if (li.classList.contains("active")) {
                li.classList.add("is-open");
                btn.setAttribute("aria-expanded", "true");
            }

            btn.addEventListener("click", function (e) {
                e.preventDefault();
                const willOpen = !li.classList.contains("is-open");
                li.classList.toggle("is-open", willOpen);
                btn.setAttribute("aria-expanded", willOpen ? "true" : "false");

                if (willOpen) {
                    el.querySelectorAll("[data-nav-subnav].is-open").forEach(function (other) {
                        if (other === li || other.classList.contains("active")) return;
                        other.classList.remove("is-open");
                        const otherBtn = other.querySelector(".nav-link--toggle");
                        if (otherBtn) otherBtn.setAttribute("aria-expanded", "false");
                    });
                }
            });
        });
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

    // ── Light/dark mode switch ──────────────────────────────────────────────
    // The switch used to be hand-written into each page's header, so pages
    // built without it (lifecycle-campaigns.html and ~33 others) had no way
    // to change theme. Inject it here -- every admin page loads layout.js --
    // wherever it's missing. Also replaces Tabler's plain "?theme=dark" link
    // behaviour, which dropped the page's own query string (e.g. ?id=...).
    // Same storage key/attribute as tabler-theme.min.js and theme-toggle.js,
    // so one choice applies across the whole admin panel.
    var THEME_KEY = "tabler-theme";

    var ICON_MOON = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon icon-1"><path d="M12 3c.132 0 .263 0 .393 0a7.5 7.5 0 0 0 7.92 12.446a9 9 0 1 1 -8.313 -12.454z" /></svg>';
    var ICON_SUN = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon icon-1"><path d="M12 12m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0" /><path d="M3 12h1m8 -9v1m8 8h1m-9 8v1m-6.4 -15.4l.7 .7m12.1 -.7l-.7 .7m0 11.4l.7 .7m-12.1 -.7l-.7 .7" /></svg>';

    function setTheme(theme) {
        try { localStorage.setItem(THEME_KEY, theme); } catch (e) {}
        // Reload (keeping the page's own URL, query string and hash) so
        // ApexCharts and other widgets that read colours at render time
        // redraw in the new theme.
        window.location.reload();
    }

    function initThemeToggle() {
        // Tidy the URL: tabler-theme.min.js has already saved ?theme=, so
        // drop it rather than leave it on every link the user copies.
        try {
            var url = new URL(window.location.href);
            if (url.searchParams.has("theme")) {
                url.searchParams.delete("theme");
                history.replaceState(null, "", url.pathname + url.search + url.hash);
            }
        } catch (e) {}

        var host = document.querySelector("header.navbar .navbar-nav.order-md-last");
        if (host && !host.querySelector(".hide-theme-dark, .hide-theme-light")) {
            var wrap = document.createElement("div");
            wrap.className = "nav-item me-2";
            wrap.innerHTML =
                '<a href="?theme=dark" class="nav-link px-0 hide-theme-dark" title="Enable dark mode" aria-label="Enable dark mode">' + ICON_MOON + '</a>' +
                '<a href="?theme=light" class="nav-link px-0 hide-theme-light" title="Enable light mode" aria-label="Enable light mode">' + ICON_SUN + '</a>';
            host.insertBefore(wrap, host.firstChild);
        }

        // Handle clicks on both injected and hand-written switches.
        document.querySelectorAll('a[href="?theme=dark"], a[href="?theme=light"]').forEach(function (a) {
            if (a.dataset.themeBound) return;
            a.dataset.themeBound = "1";
            a.addEventListener("click", function (e) {
                e.preventDefault();
                setTheme(a.getAttribute("href") === "?theme=dark" ? "dark" : "light");
            });
        });
    }

    function syncNavAccess() {
        if (typeof RBAC !== "undefined" && RBAC.syncNavFromCache) {
            RBAC.syncNavFromCache();
        }
    }

    function init() {
        renderSidebar();
        fixHeaderPaths();
        initThemeToggle();
        syncNavAccess();
        initHeader();
    }

    document.addEventListener("DOMContentLoaded", function () {
        initThemeToggle();
        syncNavAccess();
        initHeader();
        refreshShopOrderBadge();
    });

    return {
        getBasePath,
        renderSidebar,
        fixHeaderPaths,
        initHeader,
        initThemeToggle,
        init,
        initSidebarNav,
        syncNavAccess,
        refreshShopOrderBadge,
        updateShopConfirmedBadge,
    };
})();
window.Layout = Layout;