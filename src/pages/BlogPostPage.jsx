import React, { useState, useEffect, useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import { supabase } from '../lib/supabase'
import SEOHead from '../components/common/SEOHead'
import AdSlot from '../components/ads/AdSlot'
import InlineNewsletterCTA from '../components/newsletter/InlineNewsletterCTA'

function BlogPostPage() {
  const { slug } = useParams()
  const [post, setPost] = useState(null)
  const [relatedPosts, setRelatedPosts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchPost = async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('blog_posts')
        .select('*')
        .eq('slug', slug)
        .eq('status', 'published')
        .single()

      if (!error && data) {
        setPost(data)

        // Fetch related posts (same category, exclude current)
        const { data: related } = await supabase
          .from('blog_posts')
          .select('id, title, slug, excerpt, category, published_at, reading_time_minutes')
          .eq('status', 'published')
          .eq('category', data.category)
          .neq('id', data.id)
          .order('published_at', { ascending: false })
          .limit(3)

        if (related) setRelatedPosts(related)
      }
      setLoading(false)
    }

    fetchPost()
    window.scrollTo(0, 0)
  }, [slug])

  // Split content at ~40% for mid-article newsletter CTA
  const [contentBefore, contentAfter] = useMemo(() => {
    if (!post?.content) return ['', '']
    const paragraphs = post.content.split('\n\n')
    const splitAt = Math.max(2, Math.floor(paragraphs.length * 0.4))
    return [
      paragraphs.slice(0, splitAt).join('\n\n'),
      paragraphs.slice(splitAt).join('\n\n'),
    ]
  }, [post?.content])

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

  if (loading) {
    return (
      <div className="pt-24 md:pt-32 min-h-screen bg-ktodd-dark">
        <div className="flex justify-center py-40">
          <div className="w-8 h-8 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    )
  }

  if (!post) {
    return (
      <div className="pt-24 md:pt-32 min-h-screen bg-ktodd-dark">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
          <h1 className="text-3xl font-industrial text-white mb-4">POST NOT FOUND</h1>
          <p className="text-gray-400 mb-8">This blog post doesn't exist or has been removed.</p>
          <Link to="/blog" className="btn-primary">Back to Blog</Link>
        </div>
      </div>
    )
  }

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.meta_description || post.excerpt,
    datePublished: post.published_at,
    dateModified: post.updated_at,
    author: {
      '@type': 'Organization',
      name: 'Driveshaft Cable',
    },
    publisher: {
      '@type': 'Organization',
      name: 'Driveshaft Cable',
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `https://driveshaftcable.com/blog/${post.slug}`,
    },
  }

  return (
    <div className="pt-24 md:pt-32">
      <SEOHead
        title={`${post.title} | Driveshaft Cable`}
        description={post.meta_description || post.excerpt}
        keywords={post.tags ? post.tags.join(', ') : 'heavy duty towing, towing tips'}
        canonical={`/blog/${post.slug}`}
        ogImage="https://driveshaftcable.com/og-blog.jpg"
        structuredData={structuredData}
      />

      {/* Article Header */}
      <section className="py-16 bg-gradient-to-b from-ktodd-dark to-ktodd-charcoal">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link to="/blog" className="inline-flex items-center text-yellow-500 hover:text-yellow-400 transition-colors mb-8 text-sm font-bold uppercase tracking-wider">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Blog
          </Link>

          <div className="flex items-center gap-3 mb-4">
            <span className={`text-xs font-bold uppercase tracking-wider px-2 py-1 border ${categoryColor(post.category)}`}>
              {post.category.replace('-', ' ')}
            </span>
            <span className="text-gray-500 text-sm">{post.reading_time_minutes} min read</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-industrial text-white mb-4">
            {post.title}
          </h1>

          <p className="text-gray-400">
            Published {formatDate(post.published_at)}
          </p>
        </div>
      </section>

      {/* Article Content */}
      <section className="py-12 bg-ktodd-charcoal">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <article className="prose prose-invert prose-yellow max-w-none
            prose-headings:font-industrial prose-headings:text-white
            prose-h2:text-2xl prose-h2:mt-10 prose-h2:mb-4 prose-h2:text-yellow-500
            prose-h3:text-xl prose-h3:mt-8 prose-h3:mb-3
            prose-p:text-gray-300 prose-p:leading-relaxed prose-p:mb-4
            prose-li:text-gray-300
            prose-strong:text-white
            prose-a:text-yellow-500 prose-a:no-underline hover:prose-a:text-yellow-400
          ">
            <ReactMarkdown>{contentBefore}</ReactMarkdown>
          </article>

          {/* Mid-article newsletter CTA */}
          <InlineNewsletterCTA />

          <article className="prose prose-invert prose-yellow max-w-none
            prose-headings:font-industrial prose-headings:text-white
            prose-h2:text-2xl prose-h2:mt-10 prose-h2:mb-4 prose-h2:text-yellow-500
            prose-h3:text-xl prose-h3:mt-8 prose-h3:mb-3
            prose-p:text-gray-300 prose-p:leading-relaxed prose-p:mb-4
            prose-li:text-gray-300
            prose-strong:text-white
            prose-a:text-yellow-500 prose-a:no-underline hover:prose-a:text-yellow-400
          ">
            <ReactMarkdown>{contentAfter}</ReactMarkdown>
          </article>

          {/* Tags */}
          {post.tags && post.tags.length > 0 && (
            <div className="mt-12 pt-8 border-t border-gray-700">
              <div className="flex flex-wrap gap-2">
                {post.tags.map((tag) => (
                  <span key={tag} className="px-3 py-1 bg-gray-800 text-gray-400 text-sm border border-gray-700">
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Ad slot — after article content */}
          <AdSlot slot="AFTER_CONTENT_SLOT" format="horizontal" className="mt-8" />
        </div>
      </section>

      {/* Ad slot — between content and related posts */}
      <div className="bg-ktodd-dark py-6">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <AdSlot slot="MID_PAGE_SLOT" format="auto" />
        </div>
      </div>

      {/* Related Posts */}
      {relatedPosts.length > 0 && (
        <section className="py-16 bg-ktodd-dark">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-industrial text-white mb-8">
              RELATED <span className="text-yellow-500">POSTS</span>
            </h2>
            <div className="grid md:grid-cols-3 gap-6">
              {relatedPosts.map((related) => (
                <Link
                  key={related.id}
                  to={`/blog/${related.slug}`}
                  className="group bg-gray-800/50 border border-gray-700 hover:border-yellow-500/50 transition-all duration-300 p-6"
                >
                  <span className={`text-xs font-bold uppercase tracking-wider px-2 py-1 border ${categoryColor(related.category)}`}>
                    {related.category.replace('-', ' ')}
                  </span>
                  <h3 className="text-white font-bold mt-3 mb-2 group-hover:text-yellow-500 transition-colors line-clamp-2">
                    {related.title}
                  </h3>
                  <p className="text-gray-400 text-sm line-clamp-2">{related.excerpt}</p>
                  <span className="text-gray-500 text-xs mt-3 block">{formatDate(related.published_at)}</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA Section */}
      <section className="py-16 bg-ktodd-charcoal border-t border-gray-700">
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

export default BlogPostPage
