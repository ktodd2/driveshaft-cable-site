import React from 'react'
import { optimizedImages } from '../../lib/optimizedImages'

export default function OptimizedImage({ src, width, height, ...props }) {
  const optimized = optimizedImages[src]
  const image = <img src={src} width={width || optimized?.width} height={height || optimized?.height} {...props} />
  return optimized ? <picture className="contents"><source srcSet={optimized.src} type="image/webp" />{image}</picture> : image
}
