import React from 'react'
import {createRoot} from 'react-dom/client'
import {BrowserRouter} from 'react-router-dom'
import Dashboard from '../../src/pages/admin/AdminDashboardPage'
import Analytics from '../../src/pages/admin/AdminAnalyticsPage'
import '../../src/index.css'
createRoot(document.getElementById('root')).render(<BrowserRouter>{location.search.includes('dashboard')?<Dashboard/>:<Analytics/>}</BrowserRouter>)
