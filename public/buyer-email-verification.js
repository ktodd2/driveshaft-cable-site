// Before third-party scripts: fragments never enter analytics, URLs or referrers.
(function(){
 if(!/^\/checkout\/verify-email\/?$/.test(window.location.pathname))return;
 window.__buyerEmailVerificationToken=window.location.hash.slice(1);
 window.history.replaceState(null,'',window.location.pathname);
 var meta=document.createElement('meta');meta.name='referrer';meta.content='no-referrer';document.head.appendChild(meta);
})();
