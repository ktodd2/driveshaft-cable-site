import React, { useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'

// Drag-and-drop / click-to-pick image uploader backed by Supabase Storage.
// `value` is the current array of public image URLs; `onChange(nextUrls)`
// fires whenever the gallery changes (upload finished, reorder, delete).
// First image is the storefront thumbnail; full array is the detail-page
// gallery in order.
//
// Bucket: 'product-images'. Files land at `${productId}/${rand}.${ext}`
// so each product's photos are namespaced. Old products that pre-date this
// uploader can still have / paths (e.g. '/inuse.jpeg') in their array —
// we don't delete those when removed, only objects under the bucket.

const BUCKET = 'product-images'

function randSuffix() {
  return Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4)
}

function extOf(name) {
  const m = /\.([a-z0-9]+)$/i.exec(name || '')
  return m ? m[1].toLowerCase() : 'jpg'
}

// If a URL is a Supabase Storage object inside our bucket, return its
// path so we can delete it; otherwise return null (e.g. legacy /public/
// paths that we shouldn't delete from disk).
function storagePathOf(url) {
  if (!url) return null
  const marker = `/storage/v1/object/public/${BUCKET}/`
  const idx = url.indexOf(marker)
  if (idx === -1) return null
  return url.slice(idx + marker.length)
}

export default function ImageUploader({ value = [], onChange, productId, disabled = false }) {
  const inputRef = useRef(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)
  const [dragOver, setDragOver] = useState(false)

  const updateImages = (next) => onChange?.(next)

  const handleFiles = async (files) => {
    if (!files || files.length === 0) return
    if (!productId) {
      setError('Save the product ID first so uploads can be namespaced to it.')
      return
    }
    setError(null)
    setUploading(true)
    const added = []
    for (const file of files) {
      try {
        const path = `${productId}/${randSuffix()}.${extOf(file.name)}`
        const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(path, file, { cacheControl: '3600', upsert: false })
        if (uploadError) {
          console.error('ImageUploader: upload failed', uploadError)
          setError(uploadError.message || 'Upload failed.')
          continue
        }
        const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
        if (data?.publicUrl) added.push(data.publicUrl)
      } catch (err) {
        console.error('ImageUploader: unexpected error', err)
        setError((err && err.message) || 'Upload failed.')
      }
    }
    if (added.length) updateImages([...value, ...added])
    setUploading(false)
    if (inputRef.current) inputRef.current.value = ''
  }

  const onPick = (e) => handleFiles(e.target.files)

  const onDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    handleFiles(e.dataTransfer?.files)
  }

  const moveImage = (idx, delta) => {
    const next = [...value]
    const target = idx + delta
    if (target < 0 || target >= next.length) return
    ;[next[idx], next[target]] = [next[target], next[idx]]
    updateImages(next)
  }

  const removeImage = async (idx) => {
    const url = value[idx]
    const next = value.filter((_, i) => i !== idx)
    updateImages(next)
    // Best-effort: if it's a storage-bucket object, also delete the file.
    // Legacy /public/ paths (no bucket prefix) just drop from the array.
    const path = storagePathOf(url)
    if (path) {
      const { error: delError } = await supabase.storage.from(BUCKET).remove([path])
      if (delError) console.warn('ImageUploader: failed to delete storage object', delError)
    }
  }

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`border-2 border-dashed rounded p-4 text-center cursor-pointer transition-colors ${
          dragOver ? 'border-yellow-500 bg-yellow-500/5' : 'border-gray-600 bg-gray-800/30 hover:bg-gray-800/50'
        } ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
        onClick={() => inputRef.current?.click()}
      >
        <p className="text-gray-300 text-sm">
          {uploading ? 'Uploading...' : 'Drop images here or click to pick'}
        </p>
        <p className="text-gray-500 text-xs mt-1">PNG / JPG / WEBP — first image is the product thumbnail</p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={onPick}
          className="hidden"
          disabled={disabled || uploading}
        />
      </div>

      {error && (
        <div className="mt-2 bg-red-500/10 border border-red-500/40 px-3 py-2 rounded text-red-400 text-xs">
          {error}
        </div>
      )}

      {value.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 mt-4">
          {value.map((url, idx) => (
            <div key={url + idx} className="relative group border border-gray-700 rounded overflow-hidden bg-gray-900">
              <img src={url} alt={`Product image ${idx + 1}`} className="w-full h-24 object-cover" />
              <div className="absolute top-1 left-1 bg-black/70 text-white text-xs font-mono px-1.5 rounded">
                {idx + 1}
              </div>
              <div className="absolute bottom-1 left-1 right-1 flex justify-between gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); moveImage(idx, -1) }}
                    disabled={idx === 0}
                    className="bg-black/70 hover:bg-black/90 text-white text-xs px-1.5 rounded disabled:opacity-30"
                    title="Move up"
                  >↑</button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); moveImage(idx, 1) }}
                    disabled={idx === value.length - 1}
                    className="bg-black/70 hover:bg-black/90 text-white text-xs px-1.5 rounded disabled:opacity-30"
                    title="Move down"
                  >↓</button>
                </div>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); removeImage(idx) }}
                  className="bg-red-500/80 hover:bg-red-500 text-white text-xs px-1.5 rounded"
                  title="Remove"
                >✕</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
