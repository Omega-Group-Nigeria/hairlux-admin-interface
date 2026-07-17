/**
 * shop/api.js — wrappers around Shop.* for the shop admin page
 */
(function (global) {
    'use strict';

    var SP = (global.ShopPage = global.ShopPage || {});

    SP.Api = {
        // Products
        getProducts: function (params) { return Shop.getProducts(params); },
        getProduct: function (id) { return Shop.getProduct(id); },
        createProduct: function (formData) { return Shop.createProduct(formData); },
        updateProduct: function (id, formData) { return Shop.updateProduct(id, formData); },
        updateProductStatus: function (id, status) { return Shop.updateProductStatus(id, status); },
        deleteProduct: function (id) { return Shop.deleteProduct(id); },

        // Categories
        getCategories: function () { return Shop.getCategories(); },
        createCategory: function (payload) { return Shop.createCategory(payload); },
        updateCategory: function (id, payload) { return Shop.updateCategory(id, payload); },
        deleteCategory: function (id) { return Shop.deleteCategory(id); },

        // Delivery
        getDeliveryRegions: function () { return Shop.getDeliveryRegions(); },
        createDeliveryRegion: function (payload) { return Shop.createDeliveryRegion(payload); },
        updateDeliveryRegion: function (id, payload) { return Shop.updateDeliveryRegion(id, payload); },
        deleteDeliveryRegion: function (id) { return Shop.deleteDeliveryRegion(id); },

        // Orders
        getOrders: function (params) { return Shop.getOrders(params); },
        getOrder: function (id) { return Shop.getOrder(id); },
        updateOrderStatus: function (id, status, notes) { return Shop.updateOrderStatus(id, status, notes); },
    };
})(window);
