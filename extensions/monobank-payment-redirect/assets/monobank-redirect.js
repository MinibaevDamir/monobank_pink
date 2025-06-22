(function() {
    if (typeof Shopify === 'object' && Shopify.checkout && Shopify.checkout.order_id) {
  
      const orderId = Shopify.checkout.order_id.toString();
      const paymentDue = parseFloat(Shopify.checkout.payment_due) || 0;
      
      const redirectAttemptedKey = `redirect_attempted_mono_${orderId}`;
  
      if (paymentDue > 0 && !sessionStorage.getItem(redirectAttemptedKey)) {
        
        sessionStorage.setItem(redirectAttemptedKey, 'true');
        
        const appBaseUrl = 'https://monobank-integration.fly.dev';
        const paymentLinkEndpoint = `${appBaseUrl}/api/get-payment-link/${orderId}`;
  
        function fetchPaymentLink(retries = 5, delay = 1500) {
          fetch(paymentLinkEndpoint)
            .then(response => {
              if (response.ok) {
                return response.json();
              }

              if (response.status >= 400 && retries > 0) {
                console.log(`[Monobank App] Link not ready (Status: ${response.status}). Retrying...`);
                setTimeout(() => fetchPaymentLink(retries - 1, delay), delay);
                return Promise.reject('Retrying...'); 
              }
              throw new Error(`Failed to fetch payment link. Final status: ${response.status}`);
            })
            .then(data => {
              if (data && data.paymentUrl) {
                console.log('[Monobank App] Payment link received. Redirecting now.');
                window.location.href = data.paymentUrl;
              }
            })
            .catch(error => {
              if (error !== 'Retrying...') {
                console.error(`[Monobank App] Could not retrieve payment link for order ${orderId}.`, error);
              }
            });
        }
  
        fetchPaymentLink();
      }
    }
  })();