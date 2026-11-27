/**
 * DocFiles: shared document upload, list and viewer (ATS release 1).
 * Used by Announcements, Tasks & Directives (admin) and the staff portal.
 *
 * - Allowed: PDF, JPG/JPEG, PNG, DOC/DOCX, XLS/XLSX, up to 10 MB each
 *   (the API checks again, including the file's real type).
 * - Each file uploads on its own with a progress bar, and can be retried
 *   or removed.
 * - PDFs and images open in a viewer; Word and Excel files download.
 *
 * Depends on auth.js (Auth.getToken) and config.js (window.API_BASE).
 */
const DocFiles = (() => {
    const MAX_BYTES = 10 * 1024 * 1024;
    const MAX_FILES = 10;
    const EXTENSIONS = ["pdf", "jpg", "jpeg", "png", "doc", "docx", "xls", "xlsx"];
    const ACCEPT = EXTENSIONS.map(function (e) { return "." + e; }).join(",");
    const FORMATS_LABEL = "PDF, JPG, PNG, Word or Excel";

    function esc(s) {
        return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
            return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
        });
    }

    function ext(name) {
        var m = /\.([a-z0-9]+)$/i.exec(name || "");
        return m ? m[1].toLowerCase() : "";
    }

    function kind(doc) {
        var t = (doc && doc.mimeType) || "";
        var e = ext(doc && (doc.fileName || doc.name));
        if (t === "application/pdf" || e === "pdf") return "pdf";
        if (/^image\//.test(t) || ["jpg", "jpeg", "png", "webp"].indexOf(e) >= 0) return "image";
        if (/word/.test(t) || e === "doc" || e === "docx") return "word";
        if (/excel|spreadsheet/.test(t) || e === "xls" || e === "xlsx") return "excel";
        return "file";
    }

    function size(bytes) {
        if (!bytes) return "";
        if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + " MB";
        if (bytes >= 1024) return Math.round(bytes / 1024) + " KB";
        return bytes + " bytes";
    }

    /** A plain-words problem with the file, or null when it can be uploaded. */
    function check(file) {
        if (EXTENSIONS.indexOf(ext(file.name)) < 0) return '"' + file.name + '" is not an allowed file type. Upload ' + FORMATS_LABEL + ".";
        if (!file.size) return '"' + file.name + '" is empty.';
        if (file.size > MAX_BYTES) return '"' + file.name + '" is ' + size(file.size) + ". Each file can be at most 10 MB.";
        return null;
    }

    var LABELS = { pdf: "PDF", image: "IMG", word: "DOC", excel: "XLS", file: "FILE" };
    var COLORS = { pdf: "#d63939", image: "#2fb344", word: "#206bc4", excel: "#2b8a3e", file: "#6c7a91" };

    function injectStyles() {
        if (document.getElementById("doc-files-styles")) return;
        var css =
            ".df-list{display:flex;flex-direction:column;gap:6px;margin:8px 0 0}" +
            ".df-row{display:flex;align-items:center;gap:10px;padding:8px 10px;border:1px solid rgba(128,128,128,.28);border-radius:8px;min-width:0}" +
            ".df-badge{flex:0 0 auto;font:700 10px/1 system-ui,sans-serif;color:#fff;border-radius:4px;padding:5px 6px;letter-spacing:.03em}" +
            ".df-thumb{flex:0 0 auto;width:36px;height:36px;border-radius:4px;object-fit:cover;background:rgba(128,128,128,.15)}" +
            ".df-main{flex:1 1 auto;min-width:0}" +
            ".df-name{font-weight:600;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
            ".df-meta{font-size:12px;opacity:.7}" +
            ".df-meta.df-err{color:#d63939;opacity:1}" +
            ".df-bar{height:4px;border-radius:2px;background:rgba(128,128,128,.2);margin-top:4px;overflow:hidden}" +
            ".df-bar>span{display:block;height:100%;background:#206bc4;width:0;transition:width .15s}" +
            ".df-actions{flex:0 0 auto;display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end}" +
            ".df-btn{font:600 12px/1 system-ui,sans-serif;padding:6px 9px;border-radius:6px;border:1px solid rgba(128,128,128,.35);background:transparent;color:inherit;cursor:pointer;text-decoration:none;white-space:nowrap}" +
            ".df-btn:hover{background:rgba(128,128,128,.12);color:inherit;text-decoration:none}" +
            ".df-btn.df-danger{color:#d63939;border-color:rgba(214,57,57,.45)}" +
            ".df-add{display:flex;align-items:center;gap:8px;flex-wrap:wrap}" +
            ".df-hint{font-size:12px;opacity:.7}" +
            ".df-removed .df-name{text-decoration:line-through;opacity:.6}" +
            ".df-viewer{position:fixed;inset:0;z-index:2000;background:rgba(0,0,0,.75);display:flex;flex-direction:column}" +
            ".df-viewer-head{display:flex;align-items:center;gap:8px;padding:10px 14px;background:#1d273b;color:#fff}" +
            ".df-viewer-head .df-name{flex:1;font-size:14px}" +
            ".df-viewer-head .df-btn{border-color:rgba(255,255,255,.4);color:#fff}" +
            ".df-viewer-body{flex:1;display:flex;align-items:center;justify-content:center;padding:12px;min-height:0}" +
            ".df-viewer-body iframe{width:100%;height:100%;border:0;background:#fff;border-radius:6px}" +
            ".df-viewer-body img{max-width:100%;max-height:100%;object-fit:contain;border-radius:6px;background:#fff}" +
            "@media (max-width:575px){.df-row{flex-wrap:wrap}.df-actions{width:100%;justify-content:flex-start}}";
        var style = document.createElement("style");
        style.id = "doc-files-styles";
        style.textContent = css;
        document.head.appendChild(style);
    }

    function icon(doc) {
        var k = kind(doc);
        if (k === "image" && doc.viewUrl) return '<img class="df-thumb" alt="" src="' + esc(doc.viewUrl) + '">';
        return '<span class="df-badge" style="background:' + COLORS[k] + '">' + LABELS[k] + "</span>";
    }

    /** Opens a PDF or image in a full-screen viewer; Word / Excel download. */
    function openViewer(doc) {
        var k = kind(doc);
        if (k !== "pdf" && k !== "image") { window.location.href = doc.downloadUrl || doc.viewUrl; return; }
        // Phones show only the first page of a PDF inside a frame: open it in the phone's own viewer.
        if (k === "pdf" && window.matchMedia && window.matchMedia("(max-width: 767px)").matches) {
            window.open(doc.viewUrl, "_blank", "noopener");
            return;
        }
        injectStyles();
        var wrap = document.createElement("div");
        wrap.className = "df-viewer";
        wrap.setAttribute("role", "dialog");
        wrap.setAttribute("aria-label", doc.fileName || "Document");
        wrap.innerHTML =
            '<div class="df-viewer-head"><span class="df-name">' + esc(doc.fileName) + "</span>" +
            '<a class="df-btn" href="' + esc(doc.viewUrl) + '" target="_blank" rel="noopener">Open in new tab</a>' +
            (doc.downloadUrl ? '<a class="df-btn" href="' + esc(doc.downloadUrl) + '">Download</a>' : "") +
            '<button type="button" class="df-btn" data-df-close>Close</button></div>' +
            '<div class="df-viewer-body">' +
            (k === "pdf"
                ? '<iframe title="' + esc(doc.fileName) + '" src="' + esc(doc.viewUrl) + '"></iframe>'
                : '<img alt="' + esc(doc.fileName) + '" src="' + esc(doc.viewUrl) + '">') +
            "</div>";
        function close() { wrap.remove(); document.removeEventListener("keydown", onKey, true); }
        function onKey(e) { if (e.key === "Escape") { e.stopPropagation(); close(); } }
        wrap.addEventListener("click", function (e) {
            if (e.target === wrap || e.target.closest("[data-df-close]")) close();
        });
        document.addEventListener("keydown", onKey, true);
        document.body.appendChild(wrap);
    }

    /** Read-only list with View / Download. Call bind(container, docs) after inserting the HTML. */
    function listHtml(docs) {
        if (!docs || !docs.length) return "";
        injectStyles();
        return '<div class="df-list">' + docs.map(function (d, i) {
            var k = kind(d);
            var canView = k === "pdf" || k === "image";
            return '<div class="df-row">' + icon(d) +
                '<div class="df-main"><div class="df-name" title="' + esc(d.fileName) + '">' + esc(d.fileName) + "</div>" +
                '<div class="df-meta">' + esc([LABELS[k] === "IMG" ? "Image" : LABELS[k], size(d.sizeBytes)].filter(Boolean).join(" · ")) + "</div></div>" +
                '<div class="df-actions">' +
                (canView ? '<button type="button" class="df-btn" data-df-view="' + i + '">View</button>' : "") +
                (d.downloadUrl ? '<a class="df-btn" href="' + esc(d.downloadUrl) + '">Download</a>' : "") +
                "</div></div>";
        }).join("") + "</div>";
    }

    function bind(container, docs) {
        if (!container) return;
        container.querySelectorAll("[data-df-view]").forEach(function (btn) {
            btn.addEventListener("click", function (e) {
                e.preventDefault();
                e.stopPropagation();
                openViewer(docs[Number(btn.getAttribute("data-df-view"))]);
            });
        });
    }

    /** POSTs one file as multipart `file`, reporting progress (0-100). Resolves with the API's `data`. */
    function upload(path, file, onProgress) {
        var xhr = new XMLHttpRequest();
        var promise = new Promise(function (resolve, reject) {
            var base = (window.API_BASE || "").replace(/\/$/, "");
            xhr.open("POST", base + path);
            xhr.setRequestHeader("Authorization", "Bearer " + Auth.getToken());
            xhr.upload.onprogress = function (e) { if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100)); };
            xhr.onload = function () {
                var raw = {};
                try { raw = JSON.parse(xhr.responseText || "{}"); } catch (_) { /* not JSON */ }
                if (xhr.status >= 200 && xhr.status < 300) resolve(raw.data !== undefined ? raw.data : raw);
                else if (xhr.status === 413) reject(new Error('"' + file.name + '" is too large. Each file can be at most 10 MB.'));
                else reject(new Error((Array.isArray(raw.message) ? raw.message.join(" ") : raw.message) || "Upload failed (" + xhr.status + ")."));
            };
            xhr.onerror = function () { reject(new Error("Upload failed: check your connection and retry.")); };
            xhr.onabort = function () { reject(new Error("Upload cancelled.")); };
            var fd = new FormData();
            fd.append("file", file);
            xhr.send(fd);
        });
        promise.abort = function () { xhr.abort(); };
        return promise;
    }

    /**
     * File picker with per-file upload status.
     * options:
     *   uploadPath: string, or function () => string -- where each file is POSTed
     *   existing:   documents already saved (shown with View / Download / Remove)
     *   deferRemoval: true  -> removing a saved file is only marked, and sent on save (removedIds())
     *                 false -> onRemove(doc) is called at once (staff evidence)
     *   onRemove:   function (doc) => Promise -- removes an uploaded / saved file now
     *   onChange:   called whenever the list changes
     *   hint:       text under the button
     */
    function picker(el, options) {
        injectStyles();
        options = options || {};
        var items = [];
        var seq = 0;

        el.innerHTML =
            '<div class="df-add"><button type="button" class="df-btn" data-df-add>+ Add files</button>' +
            '<span class="df-hint">' + esc(options.hint || (FORMATS_LABEL + ", up to 10 MB each, at most " + MAX_FILES + " files.")) + "</span></div>" +
            '<input type="file" multiple accept="' + ACCEPT + '" hidden data-df-input>' +
            '<div class="df-list" data-df-list></div>';
        var input = el.querySelector("[data-df-input]");
        var listEl = el.querySelector("[data-df-list]");
        el.querySelector("[data-df-add]").addEventListener("click", function () { input.click(); });
        input.addEventListener("change", function () {
            Array.prototype.slice.call(input.files || []).forEach(add);
            input.value = "";
        });

        function activeCount() {
            return items.filter(function (it) { return it.status !== "removed" && it.status !== "failed"; }).length;
        }

        function add(file) {
            var item = { key: ++seq, file: file, status: "uploading", progress: 0, error: null, doc: null };
            var problem = check(file);
            if (!problem && activeCount() >= MAX_FILES) problem = "At most " + MAX_FILES + " files can be attached.";
            if (problem) { item.status = "failed"; item.error = problem; item.noRetry = true; items.push(item); render(); return; }
            items.push(item);
            start(item);
        }

        function start(item) {
            item.status = "uploading";
            item.progress = 0;
            item.error = null;
            render();
            var path = typeof options.uploadPath === "function" ? options.uploadPath() : options.uploadPath;
            item.req = upload(path, item.file, function (p) { item.progress = p; renderRow(item); });
            item.req.then(function (doc) {
                item.doc = doc;
                item.status = "done";
                render();
            }).catch(function (err) {
                if (item.status === "removed") return;
                item.status = "failed";
                item.error = err.message;
                render();
            });
        }

        function remove(item) {
            if (item.status === "uploading" && item.req) { item.status = "removed"; item.req.abort(); items.splice(items.indexOf(item), 1); render(); return; }
            if (item.status === "failed") { items.splice(items.indexOf(item), 1); render(); return; }
            if (item.status === "existing" && options.deferRemoval !== false) { item.status = "removed"; render(); return; }
            if (item.status === "removed") { item.status = item.wasExisting ? "existing" : "done"; render(); return; }
            // An uploaded file: removed now.
            var doc = item.doc;
            item.status = "removing";
            render();
            Promise.resolve(options.onRemove ? options.onRemove(doc) : null).then(function () {
                items.splice(items.indexOf(item), 1);
                render();
            }).catch(function (err) {
                item.status = item.wasExisting ? "existing" : "done";
                item.error = err.message || "Could not remove the file.";
                render();
            });
        }

        function rowHtml(item) {
            var doc = item.doc || { fileName: item.file && item.file.name, sizeBytes: item.file && item.file.size };
            var k = kind(doc);
            var meta, actions = "";
            if (item.status === "uploading") meta = "Uploading… " + item.progress + "%";
            else if (item.status === "failed") meta = item.error || "Upload failed.";
            else if (item.status === "removing") meta = "Removing…";
            else if (item.status === "removed") meta = "Will be removed when you save";
            else meta = [item.status === "done" && !item.wasExisting ? "Uploaded" : null, size(doc.sizeBytes)].filter(Boolean).join(" · ");
            if (item.error && (item.status === "done" || item.status === "existing")) meta += " · " + item.error;
            var canView = item.doc && (k === "pdf" || k === "image") && item.status !== "removed";
            if (canView) actions += '<button type="button" class="df-btn" data-df-act="view">View</button>';
            if (item.doc && item.doc.downloadUrl && item.status !== "removed") actions += '<a class="df-btn" href="' + esc(item.doc.downloadUrl) + '">Download</a>';
            if (item.status === "failed" && !item.noRetry) actions += '<button type="button" class="df-btn" data-df-act="retry">Retry</button>';
            if (item.status !== "removing") {
                actions += '<button type="button" class="df-btn' + (item.status === "removed" ? "" : " df-danger") + '" data-df-act="remove">' +
                    (item.status === "removed" ? "Undo" : item.status === "uploading" ? "Cancel" : "Remove") + "</button>";
            }
            return '<div class="df-row' + (item.status === "removed" ? " df-removed" : "") + '" data-df-key="' + item.key + '">' +
                (item.doc ? icon(item.doc) : '<span class="df-badge" style="background:' + COLORS[k] + '">' + LABELS[k] + "</span>") +
                '<div class="df-main"><div class="df-name" title="' + esc(doc.fileName) + '">' + esc(doc.fileName) + "</div>" +
                '<div class="df-meta' + (item.status === "failed" ? " df-err" : "") + '">' + esc(meta) + "</div>" +
                (item.status === "uploading" ? '<div class="df-bar"><span style="width:' + item.progress + '%"></span></div>' : "") +
                "</div>" +
                '<div class="df-actions">' + actions + "</div></div>";
        }

        function wire(row, item) {
            row.querySelectorAll("[data-df-act]").forEach(function (btn) {
                btn.addEventListener("click", function () {
                    var act = btn.getAttribute("data-df-act");
                    if (act === "view") openViewer(item.doc);
                    if (act === "retry") start(item);
                    if (act === "remove") remove(item);
                });
            });
        }

        function renderRow(item) {
            var row = listEl.querySelector('[data-df-key="' + item.key + '"]');
            if (!row) return render();
            var meta = row.querySelector(".df-meta");
            var bar = row.querySelector(".df-bar>span");
            if (meta) meta.textContent = "Uploading… " + item.progress + "%";
            if (bar) bar.style.width = item.progress + "%";
        }

        function render() {
            listEl.innerHTML = items.map(rowHtml).join("");
            items.forEach(function (item) {
                var row = listEl.querySelector('[data-df-key="' + item.key + '"]');
                if (row) wire(row, item);
            });
            if (options.onChange) options.onChange(api);
        }

        function reset(existing) {
            items.forEach(function (it) { if (it.status === "uploading" && it.req) { it.status = "removed"; it.req.abort(); } });
            items = (existing || []).map(function (doc) {
                return { key: ++seq, doc: doc, status: "existing", wasExisting: true, progress: 100 };
            });
            render();
        }

        var api = {
            /** Ids of files uploaded in this picker (send as documentIds). */
            newIds: function () { return items.filter(function (it) { return it.status === "done" && !it.wasExisting; }).map(function (it) { return it.doc.id; }); },
            /** Ids of saved files marked for removal (send as removeDocumentIds). */
            removedIds: function () { return items.filter(function (it) { return it.status === "removed" && it.wasExisting; }).map(function (it) { return it.doc.id; }); },
            busy: function () { return items.some(function (it) { return it.status === "uploading" || it.status === "removing"; }); },
            failedCount: function () { return items.filter(function (it) { return it.status === "failed"; }).length; },
            /** Files that will be on the item after saving (for previews). */
            docs: function () { return items.filter(function (it) { return it.doc && (it.status === "done" || it.status === "existing"); }).map(function (it) { return it.doc; }); },
            reset: reset,
        };
        reset(options.existing);
        return api;
    }

    return { ACCEPT: ACCEPT, MAX_BYTES: MAX_BYTES, MAX_FILES: MAX_FILES, FORMATS_LABEL: FORMATS_LABEL, check: check, kind: kind, size: size, upload: upload, listHtml: listHtml, bind: bind, openViewer: openViewer, picker: picker };
})();
