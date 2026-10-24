// Runs synchronously BEFORE any analytics/ads scripts on a Stripe return.
// Keep the checkout capability out of URLs sent to third parties. It lives only
// in this tab's memory/sessionStorage, never in analytics or localStorage.
(function () {
  if (window.location.pathname !== '/checkout/success') return;
  var params = new URLSearchParams(window.location.search);
  var orderId = params.get('order');
  if (!/^[a-f0-9-]{36}$/i.test(orderId || '')) orderId = null;
  var clientSecret = params.get('payment_intent_client_secret');
  if (orderId && clientSecret) {
    var payment = { orderId: orderId, clientSecret: clientSecret, savedAt: Date.now() };
    try {
      var previous = JSON.parse(window.sessionStorage.getItem('ktodd-checkout-payment'));
      if (previous && previous.orderId === orderId && previous.clientSecret === clientSecret) {
        payment.cartSignature = previous.cartSignature;
        payment.cartCleared = previous.cartCleared;
      }
    } catch (_) {}
    window.__checkoutPayment = payment;
    try { window.sessionStorage.setItem('ktodd-checkout-payment', JSON.stringify(payment)); } catch (_) {}
  }
  // Retain only the opaque order ID. Do not trust redirect_status as payment proof.
  var clean = window.location.pathname + (orderId ? '?order=' + encodeURIComponent(orderId) : '');
  window.history.replaceState(window.history.state, '', clean);
}());
