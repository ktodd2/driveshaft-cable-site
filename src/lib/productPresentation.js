// Cutter and XL installation photos need the full product visible in every storefront frame.
// Other products keep their existing cover/optional hover-zoom behavior.
export function productImageClasses(product, { hoverZoom = false } = {}) {
  if (product?.id === 'driveshaft-cable-cutters' || product?.slug === 'driveshaft-cable-cutters' || product?.id === 'driveshaft-cable-xl' || product?.slug === 'driveshaft-cable-xl') {
    return 'object-contain'
  }
  return hoverZoom ? 'object-cover hover:scale-105' : 'object-cover'
}

// Display-only helpers: never substitute another product's prices or claims.
// Accept the existing cart pricing shape so cart labels use its live snapshot.
export function volumePricingRows(pricing) {
  const tiers = [...(pricing?.tiers || [])].sort((a, b) => a.min - b.min)
  if (!tiers.length) return []
  const min = pricing.minOrderQuantity ?? 1
  const rows = tiers.map((tier, index) => ({
    min: tier.min,
    price: tier.price,
    label: index === tiers.length - 1 ? `${tier.min}+` : `${tier.min}-${tiers[index + 1].min - 1}`,
  }))
  if (min < tiers[0].min) {
    rows.unshift({ min, price: pricing.basePrice, label: `${min}-${tiers[0].min - 1}` })
  }
  return rows
}

export function productMetadata(product) {
  const specs = Object.entries(product.specs || {})
  const breakingStrength = specs.find(([key]) => /^breaking strength$/i.test(key))?.[1]
  const facts = specs.filter(([key]) => /^(breaking strength|length|total length|cable diameter)$/i.test(key))
    .map(([key, value]) => `${key}: ${value}`)
  const hasTiers = Array.isArray(product.tiers) && product.tiers.length > 0
  const length = String(specs.find(([key]) => /^(total )?length$/i.test(key))?.[1] || '')
  const inches = length.match(/^(\d+(?:\.\d+)?)\s*(?:inches|inch|in\.?|")$/i)?.[1]
  const hex = String(specs.find(([key]) => /^hex size$/i.test(key))?.[1] || '').match(/\b(\d+)\s*mm\b/i)?.[1]
  const titles = {
    'driveshaft-cable': 'Standard Driveshaft Tie-Up Cable for Towing',
    'driveshaft-cable-xl': `${inches ? `${inches}-Inch ` : ''}XL Driveshaft Tie-Up Cable`,
    'driveshaft-cable-cutters': 'Driveshaft Cable Cutters – Sold Individually',
    'value-brake-caging-bolt': `${hex ? `${hex}mm ` : ''}Brake Caging Bolts – 10-Pack`,
  }
  return {
    title: titles[product.slug] || `${product.name}${breakingStrength ? ` — ${breakingStrength} breaking strength` : ''}`,
    description: [product.name + '.', product.short_description, ...facts.map(fact => fact + '.'), hasTiers ? 'View current volume discounts and order online.' : 'View current pricing and order online.'].filter(Boolean).join(' '),
    keywords: [product.name, product.sku, breakingStrength ? `${breakingStrength} breaking strength` : null].filter(Boolean).join(', '),
  }
}

// Bolt ordering, pricing and inventory all count packs. These labels are
// display-only: the stored quantity and checkout arithmetic remain in packs.
export function isBoltPack(product) {
  return product?.slug === 'value-brake-caging-bolt' || product?.id === '3' || product?.productId === '3'
}

export function priceUnit(product) {
  return isBoltPack(product) ? '10-pack' : 'unit'
}

export function quantityUnit(product) {
  return isBoltPack(product) ? 'packs' : 'units'
}

export function packQuantity(product, quantity) {
  return isBoltPack(product) ? `${quantity} ${quantity === 1 ? 'pack' : 'packs'} · ${quantity * 10} bolts` : `${quantity} units`
}

const imageDescriptions = {
  'driveshaft-cable': {
    'inuse.jpeg': 'Standard driveshaft cable supporting a disconnected driveshaft beneath a truck',
    'img_5491.jpeg': 'Close-up of the yellow aluminum coupler and steel driveshaft cable',
    'img_5492.jpeg': 'Angled view of the yellow coupler where the steel driveshaft cable enters',
    'img_5493.jpeg': 'Standard driveshaft cable loop with a yellow coupler on a workbench',
    'img_5490.jpeg': 'Driveshaft cable laid alongside a tape measure',
    'img_5489.jpeg': 'Caliper measuring the diameter of a steel driveshaft cable',
  },
  'driveshaft-cable-xl': {
    'driveshaft-cable-xl-frame-rail.jpeg': 'Green Driveshaft Cable XL routed around a truck frame rail supporting a disconnected driveshaft',
    'approved-body-detail-8810-d84970761dce.png': 'Close-up of the green Driveshaft Cable XL body and steel cable',
  },
  'driveshaft-cable-cutters': {
    'authentic-main-8807.jpeg': 'Driveshaft cable cutters with red-coated handles and a compact cutting head',
  },
  'value-brake-caging-bolt': {
    'img_7336.jpg': 'Brake caging bolts with threaded shafts, washers and nuts on a workbench',
    'img_7335.jpg': 'Wrench fitted over the hex of a brake caging bolt',
    'img_7337.jpg': 'Comparison of three brake caging bolts with washers and nuts',
    'img_7338.jpg': 'Brake caging bolts arranged to show their threaded shafts and hardware',
    'img_7339.jpg': 'Brake caging bolt showing its threaded shaft, washer and nut',
    'img_7340.jpg': 'Brake caging bolt alongside a tape measure',
  },
}

// Key descriptions to reviewed photos, not gallery positions. Admin reordering
// must never give a photo another image's description or an unverified size.
export function productImageAlt(product, src) {
  let filename = ''
  try { filename = new URL(src, 'https://driveshaftcable.com').pathname.split('/').at(-1).toLowerCase() } catch { /* Use the product-name fallback. */ }
  return imageDescriptions[product?.slug]?.[filename] || product?.name || 'Product photo'
}

export function productShareImage(product) {
  for (const src of product?.images || []) {
    try {
      const image = new URL(src, 'https://driveshaftcable.com')
      if (['http:', 'https:'].includes(image.protocol)) return image.href
    } catch { /* Skip invalid media URLs. */ }
  }
  return undefined
}
