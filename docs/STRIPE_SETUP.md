# Stripe Setup Guide

This guide walks you through integrating Stripe payments for the K.Todd Driveshaft Cable e-commerce site.

## 1. Create a Stripe Account

1. Go to [stripe.com](https://stripe.com) and sign up
2. Complete your account verification (you can use test mode while setting up)

## 2. Get Your API Keys

1. In Stripe Dashboard, go to **Developers** → **API keys**
2. You'll see two sets of keys - **Test** and **Live**
3. Start with **Test mode** (toggle at the top of the dashboard)

Copy these keys:
- **Publishable key** (starts with `pk_test_...`)
- **Secret key** (starts with `sk_test_...`)

## 3. Add Keys to Your Project

### Frontend (.env file)

```env
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key_here
```

### Backend (Supabase Edge Function secrets)

In Supabase Dashboard → **Edge Functions** → **Secrets**:

```
STRIPE_SECRET_KEY=sk_test_your_secret_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
```

## 4. Install Stripe Packages

```bash
npm install @stripe/stripe-js @stripe/react-stripe-js
```

## 5. Create Supabase Edge Functions

### Create Payment Intent Function

Create file: `supabase/functions/create-payment-intent/index.ts`

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@13.10.0?target=deno'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') as string, {
  apiVersion: '2023-10-16',
})

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { amount, orderId, customerEmail } = await req.json()

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount, // Amount in cents
      currency: 'usd',
      metadata: {
        order_id: orderId,
      },
      receipt_email: customerEmail,
    })

    return new Response(
      JSON.stringify({ clientSecret: paymentIntent.client_secret }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
```

### Create Webhook Handler Function

Create file: `supabase/functions/stripe-webhook/index.ts`

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@13.10.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') as string, {
  apiVersion: '2023-10-16',
})

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') as string,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string
)

serve(async (req) => {
  const signature = req.headers.get('stripe-signature')
  const body = await req.text()

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature!,
      Deno.env.get('STRIPE_WEBHOOK_SECRET')!
    )
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message)
    return new Response(JSON.stringify({ error: 'Invalid signature' }), { status: 400 })
  }

  // Handle the event
  switch (event.type) {
    case 'payment_intent.succeeded': {
      const paymentIntent = event.data.object as Stripe.PaymentIntent
      const orderId = paymentIntent.metadata.order_id

      // Update order status
      await supabase
        .from('orders')
        .update({
          payment_status: 'paid',
          status: 'confirmed',
          stripe_charge_id: paymentIntent.latest_charge,
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderId)

      // TODO: Decrement inventory
      // TODO: Send confirmation email

      console.log(`Order ${orderId} payment succeeded`)
      break
    }

    case 'payment_intent.payment_failed': {
      const paymentIntent = event.data.object as Stripe.PaymentIntent
      const orderId = paymentIntent.metadata.order_id

      await supabase
        .from('orders')
        .update({
          payment_status: 'failed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderId)

      console.log(`Order ${orderId} payment failed`)
      break
    }
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 })
})
```

## 6. Deploy Edge Functions

```bash
# Install Supabase CLI if you haven't
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref your-project-ref

# Deploy functions
supabase functions deploy create-payment-intent
supabase functions deploy stripe-webhook
```

## 7. Set Up Stripe Webhook

1. In Stripe Dashboard, go to **Developers** → **Webhooks**
2. Click **Add endpoint**
3. Enter your endpoint URL:
   ```
   https://your-project.supabase.co/functions/v1/stripe-webhook
   ```
4. Select events to listen for:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
5. Click **Add endpoint**
6. Copy the **Signing secret** (starts with `whsec_`)
7. Add it to your Supabase Edge Function secrets as `STRIPE_WEBHOOK_SECRET`

## 8. Update Checkout Page

Update `src/pages/CheckoutPage.jsx` to use Stripe:

```jsx
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)

function CheckoutForm({ clientSecret, orderId }) {
  const stripe = useStripe()
  const elements = useElements()
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!stripe || !elements) return

    setIsProcessing(true)
    setError(null)

    const { error: submitError } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/checkout/success?order=${orderId}`,
      },
    })

    if (submitError) {
      setError(submitError.message)
      setIsProcessing(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <PaymentElement />
      {error && <div className="text-red-500 mt-4">{error}</div>}
      <button
        type="submit"
        disabled={!stripe || isProcessing}
        className="btn-primary w-full mt-6"
      >
        {isProcessing ? 'Processing...' : 'Pay Now'}
      </button>
    </form>
  )
}

// In your CheckoutPage component:
// 1. Create order in Supabase (status: 'pending')
// 2. Call create-payment-intent Edge Function
// 3. Render Elements with clientSecret

<Elements stripe={stripePromise} options={{ clientSecret }}>
  <CheckoutForm clientSecret={clientSecret} orderId={orderId} />
</Elements>
```

## 9. Test Your Integration

### Test Card Numbers

Use these in **test mode**:

| Card Number | Result |
|-------------|--------|
| `4242 4242 4242 4242` | Success |
| `4000 0000 0000 0002` | Declined |
| `4000 0000 0000 3220` | Requires 3D Secure |

Use any future expiry date and any 3-digit CVC.

### Test Flow

1. Add items to cart
2. Go to checkout
3. Fill in shipping info
4. Enter test card `4242 4242 4242 4242`
5. Complete payment
6. Check Stripe Dashboard → **Payments** to see the charge
7. Check your `orders` table in Supabase - status should be `confirmed`

## 10. Go Live

When ready for production:

1. Complete Stripe account verification
2. Toggle to **Live mode** in Stripe Dashboard
3. Get your **live** API keys
4. Update your environment variables:
   - `.env`: `VITE_STRIPE_PUBLISHABLE_KEY=pk_live_...`
   - Supabase secrets: `STRIPE_SECRET_KEY=sk_live_...`
5. Create a new webhook endpoint for production
6. Update `STRIPE_WEBHOOK_SECRET` with the live signing secret

## Troubleshooting

### "No such payment_intent" error
- Make sure you're using matching test/live keys
- The clientSecret must match the environment

### Webhook not receiving events
- Check the endpoint URL is correct
- Verify the signing secret matches
- Look at **Developers** → **Webhooks** → **Recent events** in Stripe

### Payment succeeds but order not updated
- Check Supabase Edge Function logs
- Verify `SUPABASE_SERVICE_ROLE_KEY` is set in Edge Function secrets
- Make sure the order ID in metadata matches your database

## Security Notes

- Never expose your **secret key** (`sk_...`) in frontend code
- Always verify webhook signatures
- Use HTTPS in production
- Enable Stripe Radar for fraud protection
