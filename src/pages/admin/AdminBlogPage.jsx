import AdminNavigation from '../../components/admin/AdminNavigation'
import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

const TOTAL_TOPIC_SEEDS = 100

function AdminBlogPage() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [posts, setPosts] = useState([])
  const [generating, setGenerating] = useState(false)
  const [message, setMessage] = useState(null)

  useEffect(() => {
    checkAuth()
    loadPosts()
  }, [])

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      navigate('/admin/login')
      return
    }
    setUser(session.user)
    setLoading(false)
  }

  const loadPosts = async () => {
    const { data, error } = await supabase
      .from('blog_posts')
      .select('*')
      .order('created_at', { ascending: false })

    if (!error) setPosts(data || [])
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    navigate('/admin/login')
  }

  const handleGenerate = async () => {
    setGenerating(true)
    setMessage(null)

    const { data, error } = await supabase.functions.invoke('generate-blog-post', {
      body: { manual: true },
    })

    if (error) {
      setMessage({ type: 'error', text: `Generation failed: ${error.message}` })
    } else if (data?.error) {
      setMessage({ type: 'error', text: data.error })
    } else {
      setMessage({ type: 'success', text: `Generated: "${data.post?.title || 'New post'}"` })
      await loadPosts()
    }
    setGenerating(false)
  }

  const toggleStatus = async (post) => {
    const newStatus = post.status === 'published' ? 'draft' : 'published'
    const { error } = await supabase
      .from('blog_posts')
      .update({
        status: newStatus,
        updated_at: new Date().toISOString(),
        published_at: newStatus === 'published' ? new Date().toISOString() : post.published_at,
      })
      .eq('id', post.id)

    if (!error) await loadPosts()
  }

  const handleDelete = async (post) => {
    if (!confirm(`Delete "${post.title}"? This cannot be undone.`)) return

    const { error } = await supabase
      .from('blog_posts')
      .delete()
      .eq('id', post.id)

    if (!error) await loadPosts()
  }

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const usedTopics = posts.filter(p => p.topic_seed).length
  const topicsRemaining = TOTAL_TOPIC_SEEDS - usedTopics
  const publishedCount = posts.filter(p => p.status === 'published').length
  const draftCount = posts.filter(p => p.status === 'draft').length

  if (loading) {
    return (
      <div className="min-h-screen bg-ktodd-dark flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-ktodd-dark">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800">
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-4">
            <Link to="/admin" className="flex items-center gap-2">
              <img src="/logos/icon.png" alt="Driveshaft Cable" className="w-8 h-8 rounded" />
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
      </header>
      <AdminNavigation />

      <div className="flex">
        {/* Sidebar */}

        {/* Main Content */}
        <main className="flex-1 p-6 lg:p-8">
          <div className="max-w-6xl mx-auto">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
              <h1 className="text-3xl font-industrial text-white">BLOG MANAGEMENT</h1>
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="btn-primary flex items-center gap-2 disabled:opacity-50"
              >
                {generating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                    Generating...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Generate New Post
                  </>
                )}
              </button>
            </div>

            {/* Message */}
            {message && (
              <div className={`mb-6 p-4 border ${message.type === 'error' ? 'bg-red-500/10 border-red-500 text-red-400' : 'bg-green-500/10 border-green-500 text-green-400'}`}>
                {message.text}
              </div>
            )}

            {/* Stats Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <div className="bg-gray-800/50 border border-gray-700 p-4">
                <p className="text-gray-400 text-sm">Total Posts</p>
                <p className="text-2xl font-industrial text-white">{posts.length}</p>
              </div>
              <div className="bg-gray-800/50 border border-gray-700 p-4">
                <p className="text-gray-400 text-sm">Published</p>
                <p className="text-2xl font-industrial text-green-400">{publishedCount}</p>
              </div>
              <div className="bg-gray-800/50 border border-gray-700 p-4">
                <p className="text-gray-400 text-sm">Drafts</p>
                <p className="text-2xl font-industrial text-yellow-500">{draftCount}</p>
              </div>
              <div className="bg-gray-800/50 border border-gray-700 p-4">
                <p className="text-gray-400 text-sm">Topics Remaining</p>
                <p className="text-2xl font-industrial text-white">{topicsRemaining}</p>
              </div>
            </div>

            {/* Posts Table */}
            <div className="bg-gray-800/50 border border-gray-700">
              <div className="p-4 border-b border-gray-700">
                <h2 className="text-lg font-industrial text-yellow-500">ALL POSTS</h2>
              </div>

              {posts.length === 0 ? (
                <div className="p-8 text-center text-gray-400">
                  No blog posts yet. Click "Generate New Post" to create one.
                </div>
              ) : (
                <div className="divide-y divide-gray-700">
                  {posts.map((post) => (
                    <div key={post.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs font-bold uppercase px-2 py-0.5 ${
                            post.status === 'published'
                              ? 'bg-green-500/20 text-green-400'
                              : 'bg-gray-600/20 text-gray-400'
                          }`}>
                            {post.status}
                          </span>
                          <span className="text-xs text-gray-500 uppercase">
                            {post.category.replace('-', ' ')}
                          </span>
                        </div>
                        <h3 className="text-white font-bold truncate">{post.title}</h3>
                        <p className="text-gray-500 text-sm">
                          {formatDate(post.created_at)} · {post.reading_time_minutes} min read
                        </p>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        {post.status === 'published' && (
                          <a
                            href={`/blog/${post.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 text-sm text-gray-400 hover:text-white border border-gray-600 hover:border-gray-500 transition-colors"
                          >
                            View
                          </a>
                        )}
                        <button
                          onClick={() => toggleStatus(post)}
                          className={`px-3 py-1.5 text-sm font-bold transition-colors ${
                            post.status === 'published'
                              ? 'text-yellow-500 border border-yellow-500 hover:bg-yellow-500 hover:text-black'
                              : 'text-green-400 border border-green-500 hover:bg-green-500 hover:text-black'
                          }`}
                        >
                          {post.status === 'published' ? 'Unpublish' : 'Publish'}
                        </button>
                        <button
                          onClick={() => handleDelete(post)}
                          className="px-3 py-1.5 text-sm text-red-400 border border-red-500 hover:bg-red-500 hover:text-white transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

export default AdminBlogPage
