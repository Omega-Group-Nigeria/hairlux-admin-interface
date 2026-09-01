/**
 * Payroll API helper (staff self-service) — /staff/me/payroll
 * Requires: auth.js (Auth.fetch)
 */
const PayrollSelf = (function () {
    async function jsonFetch(path, options) {
        const res = await Auth.fetch(path, options);
        const raw = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(raw.message || 'Request failed');
        return raw.data !== undefined ? raw.data : raw;
    }

    async function listBanks() {
        return jsonFetch('/staff/me/payroll/banks');
    }

    async function getBankAccount() {
        return jsonFetch('/staff/me/payroll/bank-account');
    }

    async function resolveAccount(bankCode, accountNumber) {
        return jsonFetch('/staff/me/payroll/bank-account/resolve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bankCode, accountNumber }),
        });
    }

    async function submitBankAccount(payload) {
        return jsonFetch('/staff/me/payroll/bank-account', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
    }

    async function getCompensation() {
        return jsonFetch('/staff/me/payroll/compensation');
    }

    async function getCurrentFines(range) {
        var qs = (range && range.periodStart && range.periodEnd)
            ? '?periodStart=' + encodeURIComponent(range.periodStart) + '&periodEnd=' + encodeURIComponent(range.periodEnd)
            : '';
        return jsonFetch('/staff/me/payroll/current-fines' + qs);
    }

    async function getPayslips() {
        return jsonFetch('/staff/me/payroll/payslips');
    }

    async function getPayslipDetail(id) {
        return jsonFetch('/staff/me/payroll/payslips/' + id);
    }

    async function downloadPayslip(id) {
        const res = await Auth.fetch('/staff/me/payroll/payslips/' + id + '.pdf');
        if (!res.ok) throw new Error('Failed to generate payslip');
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'payslip-' + id + '.pdf';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    }

    async function getAdjustments() {
        return jsonFetch('/staff/me/payroll/adjustments');
    }

    async function getWallet() {
        return jsonFetch('/staff/me/payroll/wallet');
    }

    async function requestWithdrawal(amount) {
        return jsonFetch('/staff/me/payroll/withdrawals', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount }),
        });
    }

    async function listWithdrawals() {
        return jsonFetch('/staff/me/payroll/withdrawals');
    }

    return {
        listBanks, getBankAccount, resolveAccount, submitBankAccount,
        getCompensation, getCurrentFines, getPayslips, getPayslipDetail, downloadPayslip, getAdjustments,
        getWallet, requestWithdrawal, listWithdrawals,
    };
})();