import React from 'react'
import SEOHead from '../components/common/SEOHead'
import StorefrontProducts from '../components/landing/StorefrontProducts'
import { useStorefrontProducts } from '../hooks/useStorefrontProducts'

// The /products page is now a thin shell around <StorefrontProducts /> —
// the same component renders at the top of the homepage. This route just
// owns the page-level SEO (title, description, JSON-LD ItemList) since
// only /products should claim that metadata in search engines.
function ProductListPage() {
  const { products } = useStorefrontProducts()

  return (
    <div className="pt-24 md:pt-32">
      <SEOHead
        title="Shop Driveshaft Safety Cables"
        description="Browse heavy-duty Driveshaft Cables (driveshaftcable). Volume pricing from $2.45/unit. Free shipping on orders over $400."
        keywords="buy driveshaft cable, driveshaftcable, driveshaft cable price, bulk driveshaft cable, towing safety cable"
        canonical="/products"
        structuredData={{
          '@context': 'https://schema.org',
          '@type': 'ItemList',
          name: 'Driveshaft Cables',
          itemListElement: products.map((p, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            url: `https://driveshaftcable.com/products/${p.slug}`,
            name: p.name,
          })),
        }}
      />
      <StorefrontProducts />
    </div>
  )
}

export default ProductListPage
