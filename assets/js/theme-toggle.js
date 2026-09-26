/**
 * Hairlux Admin - light/dark mode toggle for pages that don't use Tabler's
 * own theme switcher (starting with staff-portal.html).
 *
 * Shares Tabler's storage key ("tabler-theme") and attribute
 * (data-bs-theme on <html>), so one choice carries across every admin page:
 * pick dark here and the Tabler pages open dark too, and vice versa. Like
 * tabler-theme.min.js it also honours a ?theme=dark / ?theme=light URL
 * parameter and defaults to light when nothing has been chosen.
 *
 * Load it as an early, non-deferred <head> script so the theme is set before
 * first paint (no flash of the wrong theme). Any element with
 * [data-theme-toggle] becomes a toggle button.
 */
(function () {
  var STORAGE_KEY = 'tabler-theme';

  function read() {
    try { return localStorage.getItem(STORAGE_KEY); } catch (e) { return null; }
  }

  function save(theme) {
    try { localStorage.setItem(STORAGE_KEY, theme); } catch (e) {}
  }

  function apply(theme) {
    document.documentElement.setAttribute('data-bs-theme', theme === 'dark' ? 'dark' : 'light');
  }

  function current() {
    return document.documentElement.getAttribute('data-bs-theme') === 'dark' ? 'dark' : 'light';
  }

  function syncButtons() {
    var isDark = current() === 'dark';
    var buttons = document.querySelectorAll('[data-theme-toggle]');
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].setAttribute('aria-pressed', isDark ? 'true' : 'false');
      buttons[i].title = isDark ? 'Switch to light mode' : 'Switch to dark mode';
    }
  }

  window.HairluxTheme = {
    current: current,
    set: function (theme) { apply(theme); save(current()); syncButtons(); },
    toggle: function () { window.HairluxTheme.set(current() === 'dark' ? 'light' : 'dark'); }
  };

  // Resolve the starting theme before the rest of the page parses.
  var fromUrl = null;
  try { fromUrl = new URLSearchParams(window.location.search).get('theme'); } catch (e) {}
  if (fromUrl === 'dark' || fromUrl === 'light') save(fromUrl);
  apply(read() === 'dark' ? 'dark' : 'light');

  // Keep other open tabs in step when the theme changes in one of them.
  window.addEventListener('storage', function (e) {
    if (e.key !== STORAGE_KEY) return;
    apply(e.newValue === 'dark' ? 'dark' : 'light');
    syncButtons();
  });

  document.addEventListener('DOMContentLoaded', function () {
    syncButtons();
    var buttons = document.querySelectorAll('[data-theme-toggle]');
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].addEventListener('click', window.HairluxTheme.toggle);
    }
  });
})();
