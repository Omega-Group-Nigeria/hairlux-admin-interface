/**
 * Company Documents API helper (admin) — /admin/company-documents
 * Depends on auth.js (Auth.fetch) being loaded first.
 */
const StaffDocuments = (() => {
    const PERMISSIONS = {
        READ: "staff:read",
        MANAGE: "staff:manage_documents",
    };

    async function jsonFetch(path, options = {}) {
        const res = await Auth.fetch(path, options);
        const raw = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(raw.message || `Request failed (${res.status})`);
        return raw.data !== undefined ? raw.data : raw;
    }

    async function getActiveDocuments() {
        return jsonFetch("/admin/company-documents");
    }

    async function createDocument(payload) {
        return jsonFetch("/admin/company-documents", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
    }

    /**
     * Uploads the actual PDF file, returns { contentUrl }. Call before
     * createDocument(). Deliberately bypasses Auth.fetch/jsonFetch here --
     * that wrapper unconditionally sets Content-Type: application/json with
     * no way to opt out, which breaks multipart/form-data uploads (the
     * browser needs to set its own Content-Type including the boundary).
     * Replicates Auth's own base-URL + bearer-token handling manually instead.
     */
    async function uploadFile(file) {
        const base = (window.API_BASE || "").replace(/\/$/, "");
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch(base + "/admin/company-documents/upload", {
            method: "POST",
            headers: { Authorization: "Bearer " + Auth.getToken() },
            body: formData,
        });
        const raw = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(raw.message || `Upload failed (${res.status})`);
        return raw.data !== undefined ? raw.data : raw;
    }

    async function getDocumentTypes(activeOnly) {
        return jsonFetch("/admin/document-types" + (activeOnly ? "?activeOnly=true" : ""));
    }

    async function createDocumentType(name) {
        return jsonFetch("/admin/document-types", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: name }),
        });
    }

    async function setDocumentTypeActive(id, isActive) {
        return jsonFetch("/admin/document-types/" + id + "/active", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ isActive: isActive }),
        });
    }

    async function removeDocumentType(id) {
        return jsonFetch("/admin/document-types/" + id, { method: "DELETE" });
    }

    async function removeDocument(id) {
        return jsonFetch("/admin/company-documents/" + id, { method: "DELETE" });
    }

    function formatDate(value) {
        if (!value) return "-";
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return String(value);
        return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    }

    return {
        PERMISSIONS,
        getActiveDocuments,
        createDocument,
        uploadFile,
        getDocumentTypes,
        createDocumentType,
        setDocumentTypeActive,
        removeDocumentType,
        removeDocument,
        formatDate,
    };
})();