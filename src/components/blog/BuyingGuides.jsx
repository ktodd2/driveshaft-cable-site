import React from 'react'
import { Link } from 'react-router-dom'

export const BUYING_GUIDES = [
  { slug: 'standard-vs-xl-driveshaft-cable-choosing-length', title: 'Standard vs XL', description: 'Compare lengths and plan your cable quantities.' },
  { slug: '18mm-brake-caging-bolt-10-packs-ordering-fit', title: '18mm Bolt 10-Packs', description: 'Check compatibility and understand pack quantities.' },
  { slug: 'single-use-driveshaft-cables-stocking-your-kit', title: 'Stocking Your Cable Kit', description: 'Plan fresh cables, cutters and bolt packs.' },
]
export default function BuyingGuides() {
  return (
    <section aria-labelledby="buying-guides-heading" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <h2 id="buying-guides-heading" className="text-2xl font-industrial text-white mb-3">PRODUCT BUYING GUIDES</h2>
      <p className="text-gray-400 mb-6">Start with the questions that matter before you order.</p>
      <div className="grid sm:grid-cols-3 gap-4">
        {BUYING_GUIDES.map(guide => <Link key={guide.slug} to={`/blog/${guide.slug}`} className="surface p-5 hover:ring-yellow-500/60"><h3 className="text-xl font-industrial text-yellow-400 mb-2">{guide.title}</h3><p className="text-gray-300 text-sm">{guide.description}</p></Link>)}
      </div>
    </section>
  )
}
