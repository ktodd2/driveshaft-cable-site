import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { readPublicSnapshot } from './ssg/bootstrap'
import { seedStorefrontPricing } from './stores/cartStore'

const root = document.getElementById('root')
const initialData = readPublicSnapshot(document, window.location.pathname)
if (initialData) seedStorefrontPricing(initialData.products)
const app = <React.StrictMode><App initialData={initialData} /></React.StrictMode>
if (initialData && root.hasChildNodes()) ReactDOM.hydrateRoot(root, app)
else ReactDOM.createRoot(root).render(app)
