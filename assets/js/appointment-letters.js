/**
 * AppointmentLetters: appointment letters and their templates (ATS release 2).
 * Used on Applications (after the candidate accepts the offer) and on a staff
 * member's profile (letters for people already on staff).
 *
 *   AppointmentLetters.mountApplication(el, { applicationId, canWrite, getBranches })
 *   AppointmentLetters.mountStaff(el, { staffId, canWrite, getBranches })
 *   AppointmentLetters.openTemplates()
 *   AppointmentLetters.statusFor(applicationId)   // last loaded status, or null
 *
 * Draft -> Approve (final PDF) -> Send (emailed as a PDF attachment) -> Signed copy uploaded.
 * Depends on auth.js, config.js, Bootstrap, doc-files.js, and Quill + rich-text-editor.js.
 */
const AppointmentLetters = (() => {
    const EMPLOYMENT_TYPES = [
        ["FULL_TIME", "Full-time"], ["PART_TIME", "Part-time"], ["CONTRACT", "Contract"],
        ["INTERN", "Internship"], ["TEMPORARY", "Temporary"],
    ];
    const STATUS = {
        DRAFT: ["Draft", "bg-secondary-lt"],
        APPROVED: ["Approved", "bg-blue-lt"],
        SENT: ["Sent", "bg-purple-lt"],
        SIGNED: ["Signed", "bg-success-lt"],
    };
    const statusCache = {};

    // -- Helpers --------------------------------------------------------------

    function esc(s) {
        return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
            return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
        });
    }
    function typeLabel(t) {
        var f = EMPLOYMENT_TYPES.find(function (x) { return x[0] === t; });
        return f ? f[1] : (t || "Any type");
    }
    function money(n) {
        return n == null ? "-" : "₦" + Number(n).toLocaleString("en-NG", { maximumFractionDigits: 2 });
    }
    function dateText(v) {
        if (!v) return "-";
        var d = new Date(String(v).length === 10 ? v + "T12:00:00Z" : v);
        return isNaN(d) ? String(v) : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
    }
    function dateInput(v) { return v ? String(v).slice(0, 10) : ""; }

    async function api(path, method, body) {
        var res = await Auth.fetch(path, {
            method: method || "GET",
            headers: { "Content-Type": "application/json" },
            body: body === undefined ? undefined : JSON.stringify(body),
        });
        var raw = await res.json().catch(function () { return {}; });
        if (!res.ok) throw new Error((Array.isArray(raw.message) ? raw.message.join(" ") : raw.message) || "Request failed (" + res.status + ")");
        return raw.data !== undefined ? raw.data : raw;
    }

    /** The letter as a PDF from the API (a live preview for drafts), as a same-origin blob URL. */
    async function pdfBlobUrl(letterId) {
        var base = (window.API_BASE || "").replace(/\/$/, "");
        var res = await fetch(base + "/admin/appointment-letters/" + letterId + "/pdf", { headers: { Authorization: "Bearer " + Auth.getToken() } });
        if (!res.ok) {
            var raw = await res.json().catch(function () { return {}; });
            throw new Error(raw.message || "Could not load the PDF (" + res.status + ").");
        }
        return URL.createObjectURL(await res.blob());
    }

    async function viewPdf(letter) {
        var url = await pdfBlobUrl(letter.id);
        var name = (letter.pdf && letter.pdf.fileName) || ("Appointment letter - " + letter.recipientName + ".pdf");
        // Drafts are a preview only; an approved letter downloads under its own name.
        DocFiles.openViewer({ fileName: name, mimeType: "application/pdf", viewUrl: url, downloadUrl: (letter.pdf && letter.pdf.downloadUrl) || null });
    }

    async function printPdf(letter) {
        var url = await pdfBlobUrl(letter.id);
        var frame = document.createElement("iframe");
        frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
        frame.src = url;
        frame.onload = function () {
            try { frame.contentWindow.focus(); frame.contentWindow.print(); }
            catch (e) { window.open(url, "_blank"); }
            setTimeout(function () { frame.remove(); }, 60000);
        };
        document.body.appendChild(frame);
    }

    /** Lets the admin choose one file and uploads it; resolves with the upload (or null when cancelled). */
    function chooseAndUpload(accept, onProgress) {
        return new Promise(function (resolve, reject) {
            var input = document.createElement("input");
            input.type = "file";
            input.accept = accept;
            input.style.display = "none";
            input.addEventListener("change", function () {
                var file = input.files && input.files[0];
                input.remove();
                if (!file) return resolve(null);
                var problem = DocFiles.check(file);
                if (problem) return reject(new Error(problem));
                DocFiles.upload("/admin/documents/uploads", file, onProgress).then(resolve, reject);
            });
            document.body.appendChild(input);
            input.click();
        });
    }

    // -- One shared modal -------------------------------------------------------

    function modal(title, bodyHtml, footerHtml, size) {
        var el = document.getElementById("al-modal");
        if (!el) {
            el = document.createElement("div");
            el.className = "modal modal-blur fade";
            el.id = "al-modal";
            el.tabIndex = -1;
            el.innerHTML = '<div class="modal-dialog modal-dialog-scrollable"><div class="modal-content">' +
                '<div class="modal-header"><h5 class="modal-title"></h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>' +
                '<div class="modal-body"></div><div class="modal-footer"></div></div></div>';
            document.body.appendChild(el);
        }
        el.querySelector(".modal-dialog").className = "modal-dialog modal-dialog-scrollable " + (size || "modal-lg");
        el.querySelector(".modal-title").textContent = title;
        el.querySelector(".modal-body").innerHTML = '<div class="alert alert-danger d-none" data-al-error></div>' + bodyHtml;
        el.querySelector(".modal-footer").innerHTML = footerHtml || '<button type="button" class="btn btn-link link-secondary" data-bs-dismiss="modal">Close</button>';
        var BS = window.bootstrap || (window.tabler && window.tabler.bootstrap);
        var inst = BS.Modal.getOrCreateInstance(el);
        inst.show();
        return {
            el: el,
            q: function (sel) { return el.querySelector(sel); },
            error: function (msg) { var e = el.querySelector("[data-al-error]"); e.textContent = msg || ""; e.classList.toggle("d-none", !msg); },
            hide: function () { inst.hide(); },
        };
    }

    async function busy(btn, label, fn) {
        var original = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>' + esc(label);
        try { return await fn(); } finally { btn.disabled = false; btn.innerHTML = original; }
    }

    // -- Templates ----------------------------------------------------------------

    var _fields = null;
    async function fields() {
        if (!_fields) _fields = await api("/admin/appointment-letter-templates/fields");
        return _fields;
    }

    async function openTemplates() {
        var m = modal("Appointment letter templates",
            '<div class="text-secondary small mb-3">Written templates fill in each person\'s details ({{fields}}). A PDF template is used exactly as uploaded. The default template for an employment type is picked automatically.</div>' +
            '<div data-al-list><div class="text-center py-3"><div class="spinner-border text-primary"></div></div></div>',
            '<button type="button" class="btn btn-link link-secondary me-auto" data-bs-dismiss="modal">Close</button>' +
            '<button type="button" class="btn btn-outline-primary" data-al-new-pdf>Upload a PDF template</button>' +
            '<button type="button" class="btn btn-primary" data-al-new-text>New written template</button>');
        m.q("[data-al-new-text]").addEventListener("click", function () { editTemplate(null); });
        m.q("[data-al-new-pdf]").addEventListener("click", function () { editPdfTemplate(null); });
        try {
            var list = await api("/admin/appointment-letter-templates");
            m.q("[data-al-list]").innerHTML = list.length
                ? '<div class="list-group">' + list.map(function (t) {
                    return '<div class="list-group-item d-flex align-items-center gap-2 flex-wrap">' +
                        '<div class="flex-fill"><div class="fw-semibold">' + esc(t.name) +
                        (t.isDefault ? ' <span class="badge bg-green-lt">Default</span>' : '') + '</div>' +
                        '<div class="text-secondary small">' + (t.kind === "PDF" ? "PDF, used as it is" : "Written, fills in details") + ' &middot; ' + esc(typeLabel(t.employmentType)) + '</div></div>' +
                        (t.kind === "PDF" && t.pdf ? '<button class="btn btn-sm btn-ghost-secondary" data-al-view="' + t.id + '">View</button>' : '') +
                        '<button class="btn btn-sm btn-ghost-primary" data-al-edit="' + t.id + '">Edit</button>' +
                        '<button class="btn btn-sm btn-ghost-danger" data-al-archive="' + t.id + '">Archive</button></div>';
                }).join("") + "</div>"
                : '<div class="text-secondary text-center py-3">No templates yet.</div>';
            m.el.querySelectorAll("[data-al-edit]").forEach(function (b) {
                b.addEventListener("click", function () {
                    var t = list.find(function (x) { return x.id === b.dataset.alEdit; });
                    if (t.kind === "PDF") editPdfTemplate(t); else editTemplate(t);
                });
            });
            m.el.querySelectorAll("[data-al-view]").forEach(function (b) {
                b.addEventListener("click", function () { DocFiles.openViewer(list.find(function (x) { return x.id === b.dataset.alView; }).pdf); });
            });
            m.el.querySelectorAll("[data-al-archive]").forEach(function (b) {
                b.addEventListener("click", async function () {
                    var t = list.find(function (x) { return x.id === b.dataset.alArchive; });
                    if (!confirm('Archive "' + t.name + '"? Letters already made from it keep their text.')) return;
                    try { await api("/admin/appointment-letter-templates/" + t.id, "DELETE"); openTemplates(); }
                    catch (e) { m.error(e.message); }
                });
            });
        } catch (e) {
            m.q("[data-al-list]").innerHTML = "";
            m.error(e.message);
        }
    }

    function templateMetaFields(t) {
        return '<div class="row g-2 mb-3">' +
            '<div class="col-md-6"><label class="form-label">Name</label><input class="form-control" data-al-name maxlength="120" value="' + esc(t ? t.name : "") + '" placeholder="e.g. Standard appointment letter"></div>' +
            '<div class="col-md-4"><label class="form-label">For employment type</label><select class="form-select" data-al-type><option value="">Any type</option>' +
            EMPLOYMENT_TYPES.map(function (e) { return '<option value="' + e[0] + '"' + (t && t.employmentType === e[0] ? " selected" : "") + ">" + e[1] + "</option>"; }).join("") + "</select></div>" +
            '<div class="col-md-2 d-flex align-items-end"><label class="form-check mb-2"><input type="checkbox" class="form-check-input" data-al-default' + (t && t.isDefault ? " checked" : "") + '><span class="form-check-label">Default</span></label></div>' +
            "</div>";
    }

    function readTemplateMeta(m) {
        return {
            name: m.q("[data-al-name]").value.trim(),
            employmentType: m.q("[data-al-type]").value || null,
            isDefault: m.q("[data-al-default]").checked,
        };
    }

    async function editTemplate(t) {
        var list = await fields().catch(function () { return []; });
        var m = modal(t ? "Edit template" : "New written template",
            templateMetaFields(t) +
            '<div class="row g-3"><div class="col-lg-8"><label class="form-label">Letter</label><textarea data-al-body rows="14"></textarea></div>' +
            '<div class="col-lg-4"><label class="form-label">Fields</label><div class="text-secondary small mb-2">Click to add at the cursor. Each is replaced with the person\'s details.</div>' +
            '<div class="d-flex flex-wrap gap-1">' + list.map(function (f) {
                return '<button type="button" class="btn btn-sm btn-outline-secondary" data-al-field="' + esc(f.key) + '" title="' + esc(f.example) + '">' + esc(f.label) + "</button>";
            }).join("") + "</div></div></div>",
            '<button type="button" class="btn btn-link link-secondary me-auto" data-al-back>Back</button>' +
            '<button type="button" class="btn btn-primary" data-al-save>Save template</button>', "modal-xl");
        var ta = m.q("[data-al-body]");
        var quill = RichTextEditor.attach(ta, { minHeight: 360 });
        ta.value = t ? t.body || "" : "";
        m.el.querySelectorAll("[data-al-field]").forEach(function (b) {
            b.addEventListener("click", function () {
                var range = quill.getSelection(true);
                var at = range ? range.index : quill.getLength() - 1;
                var text = "{{" + b.dataset.alField + "}}";
                quill.insertText(at, text, "user");
                quill.setSelection(at + text.length, 0, "user"); // the next field goes after this one
            });
        });
        m.q("[data-al-back]").addEventListener("click", openTemplates);
        m.q("[data-al-save]").addEventListener("click", function () {
            var meta = readTemplateMeta(m);
            if (!meta.name) return m.error("Give the template a name.");
            if (!ta.value) return m.error("Write the letter.");
            meta.body = ta.value;
            busy(this, "Saving…", async function () {
                try {
                    await api("/admin/appointment-letter-templates" + (t ? "/" + t.id : ""), t ? "PATCH" : "POST", meta);
                    openTemplates();
                } catch (e) { m.error(e.message); }
            });
        });
    }

    function editPdfTemplate(t) {
        var upload = null;
        var m = modal(t ? "Edit PDF template" : "Upload a PDF template",
            templateMetaFields(t) +
            '<div class="mb-2"><label class="form-label">PDF</label>' +
            '<div class="d-flex align-items-center gap-2 flex-wrap"><button type="button" class="btn btn-outline-secondary" data-al-choose>' + (t ? "Replace PDF" : "Choose PDF") + '</button><span class="text-secondary small" data-al-file>' +
            (t && t.pdf ? esc(t.pdf.fileName) : "No file chosen") + "</span></div>" +
            '<div class="form-hint">Used exactly as uploaded: details are not filled in. Use a written template for personalised letters.</div></div>',
            '<button type="button" class="btn btn-link link-secondary me-auto" data-al-back>Back</button>' +
            '<button type="button" class="btn btn-primary" data-al-save>Save template</button>', "modal-lg");
        var fileEl = m.q("[data-al-file]");
        m.q("[data-al-choose]").addEventListener("click", function () {
            m.error("");
            chooseAndUpload(".pdf,application/pdf", function (p) { fileEl.textContent = "Uploading… " + p + "%"; })
                .then(function (doc) { if (doc) { upload = doc; fileEl.textContent = doc.fileName + " (uploaded)"; } })
                .catch(function (e) { fileEl.textContent = "No file chosen"; m.error(e.message); });
        });
        m.q("[data-al-back]").addEventListener("click", openTemplates);
        m.q("[data-al-save]").addEventListener("click", function () {
            var meta = readTemplateMeta(m);
            if (!meta.name) return m.error("Give the template a name.");
            if (!t && !upload) return m.error("Choose the PDF.");
            if (upload) meta.documentId = upload.id;
            busy(this, "Saving…", async function () {
                try {
                    await api("/admin/appointment-letter-templates" + (t ? "/" + t.id : ""), t ? "PATCH" : "POST", meta);
                    openTemplates();
                } catch (e) { m.error(e.message); }
            });
        });
    }

    // -- Letter block ---------------------------------------------------------------

    function letterCard(l, ctx) {
        var st = STATUS[l.status] || [l.status, "bg-secondary-lt"];
        var w = ctx.canWrite;
        var btn = function (act, label, cls) { return '<button type="button" class="btn btn-sm ' + (cls || "btn-outline-secondary") + '" data-al-act="' + act + '" data-al-id="' + l.id + '">' + label + "</button>"; };
        var actions = [];
        if (l.status === "DRAFT") {
            if (l.source === "TEMPLATE") {
                if (w) actions.push(btn("edit", "Edit letter", "btn-outline-primary"));
                actions.push(btn("view", "Preview PDF"));
            } else {
                actions.push(btn("view", "View PDF"));
            }
            if (w) {
                actions.push(btn("details", l.source === "TEMPLATE" ? "Change details" : "Fill from a template"));
                actions.push(btn("upload", "Upload a PDF instead"));
                actions.push(btn("approve", "Approve", "btn-success"));
                actions.push(btn("delete", "Delete", "btn-ghost-danger"));
            }
        } else {
            actions.push(btn("view", "View PDF"));
            actions.push(btn("print", "Print"));
            if (l.pdf) actions.push('<a class="btn btn-sm btn-outline-secondary" href="' + esc(l.pdf.downloadUrl) + '">Download</a>');
            if (l.signedCopy) actions.push(btn("signed-view", "View signed copy", "btn-outline-success"));
            if (w && (l.status === "APPROVED" || l.status === "SENT")) actions.push(btn("send", l.status === "SENT" ? "Send again" : "Send by email", "btn-primary"));
            if (w) actions.push(btn("signed", l.signedCopy ? "Replace signed copy" : "Upload signed copy", l.status === "SIGNED" ? "btn-outline-secondary" : "btn-outline-success"));
            if (w && l.status !== "SIGNED") actions.push(btn("reopen", "Reopen", "btn-ghost-secondary"));
        }
        var facts = [
            ["Role", esc(l.role)],
            ["Branch", esc(l.branch ? l.branch.name : "-")],
            ["Type", esc(typeLabel(l.employmentType))],
            ["Starts", esc(dateText(l.startDate))],
            ["Basic salary", esc(money(l.baseSalary))],
            ["Allowances", esc(l.allowances ? money(l.allowances) : "-")],
        ];
        var notes = [];
        if (l.source === "UPLOADED") notes.push("Uploaded PDF");
        if (l.template) notes.push("Template: " + esc(l.template.name));
        if (l.approvedAt) notes.push("Approved " + esc(dateText(l.approvedAt)));
        if (l.sentAt) notes.push("Sent " + esc(dateText(l.sentAt)) + (l.sentCount > 1 ? " (" + l.sentCount + " times)" : "") + " to " + esc(l.recipientEmail || ""));
        if (l.signedAt) notes.push("Signed copy " + esc(dateText(l.signedAt)));
        return '<div class="border rounded p-3 mb-2" data-al-letter="' + l.id + '">' +
            '<div class="d-flex align-items-center gap-2 mb-2"><span class="badge ' + st[1] + '">' + st[0] + "</span>" +
            (ctx.kind === "staff" ? '<span class="text-secondary small">' + esc(l.role) + "</span>" : "") + "</div>" +
            (l.unfilledFields && l.unfilledFields.length
                ? '<div class="alert alert-warning py-2 small">Still to fill in: ' + l.unfilledFields.map(function (f) { return "{{" + esc(f) + "}}"; }).join(", ") + "</div>" : "") +
            '<div class="row g-1 small mb-2">' + facts.map(function (f) {
                return '<div class="col-6"><span class="text-secondary">' + f[0] + ":</span> " + f[1] + "</div>";
            }).join("") + "</div>" +
            (notes.length ? '<div class="text-secondary small mb-2">' + notes.join(" &middot; ") + "</div>" : "") +
            '<div class="d-flex flex-wrap gap-1">' + actions.join("") + "</div>" +
            '<div class="small mt-2 d-none" data-al-msg></div></div>';
    }

    function mountApplication(el, ctx) {
        ctx.kind = "application";
        ctx.base = "/admin/applications/" + ctx.applicationId + "/appointment-letter";
        return render(el, ctx);
    }

    function mountStaff(el, ctx) {
        ctx.kind = "staff";
        ctx.base = "/admin/staff/" + ctx.staffId + "/appointment-letters";
        return render(el, ctx);
    }

    async function render(el, ctx) {
        el.innerHTML = '<div class="text-secondary small"><span class="spinner-border spinner-border-sm me-1"></span>Loading appointment letter…</div>';
        var letters;
        try {
            var data = await api(ctx.base);
            letters = ctx.kind === "application" ? (data ? [data] : []) : (data || []);
        } catch (e) {
            el.innerHTML = '<div class="text-danger small">' + esc(e.message) + "</div>";
            return;
        }
        if (ctx.kind === "application") statusCache[ctx.applicationId] = letters[0] ? letters[0].status : null;
        var hasDraft = letters.some(function (l) { return l.status === "DRAFT"; });
        var head = '<div class="d-flex align-items-center justify-content-between mb-2"><div class="fw-semibold">Appointment letter' + (ctx.kind === "staff" ? "s" : "") + "</div>" +
            (ctx.canWrite && (ctx.kind === "staff" ? !hasDraft : !letters.length)
                ? '<button type="button" class="btn btn-sm btn-primary" data-al-new>' + (ctx.kind === "staff" && letters.length ? "New letter" : "Prepare letter") + "</button>" : "") +
            "</div>";
        el.innerHTML = head + (letters.length
            ? letters.map(function (l) { return letterCard(l, ctx); }).join("")
            : '<div class="text-secondary small mb-2">' + (ctx.kind === "application"
                ? "The offer is accepted. Prepare the appointment letter from a template, approve it, then send it."
                : "No appointment letter yet.") + "</div>");
        var newBtn = el.querySelector("[data-al-new]");
        if (newBtn) newBtn.addEventListener("click", function () { openDetails(el, ctx, null); });
        el.querySelectorAll("[data-al-act]").forEach(function (b) {
            b.addEventListener("click", function () {
                var l = letters.find(function (x) { return x.id === b.dataset.alId; });
                act(el, ctx, l, b.dataset.alAct, b);
            });
        });
        if (ctx.onChange) ctx.onChange(letters);
    }

    function cardMsg(el, letterId, text, isError) {
        var m = el.querySelector('[data-al-letter="' + letterId + '"] [data-al-msg]');
        if (!m) return;
        m.className = "small mt-2 " + (isError ? "text-danger" : "text-secondary");
        m.textContent = text || "";
        if (!text) m.classList.add("d-none");
    }

    async function act(el, ctx, l, action, b) {
        cardMsg(el, l.id, "");
        try {
            if (action === "view") return await busy(b, "Opening…", function () { return viewPdf(l); });
            if (action === "print") return await busy(b, "Preparing…", function () { return printPdf(l); });
            if (action === "signed-view") return DocFiles.openViewer(l.signedCopy);
            if (action === "edit") return openEditor(el, ctx, l);
            if (action === "details") return openDetails(el, ctx, l);
            if (action === "upload" || action === "signed") {
                var signed = action === "signed";
                var doc = await chooseAndUpload(signed ? ".pdf,.jpg,.jpeg,.png" : ".pdf,application/pdf", function (p) { cardMsg(el, l.id, "Uploading… " + p + "%"); });
                if (!doc) return cardMsg(el, l.id, "");
                cardMsg(el, l.id, "Saving…");
                await api("/admin/appointment-letters/" + l.id + (signed ? "/signed" : "/upload"), "POST", { documentId: doc.id });
                return render(el, ctx);
            }
            if (action === "approve") {
                if (!confirm("Approve this letter? The final PDF is made now. You can reopen it later if something needs to change.")) return;
                await busy(b, "Approving…", function () { return api("/admin/appointment-letters/" + l.id + "/approve", "POST"); });
                return render(el, ctx);
            }
            if (action === "send") {
                if (!l.recipientEmail) throw new Error("There is no email address for this person.");
                if (!confirm("Email the letter to " + l.recipientEmail + " as a PDF attachment?")) return;
                await busy(b, "Sending…", function () { return api("/admin/appointment-letters/" + l.id + "/send", "POST"); });
                return render(el, ctx);
            }
            if (action === "reopen") {
                if (!confirm("Reopen this letter as a draft? Its PDF is made again when you approve it.")) return;
                await busy(b, "Reopening…", function () { return api("/admin/appointment-letters/" + l.id + "/reopen", "POST"); });
                return render(el, ctx);
            }
            if (action === "delete") {
                if (!confirm("Delete this draft letter?")) return;
                await busy(b, "Deleting…", function () { return api("/admin/appointment-letters/" + l.id, "DELETE"); });
                return render(el, ctx);
            }
        } catch (e) {
            cardMsg(el, l.id, e.message, true);
        }
    }

    /** Template, employment type, branch and start date (plus role and pay for existing staff). */
    async function openDetails(el, ctx, l) {
        var m = modal(l ? "Letter details" : "Prepare appointment letter",
            '<div class="text-center py-3"><div class="spinner-border text-primary"></div></div>', null, "modal-lg");
        var templates, branches;
        try {
            var r = await Promise.all([api("/admin/appointment-letter-templates"), ctx.getBranches ? ctx.getBranches() : []]);
            templates = r[0];
            branches = Array.isArray(r[1]) ? r[1] : (r[1] && r[1].data) || [];
        } catch (e) { return m.error(e.message); }
        if (!templates.length) {
            m.q(".modal-body").innerHTML = '<div class="alert alert-warning">There are no letter templates yet. Add one first.</div>';
            m.q(".modal-footer").innerHTML = '<button type="button" class="btn btn-link link-secondary me-auto" data-bs-dismiss="modal">Close</button><button type="button" class="btn btn-primary" data-al-tpl>Letter templates</button>';
            m.q("[data-al-tpl]").addEventListener("click", openTemplates);
            return;
        }
        var d = ctx.defaults || {};
        var cur = {
            templateId: l ? l.templateId : "",
            employmentType: l ? l.employmentType : (d.employmentType || "FULL_TIME"),
            branchId: l ? l.branchId : (d.branchId || ""),
            startDate: l ? dateInput(l.startDate) : dateInput(d.startDate),
            role: l ? l.role : (d.role || ""),
            baseSalary: l ? l.baseSalary : d.baseSalary,
            allowances: l ? l.allowances : d.allowances,
        };
        var staff = ctx.kind === "staff";
        m.q(".modal-body").innerHTML = '<div class="alert alert-danger d-none" data-al-error></div>' +
            '<div class="row g-3">' +
            '<div class="col-md-6"><label class="form-label">Employment type</label><select class="form-select" data-al-etype>' +
            EMPLOYMENT_TYPES.map(function (e) { return '<option value="' + e[0] + '"' + (cur.employmentType === e[0] ? " selected" : "") + ">" + e[1] + "</option>"; }).join("") + "</select></div>" +
            '<div class="col-md-6"><label class="form-label">Template</label><select class="form-select" data-al-template><option value="">Default for the employment type</option>' +
            templates.map(function (t) { return '<option value="' + t.id + '"' + (cur.templateId === t.id ? " selected" : "") + ">" + esc(t.name) + (t.kind === "PDF" ? " (PDF)" : "") + "</option>"; }).join("") + "</select></div>" +
            (staff ? '<div class="col-md-6"><label class="form-label">Role</label><input class="form-control" data-al-role maxlength="120" value="' + esc(cur.role) + '"></div>' : "") +
            '<div class="col-md-6"><label class="form-label">Branch</label><select class="form-select" data-al-branch><option value="">Not stated</option>' +
            branches.map(function (b) { return '<option value="' + b.id + '"' + (cur.branchId === b.id ? " selected" : "") + ">" + esc(b.name) + "</option>"; }).join("") + "</select></div>" +
            '<div class="col-md-6"><label class="form-label">Start date</label><input type="date" class="form-control" data-al-start value="' + esc(cur.startDate) + '"></div>' +
            (staff
                ? '<div class="col-md-6"><label class="form-label">Basic salary (₦ per month)</label><input type="number" min="0" class="form-control" data-al-base value="' + esc(cur.baseSalary == null ? "" : cur.baseSalary) + '"></div>' +
                '<div class="col-md-6"><label class="form-label">Allowances (₦ per month)</label><input type="number" min="0" class="form-control" data-al-allow value="' + esc(cur.allowances == null ? "" : cur.allowances) + '"></div>'
                : '<div class="col-12 text-secondary small">Role and pay come from the accepted offer.</div>') +
            "</div>" +
            (l && l.source === "TEMPLATE" ? '<div class="alert alert-info small mt-3 mb-0">This fills the letter in again from the template, replacing any edits made to its text.</div>' : "");
        m.q(".modal-footer").innerHTML = '<button type="button" class="btn btn-link link-secondary me-auto" data-bs-dismiss="modal">Cancel</button>' +
            '<button type="button" class="btn btn-primary" data-al-go>' + (l ? "Fill in again" : "Prepare letter") + "</button>";
        m.q("[data-al-go]").addEventListener("click", function () {
            var body = {
                employmentType: m.q("[data-al-etype]").value,
                branchId: m.q("[data-al-branch]").value || null,
            };
            var tpl = m.q("[data-al-template]").value;
            if (tpl) body.templateId = tpl;
            var start = m.q("[data-al-start]").value;
            if (start) body.startDate = start;
            if (staff) {
                var role = m.q("[data-al-role]").value.trim();
                if (!role) return m.error("Enter the role.");
                body.role = role;
                var base = m.q("[data-al-base]").value, allow = m.q("[data-al-allow]").value;
                body.baseSalary = base === "" ? null : Number(base);
                body.allowances = allow === "" ? null : Number(allow);
            }
            busy(this, "Preparing…", async function () {
                try {
                    var letter = await api(ctx.base, "POST", body);
                    m.hide();
                    await render(el, ctx);
                    if (letter.source === "TEMPLATE") setTimeout(function () { openEditor(el, ctx, letter); }, 350);
                } catch (e) { m.error(e.message); }
            });
        });
    }

    /** The letter text, editable while it is a draft. */
    function openEditor(el, ctx, l) {
        var m = modal("Edit appointment letter: " + l.recipientName,
            '<div class="text-secondary small mb-2">Details are already filled in. Change anything you need, then save and approve.</div>' +
            '<textarea data-al-text rows="16"></textarea>',
            '<button type="button" class="btn btn-link link-secondary me-auto" data-bs-dismiss="modal">Cancel</button>' +
            '<button type="button" class="btn btn-outline-secondary" data-al-preview>Save &amp; preview</button>' +
            '<button type="button" class="btn btn-primary" data-al-save>Save</button>', "modal-xl");
        var ta = m.q("[data-al-text]");
        RichTextEditor.attach(ta, { minHeight: 420 });
        ta.value = l.body || "";
        async function save() {
            if (!ta.value) throw new Error("The letter cannot be empty.");
            return api("/admin/appointment-letters/" + l.id, "PATCH", { body: ta.value });
        }
        m.q("[data-al-save]").addEventListener("click", function () {
            busy(this, "Saving…", async function () {
                try { await save(); m.hide(); render(el, ctx); } catch (e) { m.error(e.message); }
            });
        });
        m.q("[data-al-preview]").addEventListener("click", function () {
            busy(this, "Saving…", async function () {
                try { var saved = await save(); await viewPdf(saved); render(el, ctx); } catch (e) { m.error(e.message); }
            });
        });
    }

    return {
        mountApplication: mountApplication,
        mountStaff: mountStaff,
        openTemplates: openTemplates,
        statusFor: function (applicationId) { return statusCache[applicationId] || null; },
    };
})();
window.AppointmentLetters = AppointmentLetters;
