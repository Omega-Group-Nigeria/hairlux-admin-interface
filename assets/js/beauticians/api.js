/**
 * beauticians/api.js — thin wrappers around Beauticians.* and Services.* for the page
 */
(function (global) {
    'use strict';

    var BP = (global.BeauticiansPage = global.BeauticiansPage || {});

    BP.Api = {
        // Beauticians
        listBeauticians: function (params) { return Beauticians.listBeauticians(params); },
        getBeautician: function (id) { return Beauticians.getBeautician(id); },
        updateBeautician: function (id, payload) { return Beauticians.updateBeautician(id, payload); },
        getBeauticianReviews: function (id, params) { return Beauticians.getBeauticianReviews(id, params); },
        getPendingProfileReviews: function (params) { return Beauticians.getPendingProfileReviews(params); },
        getPerformance: function (params) { return Beauticians.getPerformance(params); },
        approveKyc: function (id) { return Beauticians.approveKyc(id); },
        rejectKyc: function (id, reason) { return Beauticians.rejectKyc(id, reason); },
        approveProfile: function (id, notes) { return Beauticians.approveProfile(id, notes); },
        rejectProfile: function (id, reason, notes, scope) {
            return Beauticians.rejectProfile(id, reason, notes, scope);
        },
        listAssignedServices: function (id) { return Beauticians.listAssignedServices(id); },
        assignServices: function (id, serviceIds) { return Beauticians.assignServices(id, serviceIds); },
        getHomeServiceSettings: function () { return Beauticians.getHomeServiceSettings(); },
        updateHomeServiceSettings: function (payload) { return Beauticians.updateHomeServiceSettings(payload); },
        listServiceCommissionRates: function () { return Beauticians.listServiceCommissionRates(); },
        setServiceCommissionRate: function (serviceId, rate) { return Beauticians.setServiceCommissionRate(serviceId, rate); },
        deleteServiceCommissionRate: function (serviceId) { return Beauticians.deleteServiceCommissionRate(serviceId); },
        getDispatchSettings: function () { return Beauticians.getDispatchSettings(); },
        updateDispatchSettings: function (payload) { return Beauticians.updateDispatchSettings(payload); },
        updateDispatch: function (id, suspendedOrPayload) { return Beauticians.updateDispatch(id, suspendedOrPayload); },
        listPayouts: function (params) { return Beauticians.listPayouts(params); },
        processPayout: function (id) { return Beauticians.processPayout(id); },
        getDailyPayoutPool: function () { return Beauticians.getDailyPayoutPool(); },

        // Services catalog
        getServices: function (params) { return Services.getAll(params); },
    };
})(window);
