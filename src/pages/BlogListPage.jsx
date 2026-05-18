import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import SEOHead from '../components/common/SEOHead'
import AdSlot from '../components/ads/AdSlot'

const CATEGORIES = [
  { value: 'all', label: 'All' },
  { value: 'safety', label: 'Safety' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'driveline', label: 'Driveline' },
  { value: 'tips', label: 'Tips' },
  { value: 'regulations', label: 'Regulations' },
  { value: 'industry-news', label: 'Industry News' },
]

const POSTS_PER_PAGE = 12

function BlogListPage() {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState('all')
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)

  useEffect(() => {
    const fetchPosts = async () => {
      setLoading(true)
      let query = supabase
        .from('blog_posts')
        .select('id, title, slug, excerpt, category, tags, published_at, reading_time_minutes')
        .eq('status', 'published')
        .order('published_at', { ascending: false })
        .range(page * POSTS_PER_PAGE, (page + 1) * POSTS_PER_PAGE)

      if (category !== 'all') {
        query = query.eq('category', category)
      }

      const { data, error } = await query

      if (!error) {
        setPosts(data || [])
        setHasMore((data || []).length > POSTS_PER_PAGE)
      }
      setLoading(false)
    }

    fetchPosts()
  }, [category, page])

  const handleCategoryChange = (cat) => {
    setCategory(cat)
    setPage(0)
  }

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  const categoryColor = (cat) => {
    const colors = {
      safety: 'bg-red-500/20 text-red-400 border-red-500/30',
      equipment: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      driveline: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      tips: 'bg-green-500/20 text-green-400 border-green-500/30',
      regulations: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
      'industry-news': 'bg-orange-500/20 text-orange-400 border-orange-500/30',
      general: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    }
    return colors[cat] || colors.general
  }

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    name: 'Driveshaft Cable Towing & Recovery Blog',
    description: 'Expert tips, industry news, and safety guides for heavy duty towing and recovery professionals.',
    url: 'https://driveshaftcable.com/blog',
    publisher: {
      '@type': 'Organization',
      name: 'Driveshaft Cable',
    },
  }

  return (
    <div className="pt-20">
      <SEOHead
        title="Towing & Recovery Blog | Driveshaft Cable"
        description="Expert tips, industry news, and safety guides for heavy duty towing and recovery professionals. Stay informed with Driveshaft Cable."
        keywords="heavy duty towing blog, tow truck tips, towing safety, recovery techniques, driveshaft cable, towing industry news"
        canonical="/blog"
        ogImage="https://driveshaftcable.com/og-blog.jpg"
        structuredData={structuredData}
      />

      {/* Hero Section */}
      <section className="py-20 bg-gradient-to-b from-ktodd-dark to-ktodd-charcoal">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-industrial text-white mb-4">
            TOWING & RECOVERY <span className="text-yellow-500">BLOG</span>
          </h1>
          <div className="w-24 h-1 bg-yellow-500 mx-auto mb-6"></div>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Expert tips, industry news, and safety guides for heavy duty towing professionals.
          </p>
        </div>
      </section>

      {/* Category Filters */}
      <section className="bg-ktodd-charcoal border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.value}
                onClick={() => handleCategoryChange(cat.value)}
                className={`px-4 py-2 text-sm font-bold uppercase tracking-wider transition-all duration-300 ${
                  category === cat.value
                    ? 'bg-yellow-500 text-black'
                    : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Posts Grid */}
      <section className="py-16 bg-ktodd-charcoal">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {loading ? (
            <div className="flex justify-center py-20">
              <div className="w-8 h-8 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-gray-400 text-lg">No blog posts yet. Check back soon!</p>
            </div>
          ) : (
            <>
              {/* First 6 posts */}
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {posts.slice(0, Math.min(6, POSTS_PER_PAGE)).map((post) => (
                  <Link
                    key={post.id}
                    to={`/blog/${post.slug}`}
                    className="group bg-gray-800/50 border border-gray-700 hover:border-yellow-500/50 transition-all duration-300"
                  >
                    <div className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <span className={`text-xs font-bold uppercase tracking-wider px-2 py-1 border ${categoryColor(post.category)}`}>
                          {post.category.replace('-', ' ')}
                        </span>
                        <span className="text-gray-500 text-xs">
                          {post.reading_time_minutes} min read
                        </span>
                      </div>

                      <h2 className="text-lg font-bold text-white group-hover:text-yellow-500 transition-colors mb-3 line-clamp-2">
                        {post.title}
                      </h2>

                      <p className="text-gray-400 text-sm mb-4 line-clamp-3">
                        {post.excerpt}
                      </p>

                      <div className="flex items-center justify-between">
                        <span className="text-gray-500 text-xs">
                          {formatDate(post.published_at)}
                        </span>
                        <span className="text-yellow-500 text-sm font-bold uppercase tracking-wider group-hover:translate-x-1 transition-transform">
                          Read More →
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>

              {/* Ad slot between card rows */}
              {posts.length > 6 && (
                <AdSlot slot="BLOG_LIST_SLOT" format="horizontal" className="my-6" />
              )}

              {/* Remaining posts */}
              {posts.length > 6 && (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {posts.slice(6, POSTS_PER_PAGE).map((post) => (
                    <Link
                      key={post.id}
                      to={`/blog/${post.slug}`}
                      className="group bg-gray-800/50 border border-gray-700 hover:border-yellow-500/50 transition-all duration-300"
                    >
                      <div className="p-6">
                        <div className="flex items-center justify-between mb-4">
                          <span className={`text-xs font-bold uppercase tracking-wider px-2 py-1 border ${categoryColor(post.category)}`}>
                            {post.category.replace('-', ' ')}
                          </span>
                          <span className="text-gray-500 text-xs">
                            {post.reading_time_minutes} min read
                          </span>
                        </div>

                        <h2 className="text-lg font-bold text-white group-hover:text-yellow-500 transition-colors mb-3 line-clamp-2">
                          {post.title}
                        </h2>

                        <p className="text-gray-400 text-sm mb-4 line-clamp-3">
                          {post.excerpt}
                        </p>

                        <div className="flex items-center justify-between">
                          <span className="text-gray-500 text-xs">
                            {formatDate(post.published_at)}
                          </span>
                          <span className="text-yellow-500 text-sm font-bold uppercase tracking-wider group-hover:translate-x-1 transition-transform">
                            Read More →
                          </span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}

              {/* Pagination */}
              <div className="flex justify-center gap-4 mt-12">
                {page > 0 && (
                  <button
                    onClick={() => setPage(p => p - 1)}
                    className="px-6 py-3 bg-gray-800 text-white hover:bg-gray-700 font-bold uppercase tracking-wider transition-colors"
                  >
                    ← Previous
                  </button>
                )}
                {hasMore && (
                  <button
                    onClick={() => setPage(p => p + 1)}
                    className="px-6 py-3 bg-yellow-500 text-black hover:bg-yellow-400 font-bold uppercase tracking-wider transition-colors"
                  >
                    Next →
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-ktodd-dark">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl sm:text-3xl font-industrial text-white mb-4">
            PROTECT YOUR <span className="text-yellow-500">DRIVESHAFT</span>
          </h2>
          <p className="text-gray-400 mb-8">
            Driveshaft Cable — built by a heavy duty operator for heavy duty operators.
          </p>
          <Link to="/products/driveshaft-cable" className="btn-primary">
            Shop Driveshaft Cable
          </Link>
        </div>
      </section>
    </div>
  )
}

export default BlogListPage
