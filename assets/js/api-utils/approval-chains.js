/**
 * Approval Chains API helper — /admin/approval-chains
 * Requires: auth.js (Auth.fetch)
 */
const ApprovalChains = (function () {
    async function apiFetch(path, options = {}) {
        const res = await Auth.fetch(path, options);
        const raw = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(raw.message || `Request failed (${res.status})`);
        return raw.data !== undefined ? raw.data : raw;
    }

    async function getAll() {
        return apiFetch('/admin/approval-chains');
    }

    async function getOne(requestType) {
        return apiFetch(`/admin/approval-chains/${requestType}`);
    }

    /** roleIds order IS the stage order -- position 0 becomes stage 1, etc. Empty array removes the chain entirely. */
    async function set(requestType, roleIds) {
        return apiFetch('/admin/approval-chains', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                requestType,
                stages: roleIds.map(function (approverRoleId) { return { approverRoleId: approverRoleId }; }),
            }),
        });
    }

    return { getAll, getOne, set };
})();