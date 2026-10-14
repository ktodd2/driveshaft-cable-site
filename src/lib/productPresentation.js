// Cutter photos need their full head and handles visible in every storefront frame.
// Other products keep their existing cover/optional hover-zoom behavior.
export function productImageClasses(product, { hoverZoom = false } = {}) {
  if (product?.id === 'driveshaft-cable-cutters' || product?.slug === 'driveshaft-cable-cutters') {
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
  const wll = specs.find(([key]) => /^(working load limit|wll)$/i.test(key))?.[1]
  const facts = specs.filter(([key]) => /^(working load limit|wll|length|total length|cable diameter)$/i.test(key))
    .map(([key, value]) => `${key}: ${value}`)
  const hasTiers = Array.isArray(product.tiers) && product.tiers.length > 0
  const price = (product.base_price_cents / 100).toFixed(2)
  return {
    title: `${product.name}${wll ? ` — ${wll} WLL` : ''}`,
    description: [product.name + '.', product.short_description, ...facts.map(fact => fact + '.'), `Starting at $${price}/unit${hasTiers ? ' with volume discounts' : ''}.`].filter(Boolean).join(' '),
    keywords: [product.name, product.sku, wll ? `${wll} WLL` : null].filter(Boolean).join(', '),
  }
}
