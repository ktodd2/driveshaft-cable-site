// Runs synchronously before any third-party script. Keep bearer invitations out of analytics and referrers.
(function () {
 if (!/^\/referral\/signup\/?$/.test(window.location.pathname)) return;
 window.__referralInviteToken = window.location.hash.slice(1);
 window.history.replaceState(null, '', window.location.pathname);
 var meta = document.createElement('meta');
 meta.name = 'referrer'; meta.content = 'no-referrer'; document.head.appendChild(meta);
})();
