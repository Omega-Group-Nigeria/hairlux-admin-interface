/**
 * shop-product-images.js — Hairlux Admin
 * Multi-image upload/management for shop products (1–5 images).
 * Requires Dropzone and shop.js (optional helpers).
 */
var ShopProductImages = window.ShopProductImages || (function () {

    const MAX_IMAGES = 5;
    const MIN_IMAGES = 1;
    const MAX_FILE_MB = 10;
    const ACCEPTED_FILES = "image/jpeg,image/jpg,image/png,image/webp,image/gif";

    function sortImages(images) {
        return (Array.isArray(images) ? images.slice() : [])
            .filter(function (img) { return img && (img.url || img.id); })
            .sort(function (a, b) { return (a.sortOrder ?? 0) - (b.sortOrder ?? 0); });
    }

    function getThumbnailUrl(product) {
        if (!product) return "";
        const images = sortImages(product.images);
        if (images.length && images[0].url) return images[0].url;
        return product.imageUrl || product.image_url || "";
    }

    function formatCount(count) {
        return count + " / " + MAX_IMAGES;
    }

    function ProductImageManager(options) {
        this.galleryEl = options.galleryEl;
        this.dropzoneEl = options.dropzoneEl;
        this.countEl = options.countEl;
        this.hintEl = options.hintEl;
        this.requiredMarkEl = options.requiredMarkEl;
        this.onChange = options.onChange || function () {};
        this.existing = [];
        this.pending = [];
        this._dz = null;
        this._isCreate = true;
    }

    ProductImageManager.prototype.reset = function () {
        this.existing = [];
        this.pending = [];
        this._isCreate = true;
        if (this._dz) this._dz.removeAllFiles(true);
        this.render();
    };

    ProductImageManager.prototype.loadProduct = function (product) {
        this._isCreate = false;
        this.existing = sortImages(product && product.images).map(function (img) {
            return {
                id: img.id,
                url: img.url,
                sortOrder: img.sortOrder ?? 0,
                markedRemove: false,
            };
        });
        this.pending = [];
        if (this._dz) this._dz.removeAllFiles(true);
        this.render();
    };

    ProductImageManager.prototype.getActiveExisting = function () {
        return this.existing.filter(function (img) { return !img.markedRemove; });
    };

    ProductImageManager.prototype.getTotalCount = function () {
        return this.getActiveExisting().length + this.pending.length;
    };

    ProductImageManager.prototype.getSlotsRemaining = function () {
        return Math.max(0, MAX_IMAGES - this.getTotalCount());
    };

    ProductImageManager.prototype.getRemoveIds = function () {
        return this.existing
            .filter(function (img) { return img.markedRemove && img.id; })
            .map(function (img) { return img.id; });
    };

    ProductImageManager.prototype.initDropzone = function () {
        if (this._dz || typeof Dropzone === "undefined") return;
        var self = this;
        Dropzone.autoDiscover = false;
        this._dz = new Dropzone(this.dropzoneEl, {
            url: "/",
            autoProcessQueue: false,
            uploadMultiple: false,
            parallelUploads: MAX_IMAGES,
            maxFiles: MAX_IMAGES,
            addRemoveLinks: false,
            clickable: true,
            acceptedFiles: ACCEPTED_FILES,
            maxFilesize: MAX_FILE_MB,
            previewsContainer: false,
            createImageThumbnails: false,
        });
        this._dz.on("addedfile", function (file) {
            if (self.getSlotsRemaining() <= 0) {
                self._dz.removeFile(file);
                return;
            }
            if (file.size > MAX_FILE_MB * 1024 * 1024) {
                self._dz.removeFile(file);
                return;
            }
            file._localId = "pending-" + Date.now() + "-" + Math.random().toString(36).slice(2);
            file._previewUrl = URL.createObjectURL(file);
            self.pending.push(file);
            self.render();
            self.onChange();
        });
    };

    ProductImageManager.prototype._removePending = function (localId) {
        var self = this;
        this.pending = this.pending.filter(function (file) {
            if (file._localId === localId) {
                if (file._previewUrl) URL.revokeObjectURL(file._previewUrl);
                if (self._dz) self._dz.removeFile(file);
                return false;
            }
            return true;
        });
        this.render();
        this.onChange();
    };

    ProductImageManager.prototype._toggleExistingRemove = function (id) {
        var self = this;
        var img = this.existing.find(function (item) { return item.id === id; });
        if (!img) return;
        if (!img.markedRemove && this.getTotalCount() <= MIN_IMAGES) return;
        img.markedRemove = !img.markedRemove;
        this.render();
        this.onChange();
    };

    ProductImageManager.prototype.render = function () {
        if (!this.galleryEl) return;
        var self = this;
        var total = this.getTotalCount();
        var activeExisting = this.getActiveExisting();
        var html = "";

        this.existing.forEach(function (img) {
            var isCover = !img.markedRemove && activeExisting[0] && activeExisting[0].id === img.id;
            var removedClass = img.markedRemove ? " is-removed" : "";
            var canToggle = img.markedRemove || self.getTotalCount() > MIN_IMAGES;
            html +=
                '<div class="product-image-card' + removedClass + '" data-existing-id="' + img.id + '">' +
                '<img src="' + escAttr(img.url) + '" alt="Product image">' +
                (isCover ? '<span class="badge bg-primary text-white product-image-badge">Cover</span>' : "") +
                (img.markedRemove ? '<span class="badge bg-warning text-dark product-image-badge">Removing</span>' : "") +
                renderRemoveButton("toggle-existing", img.id, {
                    extraClass: img.markedRemove ? " is-undo" : "",
                    disabled: !canToggle,
                    label: img.markedRemove ? "Undo remove" : "Remove image",
                }) +
                "</div>";
        });

        this.pending.forEach(function (file) {
            html +=
                '<div class="product-image-card is-new" data-pending-id="' + file._localId + '">' +
                '<img src="' + escAttr(file._previewUrl) + '" alt="New upload">' +
                '<span class="badge bg-success text-white product-image-badge">New</span>' +
                renderRemoveButton("remove-pending", file._localId, { label: "Remove image" }) +
                "</div>";
        });

        this.galleryEl.innerHTML = html;

        var remaining = this.getSlotsRemaining();

        if (this.countEl) this.countEl.textContent = formatCount(total);
        if (this.requiredMarkEl) this.requiredMarkEl.style.display = this._isCreate ? "" : "none";
        if (this.hintEl) {
            this.hintEl.textContent = remaining > 0
                ? "Add up to " + remaining + " more image" + (remaining !== 1 ? "s" : "") + ". First image is the cover thumbnail. Max " + MAX_FILE_MB + " MB each."
                : "Maximum " + MAX_IMAGES + " images reached. Remove an image to add another.";
        }
        if (this.dropzoneEl) {
            this.dropzoneEl.style.display = remaining > 0 ? "" : "none";
            if (this._dz) this._dz.options.maxFiles = remaining + this.pending.length;
        }

        this.galleryEl.querySelectorAll(".product-image-remove").forEach(function (btn) {
            btn.addEventListener("click", function () {
                if (btn.disabled) return;
                var action = btn.dataset.action;
                var id = btn.dataset.id;
                if (action === "toggle-existing") self._toggleExistingRemove(id);
                if (action === "remove-pending") self._removePending(id);
            });
        });
    };

    ProductImageManager.prototype.validate = function () {
        var total = this.getTotalCount();
        if (this._isCreate && total < MIN_IMAGES) {
            return { ok: false, message: "Please upload at least one product image." };
        }
        if (!this._isCreate && total < MIN_IMAGES) {
            return { ok: false, message: "Product must have at least one image." };
        }
        if (total > MAX_IMAGES) {
            return { ok: false, message: "A product can have at most " + MAX_IMAGES + " images." };
        }
        return { ok: true, message: "" };
    };

    ProductImageManager.prototype.appendToFormData = function (formData) {
        this.pending.forEach(function (file) {
            formData.append("images", file);
        });
        var removeIds = this.getRemoveIds();
        if (removeIds.length) {
            formData.append("removeImageIds", JSON.stringify(removeIds));
        }
    };

    ProductImageManager.prototype.hasImageChanges = function () {
        return this.pending.length > 0 || this.getRemoveIds().length > 0;
    };

    const REMOVE_ICON =
        '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" ' +
        'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<path d="M18 6l-12 12" /><path d="M6 6l12 12" /></svg>';

    function renderRemoveButton(action, id, options) {
        options = options || {};
        var extraClass = options.extraClass || "";
        var disabled = options.disabled ? ' disabled title="At least one image is required"' : "";
        var label = options.label || "Remove image";
        return (
            '<button type="button" class="product-image-remove' + extraClass + '" data-action="' + action + '" data-id="' + id + '"' +
            disabled + ' aria-label="' + escAttr(label) + '">' + REMOVE_ICON + "</button>"
        );
    }

    function escAttr(value) {
        return String(value == null ? "" : value)
            .replace(/&/g, "&amp;")
            .replace(/"/g, "&quot;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
    }

    return {
        MAX_IMAGES: MAX_IMAGES,
        MIN_IMAGES: MIN_IMAGES,
        ACCEPTED_FILES: ACCEPTED_FILES,
        sortImages: sortImages,
        getThumbnailUrl: getThumbnailUrl,
        ProductImageManager: ProductImageManager,
    };
})();
window.ShopProductImages = ShopProductImages;