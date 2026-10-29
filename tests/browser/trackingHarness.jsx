// Test-only entrypoint served by the browser test's intercepted HTML route.
import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import AdminOrdersPage from '../../src/pages/admin/AdminOrdersPage'
import '../../src/index.css'
createRoot(document.getElementById('root')).render(<BrowserRouter><AdminOrdersPage /></BrowserRouter>)
