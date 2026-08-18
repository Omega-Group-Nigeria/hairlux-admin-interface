/**
 * nav-config.js — Hairlux Admin
 * Single source of truth for sidebar navigation structure and page permissions.
 */
var NavConfig = window.NavConfig || (() => {

    const SVG_ATTRS = 'xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon icon-1"';

    const ICONS = {
        dashboard: '<svg ' + SVG_ATTRS + '><path d="M5 12l-2 0l9 -9l9 9l-2 0" /><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-7" /><path d="M9 21v-6a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v6" /></svg>',
        bookings: '<svg ' + SVG_ATTRS + '><path d="M4 5m0 2a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2z" /><path d="M16 3l0 4" /><path d="M8 3l0 4" /><path d="M4 11l16 0" /><path d="M11 15l1 0" /><path d="M12 15l0 3" /></svg>',
        payments: '<svg ' + SVG_ATTRS + '><path d="M3 5m0 3a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v8a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3z" /><path d="M3 10l18 0" /><path d="M7 15l.01 0" /><path d="M11 15l2 0" /></svg>',
        users: '<svg ' + SVG_ATTRS + '><path d="M9 7m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0" /><path d="M3 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /><path d="M21 21v-2a4 4 0 0 0 -3 -3.85" /></svg>',
        services: '<svg ' + SVG_ATTRS + '><path d="M3 21v-4a4 4 0 1 1 4 4h-4" /><path d="M21 3a16 16 0 0 0 -12.8 10.2" /><path d="M21 3a16 16 0 0 1 -10.2 12.8" /><path d="M10.6 9a9 9 0 0 1 4.4 4.4" /></svg>',
        branches: '<svg ' + SVG_ATTRS + '><path d="M21 10c0 7 -9 13 -9 13s-9 -6 -9 -13a9 9 0 0 1 18 0" /><path d="M12 7m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0" /></svg>',
        shop: '<svg ' + SVG_ATTRS + '><path d="M6 19m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" /><path d="M17 19m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" /><path d="M17 17h-11v-14h-2" /><path d="M6 5l14 1l-1 7h-13" /></svg>',
        referrals: '<svg ' + SVG_ATTRS + '><path d="M15 5v2" /><path d="M15 11v2" /><path d="M15 17v2" /><path d="M5 5h14a2 2 0 0 1 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-3a2 2 0 0 0 0 -4v-3a2 2 0 0 1 2 -2" /></svg>',
        discounts: '<svg ' + SVG_ATTRS + '><path d="M9 15l6 -6" /><circle cx="9.5" cy="9.5" r=".5" fill="currentColor" /><circle cx="14.5" cy="14.5" r=".5" fill="currentColor" /><path d="M5 7.2a2.2 2.2 0 0 1 2.2 -2.2h1a2.2 2.2 0 0 0 1.55 -.64l.7 -.7a2.2 2.2 0 0 1 3.12 0l.7 .7a2.2 2.2 0 0 0 1.55 .64h1a2.2 2.2 0 0 1 2.2 2.2v1a2.2 2.2 0 0 0 .64 1.55l.7 .7a2.2 2.2 0 0 1 0 3.12l-.7 .7a2.2 2.2 0 0 0 -.64 1.55v1a2.2 2.2 0 0 1 -2.2 2.2h-1a2.2 2.2 0 0 0 -1.55 .64l-.7 .7a2.2 2.2 0 0 1 -3.12 0l-.7 -.7a2.2 2.2 0 0 0 -1.55 -.64h-1a2.2 2.2 0 0 1 -2.2 -2.2v-1a2.2 2.2 0 0 0 -.64 -1.55l-.7 -.7a2.2 2.2 0 0 1 0 -3.12l.7 -.7a2.2 2.2 0 0 0 .64 -1.55v-1" /></svg>',
        careers: '<svg ' + SVG_ATTRS + '><path d="M7 7h10a2 2 0 0 1 2 2v1l1 1v3l-1 1v3a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2v-3l-1 -1v-3l1 -1v-1a2 2 0 0 1 2 -2z" /><path d="M10 7v-2a1 1 0 0 1 1 -1h2a1 1 0 0 1 1 1v2" /></svg>',
        applications: '<svg ' + SVG_ATTRS + '><path d="M3 7a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2z" /><path d="M3 7l9 6l9 -6" /></svg>',
        staff: '<svg ' + SVG_ATTRS + '><path d="M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0" /><path d="M6 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2" /></svg>',
        beauticians: '<svg ' + SVG_ATTRS + '><path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" /><path d="M12 7v5l3 3" /></svg>',
    };

    /** @type {Array<{id:string, label:string, icon:string, href?:string, children?:Array<{label:string,href:string}>, permission?:object}>} */
    const ITEMS = [
        {
            id: "dashboard",
            label: "Dashboard",
            icon: "dashboard",
            href: "index.html",
            permission: { type: "require", perm: "analytics:read" },
        },
        {
            id: "bookings",
            label: "Bookings",
            icon: "bookings",
            permission: {
                type: "requireAny",
                perms: ["bookings:read", "staff:read", "staff:create", "staff:update", "staff:archive", "staff:manage_status", "staff:manage_locations"],
            },
            children: [
                { label: "Overview", href: "bookings.html" },
                { label: "Verify Booking", href: "bookings/index.html" },
                { label: "Calendar", href: "bookings/calendar.html" },
                { label: "Salon Bookings", href: "salon-bookings.html" },
                { label: "Booking Overview", href: "booking-overview.html" },
                { label: "Inventory Items", href: "inventory-items.html" },
                { label: "Inventory Log (Legacy)", href: "staff-inventory.html" },
            ],
        },
        {
            id: "payments",
            label: "Payments",
            icon: "payments",
            href: "payments.html",
            permission: { type: "require", perm: "users:view_wallet" },
        },
        {
            id: "contacts",
            label: "Contacts",
            icon: "users",
            permission: {
                type: "requireAny",
                perms: ["users:read", "bookings:read", "suppliers:read"],
            },
            children: [
                { label: "Users", href: "users.html" },
                { label: "Customer Contacts", href: "customer-contacts.html" },
                { label: "Lifecycle Campaigns", href: "lifecycle-campaigns.html" },
                { label: "Suppliers", href: "suppliers.html" },
                { label: "Vendors", href: "vendors.html" },
            ],
        },
        {
            id: "payroll",
            label: "Payroll",
            icon: "users",
            href: "payroll.html",
            permission: {
                type: "requireAny",
                perms: ["payroll:read", "payroll:manage"],
            },
        },
        {
            id: "services",
            label: "Services",
            icon: "services",
            href: "services.html",
            permission: {
                type: "requireAny",
                perms: ["services:create", "services:update", "services:toggle_status", "services:delete", "services:manage_categories"],
            },
        },
        {
            id: "branches",
            label: "Branches",
            icon: "branches",
            // Permission set now covers both nested pages — Branches itself
            // and Branch Finance (formerly its own top-level item) — since
            // the group's visibility gates access to both.
            permission: {
                type: "requireAny",
                perms: ["branches:read", "branches:manage", "branch_finance:read", "branch_finance:reconcile"],
            },
            children: [
                { label: "Overview", href: "branches.html" },
                { label: "Branch Finance", href: "branch-finance.html" },
            ],
        },
        {
            id: "shop",
            label: "Shop",
            icon: "shop",
            badge: "confirmedOrders",
            permission: {
                type: "requireAny",
                perms: ["shop:manage_products", "shop:manage_categories", "shop:manage_delivery", "shop:update_status"],
            },
            children: [
                { label: "Products", href: "shop.html#products" },
                { label: "Categories", href: "shop.html#categories" },
                { label: "Delivery Regions", href: "shop.html#delivery" },
                { label: "Orders", href: "shop.html#orders" },
            ],
        },
        {
            id: "referrals",
            label: "Referrals",
            icon: "referrals",
            permission: { type: "require", perm: "referrals:read" },
            children: [
                { label: "Regular Referrals", href: "referrals.html" },
                { label: "Referral Campaigns", href: "referral-campaigns.html" },
            ],
        },
        {
            id: "discounts",
            label: "Discounts",
            icon: "discounts",
            href: "discounts.html",
            permission: { type: "require", perm: "discounts:read" },
        },
        {
            id: "careers",
            label: "Careers",
            icon: "careers",
            href: "careers.html",
            permission: { type: "require", perm: "jobs:read" },
        },
        {
            id: "applications",
            label: "Applications",
            icon: "applications",
            permission: {
                type: "requireAny",
                perms: ["application:read", "application:manage_status", "application:convert"],
            },
            children: [
                { label: "All Applications", href: "applications.html" },
                { label: "Interview Schedule", href: "applications.html?status=INTERVIEW_SCHEDULED" },
            ],
        },
        {
            id: "staff",
            label: "Staff",
            icon: "staff",
            permission: {
                type: "requireAny",
                perms: ["staff:read", "staff:create", "staff:update", "staff:archive", "staff:manage_status", "staff:manage_locations"],
            },
            children: [
                { label: "Staff Records", href: "staff.html" },
                { label: "Company Documents", href: "staff-documents.html" },
                { label: "Announcements", href: "staff-announcements.html" },
                { label: "Tasks & Directives", href: "staff-directives.html" },
                { label: "Attendance", href: "staff-attendance.html" },
                { label: "Leave Requests", href: "leave-requests.html" },
            ],
        },
        {
            id: "beauticians",
            label: "Beauticians",
            icon: "beauticians",
            permission: {
                type: "requireAny",
                perms: ["beauticians:read", "beauticians:manage", "beauticians:review", "beauticians:assign_services", "beauticians:process_payouts"],
            },
            children: [
                { label: "List", href: "beauticians.html#list" },
                { label: "Profile Reviews", href: "beauticians.html#reviews" },
                { label: "Services", href: "beauticians.html#services" },
                { label: "Settings", href: "beauticians.html#settings" },
                { label: "Payouts", href: "beauticians.html#payouts" },
            ],
        },
    ];

    function normalizePage(href) {
        return String(href || "")
            .replace(/^(\.\.\/|\.\/)+/, "")
            .split("#")[0]
            .split("?")[0];
    }

    /** Build filename → permission rule map (used by RBAC). */
    function buildPagePermissionMap() {
        const map = {};
        ITEMS.forEach(function (item) {
            if (!item.permission) return;
            if (item.href) {
                map[normalizePage(item.href)] = item.permission;
            }
            if (item.children) {
                item.children.forEach(function (child) {
                    map[normalizePage(child.href)] = item.permission;
                });
            }
        });
        return map;
    }

    /** Top-level pages for first-accessible redirect (excludes dashboard). */
    function getAccessiblePageOrder() {
        return [
            "bookings.html",
            "payments.html",
            "users.html",
            "services.html",
            "branches.html",
            "shop.html",
            "referrals.html",
            "discounts.html",
            "careers.html",
            "applications.html",
            "staff.html",
            "beauticians.html",
        ];
    }

    return {
        ITEMS,
        ICONS,
        normalizePage,
        buildPagePermissionMap,
        getAccessiblePageOrder,
    };
})();
window.NavConfig = NavConfig;