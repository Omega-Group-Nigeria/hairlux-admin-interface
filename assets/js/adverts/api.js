/**
 * adverts/api.js — API wrappers for advert banner endpoints
 *
 * Requires:
 *   - config.js (window.API_BASE)
 *   - auth.js   (Auth.fetch, Auth.getToken, Auth.isTokenExpired, Auth.refreshAccessToken, Auth.logout)
 *
 * Endpoints (see advert-banners-api.md):
 *   GET    /admin/advert-banners
 *   POST   /admin/advert-banners            (multipart/form-data)
 *   PATCH  /admin/advert-banners/:id        (multipart/form-data, partial)
 *   DELETE /admin/advert-banners/:id
 *   PUT    /admin/advert-banners/reorder    (application/json)
 */
(function (global) {
    'use strict';

    function getBase() {
        return (window.API_BASE || "").replace(/\/$/, "");
    }

    async function jsonFetch(path, method, body) {
        const res = await Auth.fetch(path, {
            method: method || "GET",
            headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
            body: body !== undefined ? JSON.stringify(body) : undefined,
        });
        const raw = await res.json().catch(() => ({}));
        if (!res || !res.ok) throw new Error(raw.message || "Request failed (" + (res ? res.status : "no response") + ")");
        return raw.data !== undefined ? raw.data : raw;
    }

    async function multipartFetch(path, method, formData) {
        if (Auth.isTokenExpired()) {
            try { await Auth.refreshAccessToken(); } catch { Auth.logout(); return; }
        }

        const doFetch = () => fetch(getBase() + path, {
            method,
            headers: { Authorization: "Bearer " + Auth.getToken() },
            body: formData,
        });

        let res = await doFetch();
        if (res.status === 401) {
            try {
                await Auth.refreshAccessToken();
                res = await doFetch();
            } catch { Auth.logout(); return; }
        }

        const raw = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(raw.message || "Request failed (" + res.status + ")");
        return raw.data !== undefined ? raw.data : raw;
    }

    function parseList(data) {
        if (Array.isArray(data)) return data;
        if (data && Array.isArray(data.data)) return data.data;
        if (data && Array.isArray(data.banners)) return data.banners;
        if (data && Array.isArray(data.items)) return data.items;
        return [];
    }

    var Api = {
        list: function () {
            return jsonFetch("/admin/advert-banners", "GET").then(parseList);
        },

        create: function (formData) {
            return multipartFetch("/admin/advert-banners", "POST", formData);
        },

        update: function (id, formData) {
            return multipartFetch("/admin/advert-banners/" + encodeURIComponent(id), "PATCH", formData);
        },

        remove: function (id) {
            return jsonFetch("/admin/advert-banners/" + encodeURIComponent(id), "DELETE");
        },

        reorder: function (order) {
            return jsonFetch("/admin/advert-banners/reorder", "PUT", { order: order });
        },
    };

    global.Adverts.Api = Api;
})(window);