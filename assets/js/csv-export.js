/**
 * Reusable CSV export utility. Each caller defines its own column set via
 * { label, get } so formatting (dates, nested fields like branch.name,
 * money) lives with the page that knows the shape of its data, not here.
 *
 * Usage:
 *   CsvExport.download('transactions.csv',
 *     [
 *       { label: 'Date', get: (row) => new Date(row.createdAt).toLocaleDateString() },
 *       { label: 'Branch', get: (row) => row.branch ? row.branch.name : '' },
 *       { label: 'Amount', get: (row) => row.amount },
 *     ],
 *     rows
 *   );
 */
const CsvExport = (function () {
    function escapeCell(value) {
        var s = value == null ? '' : String(value);
        // Quote and escape whenever the value could otherwise be
        // misread — a comma, a quote, or a newline inside the cell.
        if (/[",\n\r]/.test(s)) {
            s = '"' + s.replace(/"/g, '""') + '"';
        }
        return s;
    }

    function toCsv(columns, rows) {
        var lines = [columns.map(function (c) { return escapeCell(c.label); }).join(',')];
        rows.forEach(function (row) {
            lines.push(columns.map(function (c) { return escapeCell(c.get(row)); }).join(','));
        });
        // \r\n line endings and a UTF-8 BOM: Excel (still the most common
        // opener for a downloaded CSV) mis-renders naira signs and other
        // non-ASCII characters without the BOM, and is inconsistent about
        // bare \n.
        return '\uFEFF' + lines.join('\r\n');
    }

    /**
     * Builds the CSV client-side and triggers a browser download. If no
     * rows are given (e.g. a failed or empty fetch), does nothing rather
     * than download an empty/misleading file — the caller should already
     * have shown its own "nothing to export" message.
     */
    function download(filename, columns, rows) {
        if (!rows || !rows.length) return;
        var csv = toCsv(columns, rows);
        var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        var url = URL.createObjectURL(blob);
        var link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    return { download: download };
})();