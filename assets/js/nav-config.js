/**
 * nav-config.js: Hairlux Admin
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
        apps: '<svg ' + SVG_ATTRS + '><path d="M4 4m0 1a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z" /><path d="M4 15m0 1a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z" /><path d="M14 4m0 1a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z" /><path d="M14 14m0 1a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z" /></svg>',
    };

    // ── Page-access rules ────────────────────────────────────────────────────
    // Every sidebar link is gated on the READ permission its page needs to
    // load its data -- the same permission the page's main API endpoint
    // checks (@Permission on the admin controller). No read permission ->
    // the link is not shown at all. Write-only permissions (create/update/
    // approve...) never make a page visible on their own: without read, the
    // page could only ever show "you do not have permission".
    //
    // A group (dropdown) is visible when at least one of its links is --
    // derived from the children below, never a separate hand-kept list.
    function read(perm) { return { type: "require", perm: perm }; }
    function readAny() { return { type: "requireAny", perms: Array.prototype.slice.call(arguments) }; }

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

    /** Group rule derived from its children's rules. */
    function childrenRule(children) {
        return anyOf.apply(null, children.map(function (c) { return c.permission; }));
    }

    function group(item) {
        item.permission = childrenRule(item.children);
        return item;
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
     * @type {Array<{id:string, label:string, icon:string, href?:string, children?:Array<{label:string,href:string,permission:object}>, permission:object}>}
     */
    const ITEMS = [
        {
            id: "dashboard",
            label: "Dashboard",
            icon: "dashboard",
            href: "index.html",
            permission: read("analytics:read"),
        },
        group({
            id: "bookings",
            label: "Bookings",
            icon: "bookings",
            children: [
                { label: "Overview", href: "bookings.html", permission: read("bookings:read") },
                { label: "Booking Overview", href: "booking-overview.html", permission: read("bookings:read") },
                { label: "Salon Bookings", href: "salon-bookings.html", permission: read("bookings:read") },
                { label: "Calendar", href: "bookings/calendar.html", permission: read("bookings:read") },
                { label: "Verify Booking", href: "bookings/index.html", permission: read("bookings:read") },
            ],
        }),
        {
            id: "payments",
            label: "Payments",
            icon: "payments",
            href: "payments.html",
            // Wallet stats/transactions endpoints require payments:read.
            permission: read("payments:read"),
        },
        group({
            id: "business-intelligence",
            label: "Business Intelligence",
            icon: "businessIntelligence",
            children: [
                { label: "Business Snapshot", href: "business-intelligence.html", permission: read("business_intelligence:read") },
                { label: "Performance & Comparison", href: "performance-comparison.html", permission: read("business_intelligence:performance_comparison:read") },
                { label: "Customers & Sales", href: "customers-sales.html", permission: read("business_intelligence:customers_sales:read") },
                { label: "Cost, Inventory & Financial Position", href: "cost-inventory-financial.html", permission: read("business_intelligence:cost_inventory_financial:read") },
                { label: "Forecast & Alerts", href: "forecast-alerts.html", permission: read("business_intelligence:forecast_alerts:read") },
                { label: "KPI Engine Registry", href: "kpi-registry.html", permission: read("business_intelligence:kpi_registry:read") },
            ],
        }),
        group({
            id: "customers",
            label: "Customers & Marketing",
            icon: "users",
            children: [
                { label: "Users", href: "users.html", permission: read("users:read") },
                { label: "Customer Contacts", href: "customer-contacts.html", permission: read("customer_contacts:read") },
                { label: "Lifecycle Campaigns", href: "lifecycle-campaigns.html", permission: read("lifecycle_campaigns:read") },
                { label: "Rewards & Loyalty", href: "rewards.html", permission: read("rewards:read") },
                { label: "Discounts", href: "discounts.html", permission: read("discounts:read") },
                { label: "Referrals", href: "referrals.html", permission: read("referrals:read") },
                { label: "Referral Campaigns", href: "referral-campaigns.html", permission: read("referrals:read") },
            ],
        }),
        {
            id: "services",
            label: "Services",
            icon: "services",
            href: "services.html",
            // No services:read exists in the permission catalogue -- the
            // catalogue itself is public. Services is a management page, so
            // it stays visible to holders of any services management permission.
            permission: readAny("services:create", "services:update", "services:toggle_status", "services:delete", "services:manage_categories", "services:manage_recipe"),
        },
        group({
            id: "beauticians",
            label: "Beauticians",
            icon: "beauticians",
            children: [
                { label: "List", href: "beauticians.html#list", permission: read("beauticians:read") },
                { label: "Profile Reviews", href: "beauticians.html#reviews", permission: read("beauticians:review") },
                { label: "Services", href: "beauticians.html#services", permission: read("beauticians:read") },
                { label: "Settings", href: "beauticians.html#settings", permission: read("settings:read") },
                { label: "Payouts", href: "beauticians.html#payouts", permission: read("beauticians:process_payouts") },
            ],
        }),
        group({
            id: "shop",
            label: "Shop",
            icon: "shop",
            badge: "confirmedOrders",
            children: [
                { label: "Products", href: "shop.html#products", permission: read("shop:read") },
                { label: "Categories", href: "shop.html#categories", permission: read("shop:read") },
                { label: "Delivery Regions", href: "shop.html#delivery", permission: read("shop:read") },
                { label: "Orders", href: "shop.html#orders", permission: read("shop:read") },
            ],
        }),
        group({
            id: "inventory",
            label: "Inventory & Procurement",
            icon: "inventory",
            children: [
                { label: "Inventory Products", href: "inventory-products.html", permission: read("inventory_products:read") },
                { label: "Inventory Items", href: "inventory-items.html", permission: read("inventory:read") },
                { label: "Product Sales", href: "product-sales.html", permission: read("product_sales:read") },
                { label: "Purchase Requests", href: "purchase-requests.html", permission: read("purchase_requests:read") },
                { label: "Purchases", href: "purchases.html", permission: read("purchases:read") },
                { label: "Suppliers", href: "suppliers.html", permission: read("suppliers:read") },
                { label: "Vendors", href: "vendors.html", permission: read("suppliers:read") },
                { label: "Inventory Log (Legacy)", href: "staff-inventory.html", permission: read("inventory:read") },
            ],
        }),
        group({
            id: "finance",
            label: "Finance",
            icon: "finance",
            children: [
                // financial-dashboard.html was merged into this page (it now just redirects here).
                { label: "Financial Dashboard", href: "financial-transactions.html", permission: read("financial_transactions:read") },
                { label: "Profitability Report", href: "profitability-report.html", permission: read("reports:read_profitability") },
                { label: "Expense Requests", href: "expense-requests.html", permission: read("expense_requests:read") },
                { label: "Branch Bank Accounts", href: "branch-bank-accounts.html", permission: read("branch_bank_accounts:read") },
                { label: "Branch Finance", href: "branch-finance.html", permission: read("branch_finance:read") },
                { label: "Software Costs", href: "software-costs.html", permission: read("software_costs:read") },
            ],
        }),
        {
            id: "branches",
            label: "Branches",
            icon: "branches",
            href: "branches.html",
            permission: read("branches:read"),
        },
        group({
            id: "academy",
            label: "Academy",
            icon: "academy",
            children: [
                { label: "Commerce (Orders, Refunds, Certificates)", href: "academy-commerce.html", permission: read("academy_commerce:read") },
                { label: "Trainings & Curriculum", href: "academy-training.html", permission: read("academy_training:read") },
                { label: "Cohorts", href: "academy-cohorts.html", permission: read("academy_training:read") },
                { label: "Digital Courses", href: "academy-courses.html", permission: read("academy_courses:read") },
                { label: "Free Resources & Leads", href: "academy-resources.html", permission: read("academy_resources:read") },
            ],
        }),
        group({
            id: "staff",
            label: "Staff",
            icon: "staff",
            children: [
                { label: "Staff Records", href: "staff.html", permission: read("staff:read") },
                // Each has its own read permission, matching the API.
                { label: "Company Documents", href: "staff-documents.html", permission: read("company_documents:read") },
                { label: "Announcements", href: "staff-announcements.html", permission: read("announcements:read") },
                { label: "Tasks & Directives", href: "staff-directives.html", permission: read("tasks:read") },
                { label: "Attendance", href: "staff-attendance.html", permission: read("attendance:read") },
                { label: "Leave Requests", href: "leave-requests.html", permission: read("leave:read") },
                { label: "Training Library (LMS)", href: "lms.html", permission: read("lms:read") },
                { label: "Approval Chains", href: "approval-chains.html", permission: read("approval_chains:read") },
            ],
        }),
        group({
            id: "payroll",
            label: "Payroll",
            icon: "users",
            badge: "pendingCommissions",
            children: [
                { label: "Payroll", href: "payroll.html", permission: read("payroll:read") },
                { label: "Commission Plans", href: "commission-plans.html", permission: read("payroll:read_commission_plans") },
                { label: "Commission Approvals", href: "commission-approvals.html", permission: read("payroll:read_commission_plans"), badge: "pendingCommissions" },
            ],
        }),
        group({
            id: "recruitment",
            label: "Recruitment",
            icon: "careers",
            children: [
                { label: "Job Postings", href: "careers.html", permission: read("jobs:read") },
                { label: "All Applications", href: "applications.html", permission: read("application:read") },
                { label: "Interview Schedule", href: "applications.html?status=INTERVIEW_SCHEDULED", permission: read("application:read") },
            ],
        }),
        {
            id: "site-stats",
            label: "Site Stats",
            icon: "dashboard",
            href: "site-stats.html",
            // Only permission the site-stats API has.
            permission: read("site_stats:manage"),
        },
        {
            id: "audit-trail",
            label: "Audit Trail",
            icon: "history",
            href: "audit-trail.html",
            permission: read("audit_trail:read"),
        },
        {
            id: "app-mgt",
            label: "App Mgt",
            icon: "apps",
            permission: {
                type: "requireAny",
                perms: ["adverts:read", "adverts:manage"],
            },
            children: [
                { label: "Adverts", href: "app/adverts.html" },
            ],
        },
    ];

    function normalizePage(href) {
        return String(href || "")
            .replace(/^(\.\.\/|\.\/)+/, "")
            .split("#")[0]
            .split("?")[0];
    }

    /**
     * Build filename → permission rule map (used by RBAC for the page guard).
     * A page reached through several links (tabbed pages such as
     * beauticians.html#list / #payouts) gets the union of their rules: the
     * page opens if ANY of its tabs is readable; each tab link is gated
     * separately by buildLinkPermissionMap below.
     */
    function buildPagePermissionMap() {
        const map = {};
        function add(href, rule) {
            if (!rule) return;
            const page = normalizePage(href);
            map[page] = map[page] ? anyOf(map[page], rule) : rule;
        }
        ITEMS.forEach(function (item) {
            if (item.href) add(item.href, item.permission);
            if (item.children) {
                item.children.forEach(function (child) { add(child.href, child.permission || item.permission); });
            }
        });
        return map;
    }

    /**
     * Link key (the href exactly as configured, hash/query included) →
     * permission rule. The sidebar stamps each link with data-nav-key so
     * RBAC can gate individual tab links (beauticians.html#payouts), which
     * a filename-only lookup can't tell apart.
     */
    function buildLinkPermissionMap() {
        const map = {};
        ITEMS.forEach(function (item) {
            if (item.href && item.permission) map[item.href] = item.permission;
            if (item.children) {
                item.children.forEach(function (child) {
                    const rule = child.permission || item.permission;
                    if (rule) map[child.href] = rule;
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
            "financial-transactions.html",
            "branches.html",
            "academy-commerce.html",
            "academy-training.html",
            "academy-cohorts.html",
            "academy-courses.html",
            "academy-resources.html",
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
        buildLinkPermissionMap,
        getAccessiblePageOrder,
    };
})();
window.NavConfig = NavConfig;