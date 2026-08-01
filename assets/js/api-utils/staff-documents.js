/**
 * Company Documents API helper (admin) — /admin/company-documents
 * Depends on auth.js (Auth.fetch) being loaded first.
 */
const StaffDocuments = (() => {
    const PERMISSIONS = {
        READ:   "staff:read",
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

    const DOCUMENT_TYPES = [
        { value: "EMPLOYMENT_CONTRACT",      label: "Employment Contract" },
        { value: "NDA",                      label: "Confidentiality Agreement (NDA)" },
        { value: "IT_ACCEPTABLE_USE_POLICY", label: "IT & Acceptable Use Policy" },
        { value: "STAFF_HANDBOOK",           label: "Staff Handbook" },
        { value: "CODE_OF_CONDUCT",          label: "Code of Conduct" },
        { value: "DATA_PROTECTION_POLICY",   label: "Data Protection & Privacy Policy" },
    ];

    function typeLabel(type) {
        const found = DOCUMENT_TYPES.find(function (t) { return t.value === type; });
        return found ? found.label : type;
    }

    function formatDate(value) {
        if (!value) return "-";
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return String(value);
        return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    }

    return {
        PERMISSIONS,
        DOCUMENT_TYPES,
        getActiveDocuments,
        createDocument,
        uploadFile,
        typeLabel,
        formatDate,
    };
})();