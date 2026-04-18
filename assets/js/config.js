/**
 * config.js — Hairlux Admin
 * Global configuration loaded before all other scripts.
 * Add this file to .gitignore and commit config.example.js instead.
 */

// API base URL (no trailing slash)
window.API_BASE = "https://hairlux-api.up.railway.app";
// window.API_BASE = "http://localhost:3000"; // local

(function setupBackdropCleanup() {
	function removeAll(selector) {
		document.querySelectorAll(selector).forEach(function (el) {
			if (el && el.parentNode) el.parentNode.removeChild(el);
		});
	}

	function cleanupBackdrops() {
		var shownModalCount = document.querySelectorAll('.modal.show').length;
		var shownOffcanvasCount = document.querySelectorAll('.offcanvas.show').length;

		if (shownModalCount === 0) {
			removeAll('.modal-backdrop');
			document.body.classList.remove('modal-open');
			document.body.style.removeProperty('padding-right');
		}

		if (shownOffcanvasCount === 0) {
			removeAll('.offcanvas-backdrop');
		}

		if (shownModalCount === 0 && shownOffcanvasCount === 0) {
			document.body.style.removeProperty('overflow');
		}
	}

	function queueCleanup() {
		window.setTimeout(cleanupBackdrops, 0);
	}

	document.addEventListener('hidden.bs.modal', queueCleanup);
	document.addEventListener('hidden.bs.offcanvas', queueCleanup);

	// Expose for manual emergency cleanup from page scripts when needed.
	window.HairluxCleanupBackdrops = cleanupBackdrops;
}());

// Optional: set token directly instead of reading from localStorage
// window.AUTH_TOKEN = "your-token-here";
