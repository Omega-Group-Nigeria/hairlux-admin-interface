/**
 * adverts/ui.js — list rendering and modal state helpers
 */
(function (global) {
    'use strict';

    var State = global.Adverts.State;
    var Utils = global.Adverts.Utils;

    var ARROW_UP = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon"><path d="M6 15l6 -6l6 6" /></svg>';
    var ARROW_DOWN = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon"><path d="M6 9l6 6l6 -6" /></svg>';
    var ICON_EDIT = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon"><path d="M4 20h4l10.5 -10.5a2.828 2.828 0 1 0 -4 -4l-10.5 10.5z" /><path d="M13.5 6.5l4 4" /></svg>';
    var ICON_TRASH = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon"><path d="M4 7l16 0" /><path d="M10 11l0 6" /><path d="M14 11l0 6" /><path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12" /><path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3" /></svg>';

    function updateStats() {
        var total = State.banners.length;
        var active = State.banners.filter(function (b) { return b.isActive === true; }).length;
        document.getElementById("stat-total").textContent = total;
        document.getElementById("stat-active").textContent = active;
    }

    function buildRow(banner, index, total) {
        var id = banner.id;
        var isFirst = index === 0;
        var isLast = index === total - 1;
        var imageUrl = banner.imageUrl || banner.image_url || "";
        var title = Utils.esc(banner.title || "Untitled");
        var linkUrl = banner.linkUrl || banner.link_url || "";
        var linkHtml = linkUrl
            ? '<div class="small text-secondary text-truncate" title="' + Utils.escAttr(linkUrl) + '">' +
                '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon me-1"><path d="M9 15l6 -6" /><path d="M11 6l.5 -.5a3.5 3.5 0 0 1 5 5l-.5 .5" /><path d="M13 18l-.5 .5a3.5 3.5 0 0 1 -5 -5l.5 -.5" /></svg>' +
                Utils.esc(linkUrl) + "</div>"
            : '<div class="small text-secondary">No tap-through link</div>';

        var statusHtml =
            '<label class="form-check form-switch mb-0" title="Toggle home-screen visibility">' +
            '<input class="form-check-input banner-active-toggle" type="checkbox" data-id="' + Utils.escAttr(id) + '"' +
            (banner.isActive === true ? " checked" : "") + " /></label>";

        var sortOrderLabel = banner.sortOrder;
        var orderHtml =
            '<div class="d-flex align-items-center gap-1">' +
            '<button type="button" class="icon-btn banner-move-up" data-id="' + Utils.escAttr(id) + '" title="Move up"' + (isFirst ? " disabled" : "") + ">" + ARROW_UP + "</button>" +
            '<span class="badge bg-secondary-lt text-secondary" style="min-width:2rem">' + Utils.esc(sortOrderLabel) + "</span>" +
            '<button type="button" class="icon-btn banner-move-down" data-id="' + Utils.escAttr(id) + '" title="Move down"' + (isLast ? " disabled" : "") + ">" + ARROW_DOWN + "</button>" +
            "</div>";

        var actionsHtml =
            '<div class="d-flex gap-1 justify-content-end">' +
            '<button type="button" class="btn btn-sm btn-outline-secondary banner-edit" data-id="' + Utils.escAttr(id) + '">' + ICON_EDIT + ' Edit</button>' +
            '<button type="button" class="btn btn-sm btn-outline-danger banner-delete" data-id="' + Utils.escAttr(id) + '">' + ICON_TRASH + ' Delete</button>' +
            "</div>";

        var thumb = imageUrl
            ? '<img src="' + Utils.escAttr(imageUrl) + '" alt="' + Utils.escAttr(banner.title || "") + '" loading="lazy" />'
            : '<div class="d-flex align-items-center justify-content-center h-100 text-secondary">No image</div>';

        return (
            '<tr data-id="' + Utils.escAttr(id) + '">' +
            '<td><div class="banner-thumb">' + thumb + "</div></td>" +
            '<td><div class="fw-semibold text-truncate" style="max-width:320px">' + title + "</div>" + linkHtml + "</td>" +
            "<td>" + statusHtml + "</td>" +
            "<td>" + orderHtml + "</td>" +
            "<td>" + actionsHtml + "</td>" +
            "</tr>"
        );
    }

    function renderList() {
        var tbody = document.getElementById("adverts-tbody");
        if (!State.banners.length) {
            tbody.innerHTML = "";
            Utils.showEmpty(true);
        } else {
            Utils.showEmpty(false);
            tbody.innerHTML = State.banners.map(buildRow).join("");
        }
        updateStats();
    }

    function resetFormState() {
        State.editId = null;
        State.editing = null;
        State.pendingFile = null;
        State.croppedFile = null;
        State.croppedBlobUrl = null;
        State.replacingImage = false;

        var title = document.getElementById("banner-title");
        var linkUrl = document.getElementById("banner-link-url");
        var active = document.getElementById("banner-is-active");
        var sortOrder = document.getElementById("banner-sort-order");
        if (title) title.value = "";
        if (linkUrl) linkUrl.value = "";
        if (active) active.checked = false;
        if (sortOrder) sortOrder.value = "";
        Utils.setFormAlert("", "");
    }

    function showCreateForm() {
        resetFormState();
        document.getElementById("banner-form-title").textContent = "New Banner";
        document.getElementById("banner-save-label").textContent = "Create Banner";
        document.getElementById("banner-existing").classList.add("d-none");
        document.getElementById("banner-crop-preview-wrap").classList.add("d-none");
        document.getElementById("banner-picker-wrap").classList.remove("d-none");
        document.getElementById("banner-sort-order").placeholder = "Auto (append last)";
    }

    function showEditForm(banner) {
        resetFormState();
        State.editId = banner.id;
        State.editing = banner;

        document.getElementById("banner-form-title").textContent = "Edit Banner";
        document.getElementById("banner-save-label").textContent = "Save Changes";
        document.getElementById("banner-title").value = banner.title || "";
        document.getElementById("banner-link-url").value = banner.linkUrl || banner.link_url || "";
        document.getElementById("banner-is-active").checked = banner.isActive === true;
        var sortEl = document.getElementById("banner-sort-order");
        if (typeof banner.sortOrder === "number") sortEl.value = banner.sortOrder;
        else sortEl.value = "";
        sortEl.placeholder = "Keep current order";

        var existing = document.getElementById("banner-existing");
        var img = document.getElementById("banner-existing-img");
        if (banner.imageUrl || banner.image_url) {
            img.src = banner.imageUrl || banner.image_url;
            existing.classList.remove("d-none");
        } else {
            existing.classList.add("d-none");
        }

        document.getElementById("banner-crop-preview-wrap").classList.add("d-none");
        document.getElementById("banner-picker-wrap").classList.add("d-none");
    }

    function showPreview(imageDataUrl) {
        var img = document.getElementById("banner-crop-preview-img");
        img.src = imageDataUrl;
        document.getElementById("banner-crop-preview-wrap").classList.remove("d-none");
        document.getElementById("banner-picker-wrap").classList.add("d-none");
        document.getElementById("banner-existing").classList.add("d-none");
    }

    function revealPicker() {
        if (State.replacingImage && State.editing) {
            // Editing: keep the existing image panel, drop the fresh preview.
            document.getElementById("banner-crop-preview-wrap").classList.add("d-none");
            document.getElementById("banner-existing").classList.remove("d-none");
            document.getElementById("banner-picker-wrap").classList.add("d-none");
        } else {
            document.getElementById("banner-crop-preview-wrap").classList.add("d-none");
            document.getElementById("banner-existing").classList.add("d-none");
            document.getElementById("banner-picker-wrap").classList.remove("d-none");
        }
    }

    global.Adverts.UI = {
        renderList: renderList,
        updateStats: updateStats,
        showCreateForm: showCreateForm,
        showEditForm: showEditForm,
        showPreview: showPreview,
        revealPicker: revealPicker,
    };
})(window);