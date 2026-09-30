/**
 * shop/state.js — central page state for Shop admin
 */
(function (global) {
    'use strict';

    var SP = (global.ShopPage = global.ShopPage || {});

    SP.State = {
        VALID_SECTIONS: ["products", "categories", "delivery", "orders"],

        currentSection: "products",

        product: { status: "", search: "", categoryId: "" },
        order: { status: "", startDate: "", endDate: "", search: "" },

        categories: [],
        editProductId: null,
        editProductStatus: "ACTIVE",
        productImages: null,
        pendingOp: null,
        pageAlertTimer: null,
        nigerianStates: null,

        PRODUCT_ACTIONS_ICON: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon">' +
            '<path d="M12 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M12 19m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M12 5m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />' +
    '</svg>',
    };
})(window);
