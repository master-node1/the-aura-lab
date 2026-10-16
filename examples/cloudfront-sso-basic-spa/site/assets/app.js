'use strict';

// Minimal history-API router. Deep links (/about, /diagnostics) only work if the
// module's CloudFront distribution falls back to /index.html for unknown paths.

const routes = {
  '/': renderHome,
  '/about': renderAbout,
  '/diagnostics': renderDiagnostics,
};

function el(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function row(table, label, value, className) {
  const tr = el('tr');
  tr.append(el('th', label));
  const td = el('td');
  td.append(el('code', value, className));
  tr.append(td);
  table.append(tr);
}

function renderHome(view) {
  view.append(
    el('h1', 'You are signed in'),
    el('p', 'If you can read this, CloudFront let the request through the Entra ID SSO check and served index.html from S3.'),
    el('p', 'Use the navigation to test client-side routing, then reload on a sub-page to test deep links.'),
  );
}

function renderAbout(view) {
  view.append(
    el('h1', 'About'),
    el('p', 'This is a static test page for the terraform-module-cloudfront-sso module.'),
    el('p', 'Reload this page (Ctrl/Cmd+R). If it still renders, the SPA fallback to index.html works.'),
  );
}

function renderDiagnostics(view) {
  view.append(el('h1', 'Diagnostics'));
  const table = el('table');
  view.append(table);

  row(table, 'Location', window.location.href);
  row(table, 'Origin', window.location.origin);
  row(table, 'Rendered at', new Date().toISOString());
  row(table, 'Script loaded (CSP allows self)', 'yes', 'pass');
  // Session cookies should be HttpOnly, so JS must NOT see them.
  row(table, 'Cookies visible to JS', document.cookie ? document.cookie.split(';').map((c) => c.split('=')[0].trim()).join(', ') : '(none — good, session cookie is HttpOnly)');

  fetch('/version.json', { cache: 'no-store', credentials: 'same-origin' })
    .then((res) => {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    })
    .then((data) => row(table, 'Deployed version', String(data.version), 'pass'))
    .catch((err) => row(table, 'Deployed version', 'fetch failed: ' + err.message, 'fail'));
}

function renderNotFound(view) {
  view.append(el('h1', 'Not found'), el('p', 'No client route for ' + window.location.pathname));
}

function render() {
  const view = document.getElementById('view');
  view.replaceChildren();
  const path = window.location.pathname.replace(/\/index\.html$/, '/').replace(/(.)\/$/, '$1');
  (routes[path] || renderNotFound)(view);

  document.querySelectorAll('a[data-link]').forEach((a) => {
    if (a.getAttribute('href') === path) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
}

document.addEventListener('click', (event) => {
  const link = event.target.closest('a[data-link]');
  if (!link || event.metaKey || event.ctrlKey || event.shiftKey) return;
  event.preventDefault();
  history.pushState(null, '', link.getAttribute('href'));
  render();
});

window.addEventListener('popstate', render);
document.addEventListener('DOMContentLoaded', render);
