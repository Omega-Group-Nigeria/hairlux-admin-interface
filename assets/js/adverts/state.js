/**
 * adverts/state.js — central page state for Advert Banners admin
 */
(function (global) {
    'use strict';

    global.Adverts = global.Adverts || {};

    global.Adverts.State = {
        banners: [],
        editId: null,
        editing: null,        // banner object being edited (if any)
        pendingFile: null,    // File/Blob awaiting crop
        croppedFile: null,    // File/Blob ready for upload (cropped to 3:1)
        croppedBlobUrl: null, // object URL for the preview <img>
        replacingImage: false,
        pendingOp: null,      // 'list' | 'reorder' | 'toggle' | 'save' | 'delete'
        pageAlertTimer: null,
        MAX_UPLOAD_BYTES: 10 * 1024 * 1024,
        CROP_WIDTH: 954,
        CROP_HEIGHT: 318,
    };
})(window);