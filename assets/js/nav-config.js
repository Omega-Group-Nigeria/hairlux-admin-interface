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
        history: '<svg ' + SVG_ATTRS + '><path d="M12 8l0 4l2 2" /><path d="M3.05 11a9 9 0 1 1 .5 4m-.5 5v-5h5" /></svg>',
        businessIntelligence: '<svg ' + SVG_ATTRS + '><path d="M3 12m0 1a1 1 0 0 1 1 -1h2a1 1 0 0 1 1 1v7a1 1 0 0 1 -1 1h-2a1 1 0 0 1 -1 -1z" /><path d="M9 8m0 1a1 1 0 0 1 1 -1h2a1 1 0 0 1 1 1v11a1 1 0 0 1 -1 1h-2a1 1 0 0 1 -1 -1z" /><path d="M15 4m0 1a1 1 0 0 1 1 -1h2a1 1 0 0 1 1 1v15a1 1 0 0 1 -1 1h-2a1 1 0 0 1 -1 -1z" /><path d="M4 20h14" /></svg>',
        // Frontend Build Roadmap: Academy (Commerce Core, Training,
        // Cohorts shipped; Courses child arrives with Phase 4).
        academy: '<svg ' + SVG_ATTRS + '><path d="M22 9l-10 -4l-10 4l10 4l10 -4v6" /><path d="M6 10.6v5.4a6 3 0 0 0 12 0v-5.4" /></svg>',
        // Frontend Build Roadmap Phase 3: Rewards & Loyalty (rewards.html).
        inventory: '<svg ' + SVG_ATTRS + '><path d="M12 3l8 4.5l0 9l-8 4.5l-8 -4.5l0 -9l8 -4.5" /><path d="M12 12l8 -4.5" /><path d="M12 12l0 9" /><path d="M12 12l-8 -4.5" /></svg>',
        finance: '<svg ' + SVG_ATTRS + '><path d="M9 14c0 1.657 2.686 3 6 3s6 -1.343 6 -3s-2.686 -3 -6 -3s-6 1.343 -6 3z" /><path d="M9 14v4c0 1.656 2.686 3 6 3s6 -1.344 6 -3v-4" /><path d="M3 6c0 1.072 1.144 2.062 3 2.598s4.144 .536 6 0c1.856 -.536 3 -1.526 3 -2.598c0 -1.072 -1.144 -2.062 -3 -2.598s-4.144 -.536 -6 0c-1.856 .536 -3 1.526 -3 2.598z" /><path d="M3 6v10c0 .888 .772 1.45 2 2" /><path d="M3 11c0 .888 .772 1.45 2 2" /></svg>',
        rewards: '<svg ' + SVG_ATTRS + '><path d="M3 8m0 1a1 1 0 0 1 1 -1h16a1 1 0 0 1 1 1v3a1 1 0 0 1 -1 1h-16a1 1 0 0 1 -1 -1z" /><path d="M12 8l0 13" /><path d="M19 12l0 7a1 1 0 0 1 -1 1h-12a1 1 0 0 1 -1 -1l0 -7" /><path d="M7.5 8a2.5 2.5 0 0 1 0 -5a4.8 8 0 0 1 4.5 5a4.8 8 0 0 1 4.5 -5a2.5 2.5 0 0 1 0 5" /></svg>',
    };

    // Page-access rules shared by pages that were regrouped in the sidebar
    // reorganisation -- each moved page keeps EXACTLY the rule it had under
    // its old group, so nobody gains or loses access to any page.
    const PERM_BOOKINGS = {
        type: "requireAny",
        perms: ["bookings:read", "staff:read", "staff:create", "staff:update", "staff:archive", "staff:manage_status", "staff:manage_locations"],
    };
    const PERM_OPERATIONS = { // formerly the "Business Operations" group
        type: "requireAny",
        perms: ["users:read", "bookings:read", "suppliers:read", "expense_requests:read"],
    };
    const PERM_BRANCHES = {
        type: "requireAny",
        perms: [
            "branches:read", "branches:create", "branches:update",
            "branches:manage_manager", "branches:delete", "branches:manage_services",
            "branch_finance:read", "branch_finance:reconcile",
        ],
    };
    const PERM_REWARDS = { type: "requireAny", perms: ["rewards:read", "rewards:manage", "rewards:apply", "rewards:adjust"] };
    const PERM_REFERRALS = { type: "require", perm: "referrals:read" };
    const PERM_DISCOUNTS = { type: "require", perm: "discounts:read" };
    const PERM_JOBS = { type: "require", perm: "jobs:read" };
    const PERM_APPLICATIONS = { type: "requireAny", perms: ["application:read", "application:manage_status", "application:convert"] };

    /** Group is visible if the user can reach ANY of its children. */
    function anyOf() {
        const perms = [];
        Array.prototype.forEach.call(arguments, function (rule) {
            (rule.type === "require" ? [rule.perm] : rule.perms).forEach(function (p) {
                if (perms.indexOf(p) === -1) perms.push(p);
            });
        });
        return { type: "requireAny", perms: perms };
    }

    /**
     * Sidebar order (Business Intelligence deliberately unchanged, 4th):
     *   Daily operations  -> Dashboard, Bookings, Payments
     *   Insight           -> Business Intelligence
     *   Customers         -> Customers & Marketing
     *   What we sell      -> Services, Beauticians, Shop
     *   Back office       -> Inventory & Procurement, Finance, Branches
     *   Academy
     *   People            -> Staff, Payroll, Recruitment
     *   System            -> Site Stats, Audit Trail
     * @type {Array<{id:string, label:string, icon:string, href?:string, children?:Array<{label:string,href:string,permission?:object}>, permission?:object}>}
     */
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
            permission: PERM_BOOKINGS,
            children: [
                { label: "Overview", href: "bookings.html" },
                { label: "Booking Overview", href: "booking-overview.html" },
                { label: "Salon Bookings", href: "salon-bookings.html" },
                { label: "Calendar", href: "bookings/calendar.html" },
                { label: "Verify Booking", href: "bookings/index.html" },
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
            id: "business-intelligence",
            label: "Business Intelligence",
            icon: "businessIntelligence",
            // Group-level rule: visible if the user has ANY of the 6 sub-module
            // permissions below -- each child link additionally carries its own
            // specific permission (see buildPagePermissionMap), so a role
            // granted only one sub-module sees only that one link, not all 6.
            permission: {
                type: "requireAny",
                perms: [
                    "business_intelligence:read",
                    "business_intelligence:performance_comparison:read",
                    "business_intelligence:customers_sales:read",
                    "business_intelligence:cost_inventory_financial:read",
                    "business_intelligence:forecast_alerts:read",
                    "business_intelligence:kpi_registry:read",
                ],
            },
            children: [
                { label: "Business Snapshot", href: "business-intelligence.html", permission: { type: "require", perm: "business_intelligence:read" } },
                { label: "Performance & Comparison", href: "performance-comparison.html", permission: { type: "require", perm: "business_intelligence:performance_comparison:read" } },
                { label: "Customers & Sales", href: "customers-sales.html", permission: { type: "require", perm: "business_intelligence:customers_sales:read" } },
                { label: "Cost, Inventory & Financial Position", href: "cost-inventory-financial.html", permission: { type: "require", perm: "business_intelligence:cost_inventory_financial:read" } },
                { label: "Forecast & Alerts", href: "forecast-alerts.html", permission: { type: "require", perm: "business_intelligence:forecast_alerts:read" } },
                { label: "KPI Engine Registry", href: "kpi-registry.html", permission: { type: "require", perm: "business_intelligence:kpi_registry:read" } },
            ],
        },
        {
            id: "customers",
            label: "Customers & Marketing",
            icon: "users",
            permission: anyOf(PERM_OPERATIONS, PERM_REWARDS, PERM_DISCOUNTS, PERM_REFERRALS),
            children: [
                { label: "Users", href: "users.html", permission: PERM_OPERATIONS },
                { label: "Customer Contacts", href: "customer-contacts.html", permission: PERM_OPERATIONS },
                { label: "Lifecycle Campaigns", href: "lifecycle-campaigns.html", permission: PERM_OPERATIONS },
                { label: "Rewards & Loyalty", href: "rewards.html", permission: PERM_REWARDS },
                { label: "Discounts", href: "discounts.html", permission: PERM_DISCOUNTS },
                { label: "Referrals", href: "referrals.html", permission: PERM_REFERRALS },
                { label: "Referral Campaigns", href: "referral-campaigns.html", permission: PERM_REFERRALS },
            ],
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
            id: "inventory",
            label: "Inventory & Procurement",
            icon: "inventory",
            permission: anyOf(PERM_OPERATIONS, PERM_BOOKINGS),
            children: [
                { label: "Inventory Products", href: "inventory-products.html", permission: PERM_OPERATIONS },
                { label: "Inventory Items", href: "inventory-items.html", permission: PERM_BOOKINGS },
                { label: "Product Sales", href: "product-sales.html", permission: PERM_OPERATIONS },
                { label: "Purchase Requests", href: "purchase-requests.html", permission: PERM_OPERATIONS },
                { label: "Purchases", href: "purchases.html", permission: PERM_OPERATIONS },
                { label: "Suppliers", href: "suppliers.html", permission: PERM_OPERATIONS },
                { label: "Vendors", href: "vendors.html", permission: PERM_OPERATIONS },
                { label: "Inventory Log (Legacy)", href: "staff-inventory.html", permission: PERM_BOOKINGS },
            ],
        },
        {
            id: "finance",
            label: "Finance",
            icon: "finance",
            permission: anyOf(PERM_OPERATIONS, PERM_BRANCHES),
            children: [
                { label: "Financial Dashboard", href: "financial-dashboard.html", permission: PERM_OPERATIONS },
                { label: "Financial Transactions", href: "financial-transactions.html", permission: PERM_OPERATIONS },
                { label: "Profitability Report", href: "profitability-report.html", permission: PERM_OPERATIONS },
                { label: "Expense Requests", href: "expense-requests.html", permission: PERM_OPERATIONS },
                { label: "Branch Finance", href: "branch-finance.html", permission: PERM_BRANCHES },
            ],
        },
        {
            id: "branches",
            label: "Branches",
            icon: "branches",
            href: "branches.html",
            permission: PERM_BRANCHES,
        },
        {
            id: "academy",
            label: "Academy",
            icon: "academy",
            // Frontend Build Roadmap: group visible with ANY Academy
            // permission; each child (Commerce, Training, Cohorts, Digital
            // Courses) is additionally gated on its own -- same convention
            // as the Business Intelligence item above.
            permission: {
                type: "requireAny",
                perms: ["academy_commerce:read", "academy_commerce:manage", "academy_commerce:approve_refund", "academy_training:read", "academy_training:manage", "academy_courses:read", "academy_courses:manage", "academy_courses:moderate_reviews"],
            },
            children: [
                { label: "Commerce (Orders, Refunds, Certificates)", href: "academy-commerce.html", permission: { type: "require", perm: "academy_commerce:read" } },
                { label: "Trainings & Curriculum", href: "academy-training.html", permission: { type: "require", perm: "academy_training:read" } },
                { label: "Cohorts", href: "academy-cohorts.html", permission: { type: "require", perm: "academy_training:read" } },
                { label: "Digital Courses", href: "academy-courses.html", permission: { type: "require", perm: "academy_courses:read" } },
            ],
        },
        {
            id: "staff",
            label: "Staff",
            icon: "staff",

            permission: {
                type: "requireAny",
                perms: ["staff:read", "staff:create", "staff:update", "staff:archive", "staff:manage_status", "staff:manage_locations", "lms:read", "approval_chains:read"],
            },
            children: [
                { label: "Staff Records", href: "staff.html" },
                { label: "Company Documents", href: "staff-documents.html" },
                { label: "Announcements", href: "staff-announcements.html" },
                { label: "Tasks & Directives", href: "staff-directives.html" },
                { label: "Attendance", href: "staff-attendance.html" },
                { label: "Leave Requests", href: "leave-requests.html" },
                { label: "Training Library (LMS)", href: "lms.html" },
                { label: "Approval Chains", href: "approval-chains.html" },
            ],
        },
        {
            id: "payroll",
            label: "Payroll",
            icon: "users",
            permission: {
                type: "requireAny",
                // Dev Feedback Round 4, item #37: payroll:manage was split
                // into 7 granular permissions -- listed here so a user
                // with even a subset of them (not necessarily all) still
                // sees this nav item. Payroll Engine v2, Phase 4: the
                // commission-plan permissions are included too, so a user
                // with only those (and none of the period/payslip ones)
                // still sees the group and can reach Commission Plans.
                perms: [
                    "payroll:read", "payroll:manage_compensation", "payroll:approve_bank_change",
                    "payroll:create_period", "payroll:generate", "payroll:approve_period",
                    "payroll:manage_adjustments", "payroll:manage_settings", "payroll:correct",
                    "payroll:read_commission_plans", "payroll:create_commission_plan",
                    "payroll:update_commission_plan", "payroll:delete_commission_plan",
                    "payroll:assign_commission_plan",
                ],
            },
            children: [
                { label: "Payroll", href: "payroll.html" },
                { label: "Commission Plans", href: "commission-plans.html" },
            ],
        },
        {
            id: "recruitment",
            label: "Recruitment",
            icon: "careers",
            permission: anyOf(PERM_JOBS, PERM_APPLICATIONS),
            children: [
                { label: "Job Postings", href: "careers.html", permission: PERM_JOBS },
                { label: "All Applications", href: "applications.html", permission: PERM_APPLICATIONS },
                { label: "Interview Schedule", href: "applications.html?status=INTERVIEW_SCHEDULED", permission: PERM_APPLICATIONS },
            ],
        },
        {
            id: "site-stats",
            label: "Site Stats",
            icon: "dashboard",
            href: "site-stats.html",
            permission: {
                type: "requireAny",
                perms: ["site_stats:manage"],
            },
        },
        {
            id: "audit-trail",
            label: "Audit Trail",
            icon: "history",
            href: "audit-trail.html",
            permission: {
                type: "requireAny",
                perms: ["audit_trail:read"],
            },
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
            if (item.href && item.permission) {
                map[normalizePage(item.href)] = item.permission;
            }
            if (item.children) {
                item.children.forEach(function (child) {
                    // A child's own permission (e.g. each Business Intelligence
                    // sub-module) takes precedence; groups where every child
                    // still shares one permission fall back to the group's,
                    // unchanged from before.
                    const rule = child.permission || item.permission;
                    if (rule) map[normalizePage(child.href)] = rule;
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
            "customer-contacts.html",
            "rewards.html",
            "discounts.html",
            "referrals.html",
            "services.html",
            "beauticians.html",
            "shop.html",
            "inventory-products.html",
            "financial-dashboard.html",
            "branches.html",
            "academy-commerce.html",
            "academy-training.html",
            "academy-cohorts.html",
            "academy-courses.html",
            "staff.html",
            "payroll.html",
            "careers.html",
            "applications.html",
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