import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

// ---------------------------------------------------------------------------
// Email templates
// ---------------------------------------------------------------------------

const TEMPLATES = {
  loyalty: {
    label: 'Loyalty Discount',
    description: '10% repeat customer discount reminder',
    subject: 'Your exclusive 10% loyalty discount — K.Todd Driveshaft Cable',
    html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#111111;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#111111;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#1a1a1a;border:1px solid #333;">
          <tr>
            <td style="background-color:#eab308;padding:24px;text-align:center;">
              <h1 style="margin:0;color:#000;font-size:24px;font-weight:bold;letter-spacing:2px;">YOUR EXCLUSIVE 10% DISCOUNT</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="color:#d1d5db;font-size:16px;margin:0 0 16px;">As a returning K.Todd customer, you're eligible for a 10% loyalty discount on every order.</p>
              <p style="color:#d1d5db;font-size:16px;margin:0 0 16px;">It's our way of saying thanks for your continued business. You've trusted us with your fleet — and we don't take that lightly.</p>
              <p style="color:#d1d5db;font-size:16px;margin:0 0 24px;">The discount is applied automatically at checkout — just use the same email address you ordered with before. No codes, no hassle.</p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding-top:16px;">
                    <a href="https://driveshaftcable.com/products" target="_blank" style="display:inline-block;background-color:#eab308;color:#000;font-size:16px;font-weight:bold;text-decoration:none;padding:16px 48px;letter-spacing:1px;">
                      SHOP NOW
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background-color:#111;padding:20px;text-align:center;border-top:1px solid #333;">
              <p style="color:#6b7280;font-size:12px;margin:0;">K.Todd Driveshaft Cable | orders@k-todd.com</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  },

  backInStock: {
    label: 'Back in Stock',
    description: 'Inventory restocked, ready to ship',
    subject: 'Back in stock — K.Todd Driveshaft Cables ready to ship',
    html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#111111;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#111111;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#1a1a1a;border:1px solid #333;">
          <tr>
            <td style="background-color:#eab308;padding:24px;text-align:center;">
              <h1 style="margin:0;color:#000;font-size:24px;font-weight:bold;letter-spacing:2px;">BACK IN STOCK</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="color:#d1d5db;font-size:16px;margin:0 0 16px;">Great news — K.Todd Driveshaft Cables are fully restocked and ready to ship.</p>
              <p style="color:#d1d5db;font-size:16px;margin:0 0 16px;">If you've been waiting to place an order, now is the time. Inventory moves fast, and we want to make sure you're not left without the parts you need.</p>
              <p style="color:#d1d5db;font-size:16px;margin:0 0 24px;">Don't miss out — order now while inventory lasts. Returning customers save 10% automatically at checkout.</p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding-top:16px;">
                    <a href="https://driveshaftcable.com/products" target="_blank" style="display:inline-block;background-color:#eab308;color:#000;font-size:16px;font-weight:bold;text-decoration:none;padding:16px 48px;letter-spacing:1px;">
                      ORDER NOW
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background-color:#111;padding:20px;text-align:center;border-top:1px solid #333;">
              <p style="color:#6b7280;font-size:12px;margin:0;">K.Todd Driveshaft Cable | orders@k-todd.com</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  },

  volumePricing: {
    label: 'Volume Pricing',
    description: 'Tiered pricing breakdown, bulk savings',
    subject: 'Save more when you order more — K.Todd volume pricing',
    html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#111111;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#111111;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#1a1a1a;border:1px solid #333;">
          <tr>
            <td style="background-color:#eab308;padding:24px;text-align:center;">
              <h1 style="margin:0;color:#000;font-size:24px;font-weight:bold;letter-spacing:2px;">SAVE MORE, ORDER MORE</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="color:#d1d5db;font-size:16px;margin:0 0 24px;">The more you order, the more you save. K.Todd volume pricing is built for operators who need reliable parts at scale.</p>
              <table width="100%" cellpadding="8" cellspacing="0" style="border-collapse:collapse;margin-bottom:24px;">
                <tr style="background-color:#333;">
                  <td style="color:#eab308;font-weight:bold;font-size:14px;padding:10px 12px;">Quantity</td>
                  <td style="color:#eab308;font-weight:bold;font-size:14px;padding:10px 12px;">Price Per Unit</td>
                </tr>
                <tr style="background-color:#222;">
                  <td style="color:#d1d5db;font-size:14px;padding:10px 12px;">10 – 49 units</td>
                  <td style="color:#ffffff;font-size:14px;font-weight:bold;padding:10px 12px;">$3.00 / ea</td>
                </tr>
                <tr style="background-color:#1a1a1a;">
                  <td style="color:#d1d5db;font-size:14px;padding:10px 12px;">50 – 99 units</td>
                  <td style="color:#ffffff;font-size:14px;font-weight:bold;padding:10px 12px;">$2.90 / ea</td>
                </tr>
                <tr style="background-color:#222;">
                  <td style="color:#d1d5db;font-size:14px;padding:10px 12px;">100 – 199 units</td>
                  <td style="color:#ffffff;font-size:14px;font-weight:bold;padding:10px 12px;">$2.75 / ea</td>
                </tr>
                <tr style="background-color:#1a1a1a;">
                  <td style="color:#d1d5db;font-size:14px;padding:10px 12px;">200+ units</td>
                  <td style="color:#eab308;font-size:14px;font-weight:bold;padding:10px 12px;">$2.50 / ea</td>
                </tr>
              </table>
              <p style="color:#d1d5db;font-size:15px;margin:0 0 8px;">Every order ships free — no minimums on shipping.</p>
              <p style="color:#d1d5db;font-size:15px;margin:0 0 24px;">Returning customers receive an additional 10% loyalty discount that stacks on top of volume pricing automatically.</p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding-top:16px;">
                    <a href="https://driveshaftcable.com/products" target="_blank" style="display:inline-block;background-color:#eab308;color:#000;font-size:16px;font-weight:bold;text-decoration:none;padding:16px 48px;letter-spacing:1px;">
                      VIEW PRICING
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background-color:#111;padding:20px;text-align:center;border-top:1px solid #333;">
              <p style="color:#6b7280;font-size:12px;margin:0;">K.Todd Driveshaft Cable | orders@k-todd.com</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  },

  reorderReminder: {
    label: 'Reorder Reminder',
    description: 'Nudge past customers to restock',
    subject: "Time to restock? Your 10% loyalty discount is waiting — K.Todd",
    html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#111111;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#111111;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#1a1a1a;border:1px solid #333;">
          <tr>
            <td style="background-color:#eab308;padding:24px;text-align:center;">
              <h1 style="margin:0;color:#000;font-size:24px;font-weight:bold;letter-spacing:2px;">TIME TO RESTOCK?</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="color:#d1d5db;font-size:16px;margin:0 0 16px;">It's been a while since your last order. Running low on driveshaft cables?</p>
              <p style="color:#d1d5db;font-size:16px;margin:0 0 16px;">Don't wait until you're out. Keeping a buffer on hand means fewer delays and no emergency sourcing when a job comes in hot.</p>
              <p style="color:#d1d5db;font-size:16px;margin:0 0 24px;">Reorder now and your 10% loyalty discount will be applied automatically at checkout — just use the same email address.</p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding-top:16px;">
                    <a href="https://driveshaftcable.com/products" target="_blank" style="display:inline-block;background-color:#eab308;color:#000;font-size:16px;font-weight:bold;text-decoration:none;padding:16px 48px;letter-spacing:1px;">
                      REORDER NOW
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background-color:#111;padding:20px;text-align:center;border-top:1px solid #333;">
              <p style="color:#6b7280;font-size:12px;margin:0;">K.Todd Driveshaft Cable | orders@k-todd.com</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  },

  holidaySale: {
    label: 'Holiday / Seasonal Sale',
    description: 'Limited-time seasonal offer template',
    subject: 'Limited time offer — K.Todd Driveshaft Cable',
    html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#111111;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#111111;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#1a1a1a;border:1px solid #333;">
          <tr>
            <td style="background-color:#eab308;padding:24px;text-align:center;">
              <h1 style="margin:0;color:#000;font-size:24px;font-weight:bold;letter-spacing:2px;">LIMITED TIME OFFER</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="color:#d1d5db;font-size:16px;margin:0 0 16px;">[Customize this section with your seasonal offer details.]</p>
              <p style="color:#d1d5db;font-size:16px;margin:0 0 16px;">Example: Order before December 15th for guaranteed delivery by Christmas. Whether you're stocking up for the new year or taking advantage of end-of-year budget, now is the right time to buy.</p>
              <p style="color:#d1d5db;font-size:16px;margin:0 0 24px;">All orders ship free. Returning customers save an additional 10% automatically at checkout.</p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding-top:16px;">
                    <a href="https://driveshaftcable.com/products" target="_blank" style="display:inline-block;background-color:#eab308;color:#000;font-size:16px;font-weight:bold;text-decoration:none;padding:16px 48px;letter-spacing:1px;">
                      SHOP THE SALE
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background-color:#111;padding:20px;text-align:center;border-top:1px solid #333;">
              <p style="color:#6b7280;font-size:12px;margin:0;">K.Todd Driveshaft Cable | orders@k-todd.com</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  },

  newProduct: {
    label: 'New Product',
    description: 'Announce a new product or improvement',
    subject: "Something new from K.Todd — take a look",
    html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#111111;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#111111;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#1a1a1a;border:1px solid #333;">
          <tr>
            <td style="background-color:#eab308;padding:24px;text-align:center;">
              <h1 style="margin:0;color:#000;font-size:24px;font-weight:bold;letter-spacing:2px;">SOMETHING NEW FROM K.TODD</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="color:#d1d5db;font-size:16px;margin:0 0 16px;">[Describe your new product or improvement here.]</p>
              <p style="color:#d1d5db;font-size:16px;margin:0 0 16px;">Highlight what's new, why it matters, and how it benefits the customer. Keep it focused and specific — what problem does this solve, and how does it make their operation easier?</p>
              <p style="color:#d1d5db;font-size:16px;margin:0 0 24px;">As always, all orders ship free and returning customers receive a 10% loyalty discount at checkout.</p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding-top:16px;">
                    <a href="https://driveshaftcable.com/products" target="_blank" style="display:inline-block;background-color:#eab308;color:#000;font-size:16px;font-weight:bold;text-decoration:none;padding:16px 48px;letter-spacing:1px;">
                      LEARN MORE
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background-color:#111;padding:20px;text-align:center;border-top:1px solid #333;">
              <p style="color:#6b7280;font-size:12px;margin:0;">K.Todd Driveshaft Cable | orders@k-todd.com</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  },

  priceChange: {
    label: 'Price Change Notice',
    description: 'Notify customers of upcoming price change',
    subject: 'Important pricing update from K.Todd Driveshaft Cable',
    html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#111111;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#111111;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#1a1a1a;border:1px solid #333;">
          <tr>
            <td style="background-color:#eab308;padding:24px;text-align:center;">
              <h1 style="margin:0;color:#000;font-size:24px;font-weight:bold;letter-spacing:2px;">IMPORTANT PRICING UPDATE</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="color:#d1d5db;font-size:16px;margin:0 0 16px;">We're writing to let you know about an upcoming change to our pricing, effective [DATE].</p>
              <p style="color:#d1d5db;font-size:16px;margin:0 0 16px;">[Describe the pricing change here — what's changing, why, and by how much.]</p>
              <p style="color:#d1d5db;font-size:16px;margin:0 0 24px;">Current customers can lock in today's pricing by placing an order before the change takes effect. We appreciate your understanding and continued business.</p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding-top:16px;">
                    <a href="https://driveshaftcable.com/products" target="_blank" style="display:inline-block;background-color:#eab308;color:#000;font-size:16px;font-weight:bold;text-decoration:none;padding:16px 48px;letter-spacing:1px;">
                      ORDER AT CURRENT PRICES
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background-color:#111;padding:20px;text-align:center;border-top:1px solid #333;">
              <p style="color:#6b7280;font-size:12px;margin:0;">K.Todd Driveshaft Cable | orders@k-todd.com</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  },

  thankYou: {
    label: 'Thank You',
    description: 'Post-purchase appreciation, loyalty reminder',
    subject: 'Thank you for your order — K.Todd Driveshaft Cable',
    html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#111111;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#111111;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#1a1a1a;border:1px solid #333;">
          <tr>
            <td style="background-color:#eab308;padding:24px;text-align:center;">
              <h1 style="margin:0;color:#000;font-size:24px;font-weight:bold;letter-spacing:2px;">THANK YOU FOR YOUR ORDER</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="color:#d1d5db;font-size:16px;margin:0 0 16px;">We appreciate your business. Your K.Todd Driveshaft Cable is built to last — and so is our commitment to you.</p>
              <p style="color:#d1d5db;font-size:16px;margin:0 0 16px;">As a valued customer, you'll receive a 10% loyalty discount on your next order, applied automatically at checkout. No codes needed — just use the same email address.</p>
              <p style="color:#d1d5db;font-size:16px;margin:0 0 8px;">Questions or feedback? Reply to this email anytime. We read every message.</p>
              <p style="color:#d1d5db;font-size:16px;margin:0;">— The K.Todd Team</p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#111;padding:20px;text-align:center;border-top:1px solid #333;">
              <p style="color:#6b7280;font-size:12px;margin:0;">K.Todd Driveshaft Cable | orders@k-todd.com</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  },

  fleetOutreach: {
    label: 'Fleet / Wholesale',
    description: 'Target fleet operators and bulk buyers',
    subject: 'Built for your fleet — K.Todd Driveshaft Cable',
    html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#111111;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#111111;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#1a1a1a;border:1px solid #333;">
          <tr>
            <td style="background-color:#eab308;padding:24px;text-align:center;">
              <h1 style="margin:0;color:#000;font-size:24px;font-weight:bold;letter-spacing:2px;">BUILT FOR YOUR FLEET</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="color:#d1d5db;font-size:16px;margin:0 0 16px;">K.Todd Driveshaft Cables are engineered for heavy-duty use and trusted by fleet operators across the country.</p>
              <p style="color:#d1d5db;font-size:16px;margin:0 0 16px;">When you're managing a fleet, you can't afford downtime from inferior parts. Every K.Todd cable is built to spec and ships fast — so your vehicles stay on the road and your operation stays on schedule.</p>
              <p style="color:#d1d5db;font-size:16px;margin:0 0 24px;">With volume pricing starting at just $2.50/unit, free shipping on every order, and a 10% loyalty discount for returning customers — we're built to keep your fleet moving.</p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding-top:16px;">
                    <a href="https://driveshaftcable.com/quote" target="_blank" style="display:inline-block;background-color:#eab308;color:#000;font-size:16px;font-weight:bold;text-decoration:none;padding:16px 48px;letter-spacing:1px;">
                      GET A QUOTE
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background-color:#111;padding:20px;text-align:center;border-top:1px solid #333;">
              <p style="color:#6b7280;font-size:12px;margin:0;">K.Todd Driveshaft Cable | orders@k-todd.com</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  },

  freeShipping: {
    label: 'Free Shipping',
    description: 'Highlight free shipping on every order',
    subject: 'Free shipping on every order — K.Todd Driveshaft Cable',
    html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#111111;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#111111;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#1a1a1a;border:1px solid #333;">
          <tr>
            <td style="background-color:#eab308;padding:24px;text-align:center;">
              <h1 style="margin:0;color:#000;font-size:24px;font-weight:bold;letter-spacing:2px;">FREE SHIPPING ON EVERY ORDER</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="color:#d1d5db;font-size:16px;margin:0 0 16px;">Every K.Todd order ships free — no minimum required, no fine print.</p>
              <p style="color:#d1d5db;font-size:16px;margin:0 0 16px;">Whether you're ordering 10 units or 200, shipping is on us. That's the K.Todd standard, and it never changes.</p>
              <p style="color:#d1d5db;font-size:16px;margin:0 0 24px;">Combined with our volume pricing and 10% loyalty discount for returning customers, there's never been a better time to stock up. Savings stack — and so do the units.</p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding-top:16px;">
                    <a href="https://driveshaftcable.com/products" target="_blank" style="display:inline-block;background-color:#eab308;color:#000;font-size:16px;font-weight:bold;text-decoration:none;padding:16px 48px;letter-spacing:1px;">
                      SHOP NOW
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background-color:#111;padding:20px;text-align:center;border-top:1px solid #333;">
              <p style="color:#6b7280;font-size:12px;margin:0;">K.Todd Driveshaft Cable | orders@k-todd.com</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  },

  general: {
    label: 'General Update',
    description: 'Blank template for any announcement',
    subject: 'A message from K.Todd Driveshaft Cable',
    html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#111111;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#111111;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#1a1a1a;border:1px solid #333;">
          <tr>
            <td style="background-color:#eab308;padding:24px;text-align:center;">
              <h1 style="margin:0;color:#000;font-size:24px;font-weight:bold;letter-spacing:2px;">A MESSAGE FROM K.TODD</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="color:#d1d5db;font-size:16px;margin:0 0 16px;">[Your message here. Replace this text with your announcement, update, or message to customers.]</p>
              <p style="color:#d1d5db;font-size:16px;margin:0;">— The K.Todd Team</p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#111;padding:20px;text-align:center;border-top:1px solid #333;">
              <p style="color:#6b7280;font-size:12px;margin:0;">K.Todd Driveshaft Cable | orders@k-todd.com</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  },

  outOfStock: {
    label: 'Out of Stock Notice',
    description: 'Temporarily sold out, restocking soon',
    subject: 'Temporarily out of stock — new inventory arriving soon | K.Todd',
    html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#111111;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#111111;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#1a1a1a;border:1px solid #333;">
          <tr>
            <td style="background-color:#eab308;padding:24px;text-align:center;">
              <h1 style="margin:0;color:#000;font-size:24px;font-weight:bold;letter-spacing:2px;">TEMPORARILY OUT OF STOCK</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="color:#d1d5db;font-size:16px;margin:0 0 16px;">We wanted to give you a heads up — K.Todd Driveshaft Cables are currently sold out due to high demand.</p>
              <p style="color:#d1d5db;font-size:16px;margin:0 0 16px;">The good news: <strong style="color:#eab308;">new inventory is on the way and expected within the next 20 days.</strong> We're working to get restocked as fast as possible so you're never without the parts you need.</p>
              <p style="color:#d1d5db;font-size:16px;margin:0 0 16px;">If you'd like to get ahead of the rush, you can request a quote now to lock in your order. We'll have it ready to ship the moment inventory arrives.</p>
              <p style="color:#d1d5db;font-size:16px;margin:0 0 24px;">We appreciate your patience and your business. As always, returning customers receive a 10% loyalty discount — applied automatically at checkout.</p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding-top:16px;">
                    <a href="https://driveshaftcable.com/quote" target="_blank" style="display:inline-block;background-color:#eab308;color:#000;font-size:16px;font-weight:bold;text-decoration:none;padding:16px 48px;letter-spacing:1px;">
                      REQUEST A QUOTE
                    </a>
                  </td>
                </tr>
              </table>
              <p style="color:#6b7280;font-size:13px;margin:24px 0 0;text-align:center;">We'll notify you as soon as we're restocked and ready to ship.</p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#111;padding:20px;text-align:center;border-top:1px solid #333;">
              <p style="color:#6b7280;font-size:12px;margin:0;">K.Todd Driveshaft Cable | orders@k-todd.com</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  },
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function calcNextSend(recurrence) {
  const now = new Date()
  if (recurrence === 'weekly') {
    now.setDate(now.getDate() + 7)
  } else if (recurrence === 'biweekly') {
    now.setDate(now.getDate() + 14)
  } else {
    // monthly
    now.setMonth(now.getMonth() + 1)
  }
  return now.toISOString()
}

function formatDate(dateString) {
  if (!dateString) return '—'
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function AdminEmailPage() {
  const navigate = useNavigate()

  // Auth
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // Compose
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [subject, setSubject] = useState('')
  const [htmlBody, setHtmlBody] = useState('')
  const [showPreview, setShowPreview] = useState(false)

  // Send mode
  const [sendMode, setSendMode] = useState('immediate')
  const [scheduledDate, setScheduledDate] = useState('')
  const [recurrence, setRecurrence] = useState('weekly')

  // Status
  const [sending, setSending] = useState(false)
  const [sendResult, setSendResult] = useState(null)
  const [sendError, setSendError] = useState(null)

  // Recipients
  const [recipientCount, setRecipientCount] = useState(null)
  const [checkingCount, setCheckingCount] = useState(false)

  // Campaigns / history
  const [campaigns, setCampaigns] = useState([])
  const [sends, setSends] = useState([])
  const [editingCampaignId, setEditingCampaignId] = useState(null)

  // -------------------------------------------------------------------------
  // Auth
  // -------------------------------------------------------------------------

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      navigate('/admin/login')
      return
    }
    setUser(session.user)
    setLoading(false)
    loadCampaigns()
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    navigate('/admin/login')
  }

  // -------------------------------------------------------------------------
  // Data loading
  // -------------------------------------------------------------------------

  const loadCampaigns = async () => {
    const [recurringResult, scheduledResult, sendsResult] = await Promise.all([
      supabase
        .from('email_campaigns')
        .select('*')
        .eq('send_type', 'recurring')
        .in('status', ['active', 'paused'])
        .order('created_at', { ascending: false }),
      supabase
        .from('email_campaigns')
        .select('*')
        .eq('send_type', 'scheduled')
        .eq('status', 'scheduled')
        .order('scheduled_at', { ascending: true }),
      supabase
        .from('email_campaign_sends')
        .select('*, email_campaigns(subject)')
        .order('sent_at', { ascending: false })
        .limit(20),
    ])

    const allCampaigns = [
      ...(recurringResult.data || []),
      ...(scheduledResult.data || []),
    ]
    setCampaigns(allCampaigns)
    setSends(sendsResult.data || [])
  }

  // -------------------------------------------------------------------------
  // Template picker
  // -------------------------------------------------------------------------

  const selectTemplate = (key) => {
    const tpl = TEMPLATES[key]
    setSelectedTemplate(key)
    setSubject(tpl.subject)
    setHtmlBody(tpl.html)
    setShowPreview(false)
    setSendResult(null)
    setSendError(null)
    setEditingCampaignId(null)
  }

  // -------------------------------------------------------------------------
  // Recipient count
  // -------------------------------------------------------------------------

  const checkRecipientCount = async () => {
    setCheckingCount(true)
    const [{ count: orderCount }, { count: quoteCount }] = await Promise.all([
      supabase.from('orders').select('email', { count: 'exact', head: true }).eq('payment_status', 'paid'),
      supabase.from('quote_requests').select('email', { count: 'exact', head: true }),
    ])
    setRecipientCount((orderCount || 0) + (quoteCount || 0))
    setCheckingCount(false)
  }

  // -------------------------------------------------------------------------
  // Send / schedule / start recurring
  // -------------------------------------------------------------------------

  const handleSendNow = async () => {
    if (!subject.trim() || !htmlBody.trim()) {
      setSendError('Subject and email body are required.')
      return
    }
    const confirmed = window.confirm(`Send this email blast to all customers now?\n\nSubject: ${subject}`)
    if (!confirmed) return

    setSending(true)
    setSendResult(null)
    setSendError(null)

    try {
      const { data, error } = await supabase.functions.invoke('send-marketing-email', {
        body: { subject, htmlContent: htmlBody },
      })
      if (error) throw error
      setSendResult(data)
      loadCampaigns()
    } catch (err) {
      setSendError(err.message || 'Failed to send email blast.')
    } finally {
      setSending(false)
    }
  }

  const handleSchedule = async () => {
    if (!subject.trim() || !htmlBody.trim()) {
      setSendError('Subject and email body are required.')
      return
    }
    if (!scheduledDate) {
      setSendError('Please select a date and time to schedule.')
      return
    }
    const confirmed = window.confirm(`Schedule this email blast for ${new Date(scheduledDate).toLocaleString()}?\n\nSubject: ${subject}`)
    if (!confirmed) return

    setSending(true)
    setSendResult(null)
    setSendError(null)

    try {
      const { error } = await supabase.from('email_campaigns').insert({
        subject,
        html_content: htmlBody,
        send_type: 'scheduled',
        status: 'scheduled',
        scheduled_at: new Date(scheduledDate).toISOString(),
        next_send_at: new Date(scheduledDate).toISOString(),
        is_active: false,
      })
      if (error) throw error
      setSendResult({ scheduled: true })
      loadCampaigns()
    } catch (err) {
      setSendError(err.message || 'Failed to schedule campaign.')
    } finally {
      setSending(false)
    }
  }

  const handleStartRecurring = async () => {
    if (!subject.trim() || !htmlBody.trim()) {
      setSendError('Subject and email body are required.')
      return
    }
    const confirmed = window.confirm(`Start a ${recurrence} recurring campaign?\n\nSubject: ${subject}`)
    if (!confirmed) return

    setSending(true)
    setSendResult(null)
    setSendError(null)

    try {
      if (editingCampaignId) {
        const { error } = await supabase
          .from('email_campaigns')
          .update({
            subject,
            html_content: htmlBody,
            recurrence,
            next_send_at: calcNextSend(recurrence),
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingCampaignId)
        if (error) throw error
      } else {
        const { error } = await supabase.from('email_campaigns').insert({
          subject,
          html_content: htmlBody,
          send_type: 'recurring',
          status: 'active',
          recurrence,
          next_send_at: calcNextSend(recurrence),
          is_active: true,
        })
        if (error) throw error
      }
      setSendResult({ recurring: true })
      setEditingCampaignId(null)
      loadCampaigns()
    } catch (err) {
      setSendError(err.message || 'Failed to save recurring campaign.')
    } finally {
      setSending(false)
    }
  }

  const handleSend = () => {
    if (sendMode === 'immediate') handleSendNow()
    else if (sendMode === 'scheduled') handleSchedule()
    else handleStartRecurring()
  }

  // -------------------------------------------------------------------------
  // Campaign actions
  // -------------------------------------------------------------------------

  const toggleCampaignActive = async (campaign) => {
    const newActive = !campaign.is_active
    const newStatus = newActive ? 'active' : 'paused'
    const { error } = await supabase
      .from('email_campaigns')
      .update({ is_active: newActive, status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', campaign.id)
    if (!error) loadCampaigns()
  }

  const editCampaign = (campaign) => {
    setEditingCampaignId(campaign.id)
    setSubject(campaign.subject || '')
    setHtmlBody(campaign.html_content || '')
    setRecurrence(campaign.recurrence || 'weekly')
    setSendMode('recurring')
    setShowPreview(false)
    setSendResult(null)
    setSendError(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const cancelScheduled = async (campaign) => {
    const confirmed = window.confirm('Cancel this scheduled campaign?')
    if (!confirmed) return
    const { error } = await supabase
      .from('email_campaigns')
      .update({ status: 'cancelled', is_active: false, next_send_at: null, updated_at: new Date().toISOString() })
      .eq('id', campaign.id)
    if (!error) loadCampaigns()
  }

  // -------------------------------------------------------------------------
  // Derived
  // -------------------------------------------------------------------------

  const recurringCampaigns = campaigns.filter(c => c.send_type === 'recurring')
  const scheduledCampaigns = campaigns.filter(c => c.send_type === 'scheduled')

  // -------------------------------------------------------------------------
  // Render: loading
  // -------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="min-h-screen bg-ktodd-dark flex items-center justify-center">
        <div className="text-yellow-500">Loading...</div>
      </div>
    )
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-ktodd-dark">
      {/* Admin Header */}
      <header className="bg-ktodd-dark border-b border-gray-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <Link to="/admin" className="flex items-center gap-2">
                <div className="w-8 h-8 bg-yellow-500 rounded flex items-center justify-center">
                  <span className="text-black font-bold text-sm font-industrial">K</span>
                </div>
                <span className="text-yellow-500 font-industrial">ADMIN</span>
              </Link>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-gray-400 text-sm hidden sm:block">{user?.email}</span>
              <button
                onClick={handleSignOut}
                className="text-gray-400 hover:text-red-500 transition-colors text-sm"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 bg-gray-900 min-h-[calc(100vh-4rem)] border-r border-gray-800 hidden md:block">
          <nav className="p-4 space-y-2">
            <Link to="/admin" className="flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              Dashboard
            </Link>
            <Link to="/admin/orders" className="flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
              Orders
            </Link>
            <Link to="/admin/quotes" className="flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
              Quotes
            </Link>
            <Link to="/admin/email" className="flex items-center gap-3 px-4 py-3 text-yellow-500 bg-gray-800 rounded">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Email Blast
            </Link>
            <Link to="/admin/analytics" className="flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Analytics
            </Link>
            <Link to="/admin/newsletter" className="flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              Newsletter
            </Link>
            <div className="border-t border-gray-800 my-4"></div>
            <Link to="/" className="flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              View Website
            </Link>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6 lg:p-8">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-3xl font-industrial text-white mb-8">EMAIL BLAST</h1>

            {/* ----------------------------------------------------------------
                Template Picker
            ---------------------------------------------------------------- */}
            <div className="bg-gray-800/50 border border-gray-700 p-6 mb-6">
              <h2 className="text-xl font-industrial text-yellow-500 mb-4">CHOOSE A TEMPLATE</h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {Object.entries(TEMPLATES).map(([key, tpl]) => (
                  <button
                    key={key}
                    onClick={() => selectTemplate(key)}
                    className={`text-left p-4 border rounded transition-colors ${
                      selectedTemplate === key
                        ? 'border-yellow-500 bg-gray-700/60'
                        : 'border-gray-700 bg-gray-800/40 hover:border-gray-500'
                    }`}
                  >
                    <div className="text-white font-bold text-sm mb-1">{tpl.label}</div>
                    <div className="text-gray-400 text-xs leading-relaxed">{tpl.description}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* ----------------------------------------------------------------
                Recipient Count
            ---------------------------------------------------------------- */}
            <div className="bg-gray-800/50 border border-gray-700 px-6 py-4 mb-6 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1">
                <span className="text-gray-400 text-sm">
                  Recipients: all paid orders + quote requests (deduplicated)
                </span>
                {recipientCount !== null && (
                  <span className="ml-3 text-yellow-500 font-bold text-sm">
                    Up to {recipientCount} recipients (exact count after dedup)
                  </span>
                )}
              </div>
              <button
                onClick={checkRecipientCount}
                disabled={checkingCount}
                className="text-sm text-gray-300 border border-gray-600 hover:border-gray-400 px-4 py-2 transition-colors disabled:opacity-50"
              >
                {checkingCount ? 'Checking...' : 'Check Count'}
              </button>
            </div>

            {/* ----------------------------------------------------------------
                Compose Area
            ---------------------------------------------------------------- */}
            <div className="bg-gray-800/50 border border-gray-700 p-6 mb-6">
              <h2 className="text-xl font-industrial text-yellow-500 mb-4">
                {editingCampaignId ? 'EDIT RECURRING CAMPAIGN' : 'COMPOSE'}
              </h2>

              {/* Subject */}
              <div className="mb-4">
                <label className="block text-gray-400 text-sm font-bold mb-2 uppercase tracking-wide">
                  Subject
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Email subject line..."
                  className="w-full bg-gray-900 border border-gray-700 text-white px-4 py-3 focus:border-yellow-500 focus:outline-none"
                />
              </div>

              {/* Edit / Preview tabs */}
              <div className="flex gap-2 mb-3">
                <button
                  onClick={() => setShowPreview(false)}
                  className={`px-4 py-2 text-sm font-bold transition-colors ${
                    !showPreview
                      ? 'bg-yellow-500 text-black'
                      : 'border border-gray-600 text-gray-400 hover:text-white'
                  }`}
                >
                  EDIT
                </button>
                <button
                  onClick={() => setShowPreview(true)}
                  className={`px-4 py-2 text-sm font-bold transition-colors ${
                    showPreview
                      ? 'bg-yellow-500 text-black'
                      : 'border border-gray-600 text-gray-400 hover:text-white'
                  }`}
                >
                  PREVIEW
                </button>
              </div>

              {showPreview ? (
                <iframe
                  srcDoc={htmlBody}
                  className="w-full h-[500px] bg-white border border-gray-700"
                  title="Email preview"
                />
              ) : (
                <div>
                  <label className="block text-gray-400 text-sm font-bold mb-2 uppercase tracking-wide">
                    Email Body (HTML)
                  </label>
                  <textarea
                    rows={20}
                    value={htmlBody}
                    onChange={(e) => setHtmlBody(e.target.value)}
                    placeholder="Paste or write your HTML email here..."
                    className="w-full bg-gray-900 border border-gray-700 text-white px-4 py-3 font-mono text-sm focus:border-yellow-500 focus:outline-none resize-y"
                  />
                </div>
              )}
            </div>

            {/* ----------------------------------------------------------------
                Send Mode Selector
            ---------------------------------------------------------------- */}
            <div className="bg-gray-800/50 border border-gray-700 p-6 mb-6">
              <h2 className="text-xl font-industrial text-yellow-500 mb-4">SEND OPTIONS</h2>

              {/* Mode tabs */}
              <div className="flex gap-2 mb-6">
                {[
                  { key: 'immediate', label: 'Send Now' },
                  { key: 'scheduled', label: 'Schedule' },
                  { key: 'recurring', label: 'Recurring' },
                ].map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => { setSendMode(key); setSendResult(null); setSendError(null) }}
                    className={`px-4 py-2 text-sm font-bold transition-colors ${
                      sendMode === key
                        ? 'bg-yellow-500 text-black'
                        : 'border border-gray-600 text-gray-400 hover:text-white'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Mode-specific controls */}
              {sendMode === 'immediate' && (
                <div>
                  <p className="text-gray-400 text-sm mb-4">
                    The email will be sent immediately to all qualifying recipients.
                  </p>
                  <button
                    onClick={handleSend}
                    disabled={sending || !subject.trim() || !htmlBody.trim()}
                    className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold px-6 py-3 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {sending ? 'Sending...' : 'SEND BLAST NOW'}
                  </button>
                </div>
              )}

              {sendMode === 'scheduled' && (
                <div>
                  <div className="mb-4">
                    <label className="block text-gray-400 text-sm font-bold mb-2 uppercase tracking-wide">
                      Send Date & Time
                    </label>
                    <input
                      type="datetime-local"
                      value={scheduledDate}
                      onChange={(e) => setScheduledDate(e.target.value)}
                      className="bg-gray-900 border border-gray-700 text-white px-4 py-3 focus:border-yellow-500 focus:outline-none"
                    />
                  </div>
                  <button
                    onClick={handleSend}
                    disabled={sending || !subject.trim() || !htmlBody.trim() || !scheduledDate}
                    className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold px-6 py-3 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {sending ? 'Scheduling...' : 'SCHEDULE CAMPAIGN'}
                  </button>
                </div>
              )}

              {sendMode === 'recurring' && (
                <div>
                  <div className="mb-4">
                    <label className="block text-gray-400 text-sm font-bold mb-2 uppercase tracking-wide">
                      Frequency
                    </label>
                    <select
                      value={recurrence}
                      onChange={(e) => setRecurrence(e.target.value)}
                      className="bg-gray-900 border border-gray-700 text-white px-4 py-3 focus:border-yellow-500 focus:outline-none"
                    >
                      <option value="weekly">Weekly</option>
                      <option value="biweekly">Biweekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>
                  <button
                    onClick={handleSend}
                    disabled={sending || !subject.trim() || !htmlBody.trim()}
                    className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold px-6 py-3 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {sending
                      ? 'Saving...'
                      : editingCampaignId
                        ? 'UPDATE RECURRING CAMPAIGN'
                        : 'START RECURRING CAMPAIGN'}
                  </button>
                  {editingCampaignId && (
                    <button
                      onClick={() => {
                        setEditingCampaignId(null)
                        setSendResult(null)
                        setSendError(null)
                      }}
                      className="ml-3 text-gray-400 hover:text-white text-sm transition-colors"
                    >
                      Cancel edit
                    </button>
                  )}
                </div>
              )}

              {/* Result / error banners */}
              {sendResult && (
                <div className="mt-4 bg-green-500/10 border border-green-500 text-green-400 px-4 py-3 text-sm">
                  {sendResult.scheduled
                    ? 'Campaign scheduled successfully.'
                    : sendResult.recurring
                      ? editingCampaignId
                        ? 'Recurring campaign updated.'
                        : 'Recurring campaign started.'
                      : `Blast sent. ${sendResult.sentCount ?? 0} delivered, ${sendResult.failedCount ?? 0} failed (${sendResult.total ?? 0} total).`}
                </div>
              )}
              {sendError && (
                <div className="mt-4 bg-red-500/10 border border-red-500 text-red-400 px-4 py-3 text-sm">
                  {sendError}
                </div>
              )}
            </div>

            {/* ----------------------------------------------------------------
                Active Recurring Campaigns
            ---------------------------------------------------------------- */}
            <div className="bg-gray-800/50 border border-gray-700 p-6 mb-6">
              <h2 className="text-xl font-industrial text-yellow-500 mb-4">ACTIVE RECURRING CAMPAIGNS</h2>
              {recurringCampaigns.length === 0 ? (
                <p className="text-gray-500 text-sm">No recurring campaigns configured.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-gray-400 text-left border-b border-gray-700">
                        <th className="pb-3 pr-4 font-bold">Subject</th>
                        <th className="pb-3 pr-4 font-bold">Frequency</th>
                        <th className="pb-3 pr-4 font-bold">Next Send</th>
                        <th className="pb-3 pr-4 font-bold">Last Sent</th>
                        <th className="pb-3 pr-4 font-bold">Status</th>
                        <th className="pb-3 font-bold">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700/50">
                      {recurringCampaigns.map((c) => (
                        <tr key={c.id} className="align-middle">
                          <td className="py-3 pr-4 text-white max-w-[180px] truncate">{c.subject}</td>
                          <td className="py-3 pr-4 text-gray-300 capitalize">{c.recurrence || '—'}</td>
                          <td className="py-3 pr-4 text-gray-300">{formatDate(c.next_send_at)}</td>
                          <td className="py-3 pr-4 text-gray-300">{formatDate(c.last_sent_at)}</td>
                          <td className="py-3 pr-4">
                            {/* Toggle switch */}
                            <button
                              onClick={() => toggleCampaignActive(c)}
                              className={`relative inline-flex items-center h-6 w-11 rounded-full transition-colors focus:outline-none ${
                                c.is_active ? 'bg-yellow-500' : 'bg-gray-600'
                              }`}
                              title={c.is_active ? 'Pause campaign' : 'Resume campaign'}
                            >
                              <span
                                className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${
                                  c.is_active ? 'translate-x-6' : 'translate-x-1'
                                }`}
                              />
                            </button>
                            <span className={`ml-2 text-xs ${c.is_active ? 'text-green-400' : 'text-gray-500'}`}>
                              {c.is_active ? 'Active' : 'Paused'}
                            </span>
                          </td>
                          <td className="py-3">
                            <button
                              onClick={() => editCampaign(c)}
                              className="text-yellow-500 hover:text-yellow-400 text-xs font-bold transition-colors"
                            >
                              Edit
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* ----------------------------------------------------------------
                Scheduled Campaigns
            ---------------------------------------------------------------- */}
            <div className="bg-gray-800/50 border border-gray-700 p-6 mb-6">
              <h2 className="text-xl font-industrial text-yellow-500 mb-4">SCHEDULED CAMPAIGNS</h2>
              {scheduledCampaigns.length === 0 ? (
                <p className="text-gray-500 text-sm">No scheduled campaigns pending.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-gray-400 text-left border-b border-gray-700">
                        <th className="pb-3 pr-4 font-bold">Subject</th>
                        <th className="pb-3 pr-4 font-bold">Scheduled For</th>
                        <th className="pb-3 font-bold">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700/50">
                      {scheduledCampaigns.map((c) => (
                        <tr key={c.id}>
                          <td className="py-3 pr-4 text-white max-w-[260px] truncate">{c.subject}</td>
                          <td className="py-3 pr-4 text-gray-300">{formatDate(c.scheduled_at)}</td>
                          <td className="py-3">
                            <button
                              onClick={() => cancelScheduled(c)}
                              className="text-red-400 hover:text-red-300 text-xs font-bold transition-colors"
                            >
                              Cancel
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* ----------------------------------------------------------------
                Send History
            ---------------------------------------------------------------- */}
            <div className="bg-gray-800/50 border border-gray-700 p-6 mb-8">
              <h2 className="text-xl font-industrial text-yellow-500 mb-4">SEND HISTORY</h2>
              {sends.length === 0 ? (
                <p className="text-gray-500 text-sm">No sends recorded yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-gray-400 text-left border-b border-gray-700">
                        <th className="pb-3 pr-4 font-bold">Date</th>
                        <th className="pb-3 pr-4 font-bold">Subject</th>
                        <th className="pb-3 pr-4 font-bold">Sent</th>
                        <th className="pb-3 pr-4 font-bold">Failed</th>
                        <th className="pb-3 font-bold">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700/50">
                      {sends.map((s) => (
                        <tr key={s.id}>
                          <td className="py-3 pr-4 text-gray-300 whitespace-nowrap">{formatDate(s.sent_at)}</td>
                          <td className="py-3 pr-4 text-white max-w-[220px] truncate">
                            {s.email_campaigns?.subject || s.subject || '—'}
                          </td>
                          <td className="py-3 pr-4 text-green-400 font-bold">{s.sent_count ?? '—'}</td>
                          <td className="py-3 pr-4 text-red-400 font-bold">{s.failed_count ?? '—'}</td>
                          <td className="py-3 text-gray-300">{s.total_count ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

export default AdminEmailPage
