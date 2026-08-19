/**
 * adverts/handlers.js — event wiring and page logic for Advert Banners
 */
(function (global) {
    'use strict';

    var State = global.Adverts.State;
    var Api = global.Adverts.Api;
    var Utils = global.Adverts.Utils;
    var UI = global.Adverts.UI;

    function bootstrap(name) {
        var tabler = global.tabler || {};
        return (tabler.bootstrap && tabler.bootstrap.Modal && tabler.bootstrap) || global.bootstrap || null;
    }

    var _modal = null; // bootstrap Modal helper
    var _cropper = null;
    var _pendingDataUrl = null;

    // ── Modal helpers ──────────────────────────────────────────────
    function bs() { return bootstrap(); }

    function showModal(el) {
        var api = bs();
        if (api) api.Modal.getOrCreateInstance(el).show();
        else el.classList.add("show", "d-block");
    }

    function hideModal(el) {
        var api = bs();
        if (api) api.Modal.getOrCreateInstance(el).hide();
        else el.classList.remove("show", "d-block");
    }

    // ── Data helpers ──────────────────────────────────────────────
    function findBanner(id) {
        return State.banners.find(function (b) { return String(b.id) === String(id); }) || null;
    }

    // ── List loading ──────────────────────────────────────────────
    function loadBanners() {
        State.pendingOp = "list";
        Utils.setTableLoading();
        Api.list()
            .then(function (items) {
                items.sort(function (a, b) {
                    var ao = typeof a.sortOrder === "number" ? a.sortOrder : 0;
                    var bo = typeof b.sortOrder === "number" ? b.sortOrder : 0;
                    return ao - bo;
                });
                State.banners = items;
                UI.renderList();
                if (State.pendingOp === "list") State.pendingOp = null;
            })
            .catch(function (err) {
                State.pendingOp = null;
                Utils.setPageAlert("danger", "Failed to load banners: " + (err.message || err));
                Utils.showEmpty(true);
                document.getElementById("adverts-tbody").innerHTML = "";
            });
    }

    // ── Create / Edit form ────────────────────────────────────────
    function openCreate() {
        if (!RBAC.can("adverts:manage")) {
            Utils.flashPageAlert("danger", "You don't have permission to create banners.");
            return;
        }
        UI.showCreateForm();
        showModal(document.getElementById("modal-banner-form"));
    }

    function openEdit(id) {
        if (!RBAC.can("adverts:manage")) {
            Utils.flashPageAlert("danger", "You don't have permission to edit banners.");
            return;
        }
        var banner = findBanner(id);
        if (!banner) return;
        UI.showEditForm(banner);
        showModal(document.getElementById("modal-banner-form"));
    }

    // ── File selection & crop flow ────────────────────────────────
    function triggerFilePick() {
        var input = document.getElementById("banner-file-input");
        input.value = "";
        input.click();
    }

    function validateFile(file) {
        if (!file) return "No file selected.";
        if (!/^image\//.test(file.type)) return "That file is not an image.";
        if (file.size > State.MAX_UPLOAD_BYTES) return "Image is larger than 10 MB.";
        return null;
    }

    function onFileChosen(file) {
        var err = validateFile(file);
        if (err) {
            Utils.setFormAlert("danger", err);
            return;
        }
        var reader = new FileReader();
        reader.onload = function (e) {
            _pendingDataUrl = e.target.result;
            startCrop();
        };
        reader.onerror = function () {
            Utils.setFormAlert("danger", "Could not read the selected file.");
        };
        reader.readAsDataURL(file);
    }

    function startCrop() {
        Utils.setFormAlert("", "");
        var img = document.getElementById("crop-img");
        img.src = _pendingDataUrl;
        showModal(document.getElementById("modal-crop"));
    }

    function initCropper() {
        var img = document.getElementById("crop-img");
        if (!img.src) return;
        if (_cropper) _cropper.destroy();
        if (!img.complete) {
            img.addEventListener("load", initCropper, { once: true });
            return;
        }
        _cropper = new Cropper(img, {
            aspectRatio: State.CROP_WIDTH / State.CROP_HEIGHT,
            viewMode: 1,
            autoCropArea: 1,
            background: true,
            guides: true,
            center: true,
            highlight: false,
            dragMode: "move",
            checkOrientation: true,
            minCropBoxWidth: 200,
            minCropBoxHeight: 66,
        });
    }

    function applyCrop() {
        if (!_cropper) return;
        var canvas = _cropper.getCroppedCanvas({
            width: State.CROP_WIDTH,
            height: State.CROP_HEIGHT,
            imageSmoothingQuality: "high",
        });
        canvas.toBlob(function (blob) {
            if (!blob) {
                Utils.setFormAlert("danger", "Could not generate cropped image.");
                return;
            }
            var ext = blob.type && blob.type.indexOf("png") !== -1 ? "png" : (blob.type && blob.type.indexOf("jpeg") !== -1 ? "jpg" : "png");
            var file = new File([blob], "banner-" + Date.now() + "." + ext, { type: blob.type || "image/png" });
            if (State.croppedBlobUrl) URL.revokeObjectURL(State.croppedBlobUrl);
            State.croppedFile = file;
            State.croppedBlobUrl = URL.createObjectURL(file);
            State.replacingImage = true;
            UI.showPreview(State.croppedBlobUrl);
            hideModal(document.getElementById("modal-crop"));
        }, "image/png", 1);
    }

    function clearCropped() {
        if (State.croppedBlobUrl) URL.revokeObjectURL(State.croppedBlobUrl);
        State.croppedBlobUrl = null;
        State.croppedFile = null;
        State.pendingFile = null;
        _pendingDataUrl = null;
        UI.revealPicker();
        Utils.setFormAlert("", "");
    }

    // ── Save ──────────────────────────────────────────────────────
    function buildFormData(forEdit) {
        var fd = new FormData();
        var title = document.getElementById("banner-title").value.trim();
        var linkUrl = document.getElementById("banner-link-url").value.trim();
        var isActive = document.getElementById("banner-is-active").checked;
        var sortOrder = document.getElementById("banner-sort-order").value.trim();

        fd.append("title", title);
        fd.append("isActive", isActive ? "true" : "false");

        if (forEdit) {
            // PATCH is partial: send linkUrl as "null" only when clearing an existing link.
            if (linkUrl) fd.append("linkUrl", linkUrl);
            else if (State.editing && (State.editing.linkUrl || State.editing.link_url)) fd.append("linkUrl", "null");
            if (sortOrder !== "") fd.append("sortOrder", String(parseInt(sortOrder, 10)));
            if (State.croppedFile) fd.append("image", State.croppedFile);
        } else {
            fd.append("linkUrl", linkUrl);
            if (sortOrder !== "") fd.append("sortOrder", String(parseInt(sortOrder, 10)));
            if (State.croppedFile) fd.append("image", State.croppedFile);
        }
        return fd;
    }

    function validateForm() {
        var title = document.getElementById("banner-title").value.trim();
        if (!title) {
            Utils.setFormAlert("danger", "Title is required.");
            return false;
        }
        if (!State.editId && !State.croppedFile) {
            Utils.setFormAlert("danger", "Choose and crop a banner image first.");
            return false;
        }
        var sortEl = document.getElementById("banner-sort-order");
        if (sortEl.value.trim() !== "") {
            var n = parseInt(sortEl.value.trim(), 10);
            if (isNaN(n) || n < 0) {
                Utils.setFormAlert("danger", "Order must be 0 or a positive number.");
                return false;
            }
        }
        return true;
    }

    function saveBanner() {
        if (!validateForm()) return;

        var forEdit = !!State.editId;
        var fd = buildFormData(forEdit);

        Utils.setFormAlert("", "");
        Utils.setBtnLoading("btn-save-banner", "banner-save-spinner", true, document.getElementById("banner-save-label"), "Saving…");

        var req = forEdit
            ? Api.update(State.editId, fd)
            : Api.create(fd);

        req.then(function () {
            Utils.setBtnLoading("btn-save-banner", "banner-save-spinner", false, document.getElementById("banner-save-label"), forEdit ? "Save Changes" : "Create Banner");
            hideModal(document.getElementById("modal-banner-form"));
            Utils.flashPageAlert("success", forEdit ? "Banner updated." : "Banner created.");
            loadBanners();
        }).catch(function (err) {
            Utils.setBtnLoading("btn-save-banner", "banner-save-spinner", false, document.getElementById("banner-save-label"), forEdit ? "Save Changes" : "Create Banner");
            Utils.setFormAlert("danger", (err && err.message) || "Could not save banner.");
        });
    }

    // ── Status toggle ─────────────────────────────────────────────
    function toggleActive(id, checkbox) {
        if (!RBAC.can("adverts:manage")) {
            checkbox.checked = !checkbox.checked;
            Utils.flashPageAlert("danger", "You don't have permission to change banner status.");
            return;
        }
        var banner = findBanner(id);
        if (!banner) return;

        var desired = checkbox.checked;
        var fd = new FormData();
        fd.append("isActive", desired ? "true" : "false");

        checkbox.disabled = true;
        Api.update(id, fd)
            .then(function () {
                banner.isActive = desired;
                UI.updateStats();
                Utils.flashPageAlert("success", desired ? "Banner is now active on the app home screen." : "Banner hidden from the app home screen.");
            })
            .catch(function (err) {
                checkbox.checked = !desired;
                Utils.flashPageAlert("danger", (err && err.message) || "Could not update status.");
            })
            .finally(function () {
                checkbox.disabled = false;
            });
    }

    // ── Reorder ───────────────────────────────────────────────────
    function moveBanner(id, delta) {
        if (!RBAC.can("adverts:manage")) {
            Utils.flashPageAlert("danger", "You don't have permission to reorder banners.");
            return;
        }
        var idx = State.banners.findIndex(function (b) { return String(b.id) === String(id); });
        var target = idx + delta;
        if (idx < 0 || target < 0 || target >= State.banners.length) return;

        var arr = State.banners.slice();
        var item = arr.splice(idx, 1)[0];
        arr.splice(target, 0, item);
        arr.forEach(function (b, i) { b.sortOrder = i; });
        State.banners = arr;
        UI.renderList();

        State.pendingOp = "reorder";
        Api.reorder(arr.map(function (b, i) { return { id: b.id, sortOrder: i }; }))
            .then(function () {
                if (State.pendingOp === "reorder") State.pendingOp = null;
                Utils.flashPageAlert("success", "Carousel order updated.");
            })
            .catch(function (err) {
                State.pendingOp = null;
                Utils.flashPageAlert("danger", (err && err.message) || "Could not save the new order. Reverting…");
                loadBanners();
            });
    }

    // ── Delete ────────────────────────────────────────────────────
    var _deleteId = null;

    function confirmDelete(id) {
        if (!RBAC.can("adverts:manage")) {
            Utils.flashPageAlert("danger", "You don't have permission to delete banners.");
            return;
        }
        var banner = findBanner(id);
        if (!banner) return;
        _deleteId = id;
        document.getElementById("delete-banner-title").textContent = banner.title || "Untitled";
        showModal(document.getElementById("modal-delete"));
    }

    function runDelete() {
        if (!_deleteId) return;
        Utils.setBtnLoading("btn-confirm-delete", "delete-spinner", true);
        Api.remove(_deleteId)
            .then(function () {
                Utils.setBtnLoading("btn-confirm-delete", "delete-spinner", false);
                hideModal(document.getElementById("modal-delete"));
                _deleteId = null;
                Utils.flashPageAlert("success", "Banner deleted.");
                loadBanners();
            })
            .catch(function (err) {
                Utils.setBtnLoading("btn-confirm-delete", "delete-spinner", false);
                Utils.flashPageAlert("danger", (err && err.message) || "Could not delete banner.");
            });
    }

    // ── Navbar ────────────────────────────────────────────────────
    function initNavbar() {
        var u = Auth.getUser();
        if (!u) return;
        var name = ((u.firstName || "") + " " + (u.lastName || "")).trim() || "Admin";
        document.querySelectorAll("#navbar-user-name, #dropdown-user-name").forEach(function (el) { el.textContent = name; });
        document.getElementById("navbar-user-avatar").textContent = name.charAt(0).toUpperCase();
        document.getElementById("dropdown-user-email").textContent = u.email || "";
        document.getElementById("navbar-user-role").textContent = ((u.adminRole && u.adminRole.name) || u.role || "Administrator").replace(/_/g, " ");
        document.getElementById("logout-btn").addEventListener("click", function (e) {
            e.preventDefault();
            Auth.logout();
        });
    }

    // ── Event wiring ──────────────────────────────────────────────
    function init() {
        initNavbar();

        var dropzone = document.getElementById("banner-dropzone");
        var fileInput = document.getElementById("banner-file-input");

        dropzone.addEventListener("click", function () { triggerFilePick(); });
        dropzone.addEventListener("keydown", function (e) {
            if (e.key === "Enter" || e.key === " ") { e.preventDefault(); triggerFilePick(); }
        });
        ["dragover", "dragenter"].forEach(function (evt) {
            dropzone.addEventListener(evt, function (e) {
                e.preventDefault();
                dropzone.classList.add("dragover");
            });
        });
        ["dragleave", "dragend", "drop"].forEach(function (evt) {
            dropzone.addEventListener(evt, function (e) {
                e.preventDefault();
                dropzone.classList.remove("dragover");
            });
        });
        dropzone.addEventListener("drop", function (e) {
            var file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
            if (file) onFileChosen(file);
        });
        fileInput.addEventListener("change", function () {
            var file = fileInput.files && fileInput.files[0];
            if (file) onFileChosen(file);
        });

        document.getElementById("btn-change-image").addEventListener("click", triggerFilePick);
        document.getElementById("btn-remove-image").addEventListener("click", clearCropped);
        document.getElementById("btn-replace-image").addEventListener("click", triggerFilePick);

        document.getElementById("btn-crop-apply").addEventListener("click", applyCrop);
        document.getElementById("btn-crop-zoom-in").addEventListener("click", function () { if (_cropper) _cropper.zoom(0.1); });
        document.getElementById("btn-crop-zoom-out").addEventListener("click", function () { if (_cropper) _cropper.zoom(-0.1); });
        document.getElementById("btn-crop-rotate-l").addEventListener("click", function () { if (_cropper) _cropper.rotate(-90); });
        document.getElementById("btn-crop-rotate-r").addEventListener("click", function () { if (_cropper) _cropper.rotate(90); });

        document.getElementById("modal-crop").addEventListener("shown.bs.modal", initCropper);
        document.getElementById("modal-crop").addEventListener("hidden.bs.modal", function () {
            if (_cropper) { _cropper.destroy(); _cropper = null; }
            document.getElementById("crop-img").removeAttribute("src");
            _pendingDataUrl = null;
        });

        document.getElementById("btn-new-banner").addEventListener("click", openCreate);
        document.getElementById("btn-refresh").addEventListener("click", loadBanners);
        document.getElementById("btn-save-banner").addEventListener("click", saveBanner);
        document.getElementById("btn-confirm-delete").addEventListener("click", runDelete);

        document.getElementById("adverts-tbody").addEventListener("click", function (e) {
            var target = e.target.closest("[data-id]");
            if (!target) return;
            var id = target.getAttribute("data-id");
            if (target.classList.contains("banner-edit")) openEdit(id);
            else if (target.classList.contains("banner-delete")) confirmDelete(id);
            else if (target.classList.contains("banner-move-up")) moveBanner(id, -1);
            else if (target.classList.contains("banner-move-down")) moveBanner(id, 1);
        });

        document.getElementById("adverts-tbody").addEventListener("change", function (e) {
            if (e.target.classList && e.target.classList.contains("banner-active-toggle")) {
                toggleActive(e.target.getAttribute("data-id"), e.target);
            }
        });

        loadBanners();
    }

    global.Adverts.Handlers = { init: init };
})(window);