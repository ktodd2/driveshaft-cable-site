import React, { useEffect, useState, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { formatPrice } from '../../stores/cartStore'
import { useProductShipments } from '../../hooks/useProductShipments'
import { calcOrderProfit as calcOrderProfitShared } from '../../lib/costCalculations'
import Papa from 'papaparse'
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from 'recharts'

const COLORS = {
  revenue: '#eab308',
  profit: '#22c55e',
  loss: '#ef4444',
  shipping: '#3b82f6',
  stripe: '#a855f7',
  grid: '#374151',
  axisText: '#9ca3af',
  tooltipBg: '#1f2937',
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload) return null
  return (
    <div className="bg-gray-800 border border-gray-700 p-3 rounded shadow-lg">
      <p className="text-gray-400 text-sm mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="text-sm font-bold">
          {p.name}: {p.name.includes('Margin') ? `${p.value.toFixed(1)}%` : formatPrice(p.value)}
        </p>
      ))}
    </div>
  )
}

const CountTooltip = ({ active, payload, label }) => {
  if (!active || !payload) return null
  return (
    <div className="bg-gray-800 border border-gray-700 p-3 rounded shadow-lg">
      <p className="text-gray-400 text-sm mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="text-sm font-bold">
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  )
}

function AdminAnalyticsPage() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [orders, setOrders] = useState([])
  const [dateRange, setDateRange] = useState('30d')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const { shipments, avgCostPerUnit, loading: shipmentsLoading } = useProductShipments()
  const [fallbackShipping, setFallbackShipping] = useState(
    () => parseInt(localStorage.getItem('ktodd-admin-shipping-fallback') || '0')
  )
  const [exporting, setExporting] = useState(false)
  const reportRef = useRef(null)

  useEffect(() => {
    checkAuth()
    loadOrders()
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

  const loadOrders = async () => {
    const { data } = await supabase
      .from('orders')
      .select('*')
      .eq('payment_status', 'paid')
      .order('created_at', { ascending: true })
    setOrders(data || [])
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    navigate('/admin/login')
  }

  const handleFallbackShippingChange = (val) => {
    const n = parseInt(val) || 0
    setFallbackShipping(n)
    localStorage.setItem('ktodd-admin-shipping-fallback', String(n))
  }

  const getFilteredOrders = () => {
    const now = new Date()
    let startDate
    if (dateRange === '7d') startDate = new Date(now - 7 * 86400000)
    else if (dateRange === '30d') startDate = new Date(now - 30 * 86400000)
    else if (dateRange === '90d') startDate = new Date(now - 90 * 86400000)
    else if (dateRange === 'year') { startDate = new Date(now); startDate.setFullYear(startDate.getFullYear() - 1) }
    else if (dateRange === 'custom' && customStart) startDate = new Date(customStart)
    else return orders

    const endDate = (dateRange === 'custom' && customEnd) ? new Date(customEnd + 'T23:59:59') : now
    return orders.filter(o => { const d = new Date(o.created_at); return d >= startDate && d <= endDate })
  }

  const calcOrderProfit = (order) => {
    return calcOrderProfitShared(order, avgCostPerUnit, fallbackShipping)
  }

  const getPeriodKey = (date) => {
    if (dateRange === '7d' || dateRange === '30d') {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    } else if (dateRange === '90d') {
      const startOfYear = new Date(date.getFullYear(), 0, 1)
      const weekNum = Math.ceil(((date - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7)
      return `Week ${weekNum}`
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    }
  }

  const buildChartData = () => {
    const filtered = getFilteredOrders()
    const buckets = {}

    filtered.forEach(order => {
      const date = new Date(order.created_at)
      const key = getPeriodKey(date)
      const { units, profit } = calcOrderProfit(order)

      if (!buckets[key]) {
        buckets[key] = { date: key, revenue: 0, profit: 0, orders: 0, units: 0, _timestamp: date.getTime() }
      }
      buckets[key].revenue += order.total_cents
      buckets[key].profit += profit
      buckets[key].orders += 1
      buckets[key].units += units
    })

    return Object.values(buckets)
      .sort((a, b) => a._timestamp - b._timestamp)
      .map(({ _timestamp, ...rest }) => rest)
  }

  const buildMarginData = () => {
    return buildChartData().map(d => ({
      ...d,
      margin: d.revenue > 0 ? parseFloat(((d.profit / d.revenue) * 100).toFixed(1)) : 0
    }))
  }

  const buildPieData = () => {
    const filtered = getFilteredOrders()
    let totalProductCost = 0
    let totalShipping = 0
    let totalStripe = 0
    let totalProfit = 0

    filtered.forEach(order => {
      const { productCost, shippingCost, stripeFee, profit } = calcOrderProfit(order)
      totalProductCost += productCost
      totalShipping += shippingCost
      totalStripe += stripeFee
      totalProfit += profit
    })

    return [
      { name: 'Product Cost', value: Math.max(0, totalProductCost), color: COLORS.loss },
      { name: 'Shipping', value: Math.max(0, totalShipping), color: COLORS.shipping },
      { name: 'Stripe Fees', value: Math.max(0, totalStripe), color: COLORS.stripe },
      { name: 'Net Profit', value: Math.max(0, totalProfit), color: COLORS.profit },
    ].filter(d => d.value > 0)
  }

  const buildTopCustomers = () => {
    const filtered = getFilteredOrders()
    const customerMap = {}

    filtered.forEach(order => {
      const email = order.email || 'Unknown'
      const name = order.name || email
      if (!customerMap[email]) {
        customerMap[email] = { email, name, total: 0, orders: 0 }
      }
      customerMap[email].total += order.total_cents
      customerMap[email].orders += 1
    })

    return Object.values(customerMap)
      .sort((a, b) => b.total - a.total)
      .slice(0, 10)
      .map(c => ({ ...c, displayName: c.name.length > 20 ? c.name.slice(0, 18) + '…' : c.name }))
  }

  const getSummaryStats = () => {
    const filtered = getFilteredOrders()
    let totalRevenue = 0
    let totalProfit = 0
    let totalUnits = 0

    filtered.forEach(order => {
      const { units, profit } = calcOrderProfit(order)
      totalRevenue += order.total_cents
      totalProfit += profit
      totalUnits += units
    })

    const margin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0
    const avgOrder = filtered.length > 0 ? Math.round(totalRevenue / filtered.length) : 0

    return { totalRevenue, totalProfit, margin, orders: filtered.length, totalUnits, avgOrder }
  }

  const getDateRangeLabel = () => {
    if (dateRange === 'custom') return `${customStart} to ${customEnd}`
    if (dateRange === '7d') return 'Last 7 Days'
    if (dateRange === '30d') return 'Last 30 Days'
    if (dateRange === '90d') return 'Last 90 Days'
    if (dateRange === 'year') return 'Last Year'
    return 'All Time'
  }

  const triggerDownload = (content, filename, mimeType) => {
    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handleExportCSV = () => {
    const summary = getSummaryStats()
    const chartD = buildChartData()
    const marginD = buildMarginData()
    const pieD = buildPieData()
    const topCust = buildTopCustomers()
    const totalPieVal = pieD.reduce((s, d) => s + d.value, 0)

    const rows = []

    rows.push(['Analytics Report — ' + getDateRangeLabel()])
    rows.push([])

    rows.push(['Summary Statistics'])
    rows.push(['Metric', 'Value'])
    rows.push(['Revenue', formatPrice(summary.totalRevenue)])
    rows.push(['Net Profit', formatPrice(summary.totalProfit)])
    rows.push(['Margin %', `${summary.margin.toFixed(1)}%`])
    rows.push(['Orders', summary.orders])
    rows.push(['Units Sold', summary.totalUnits])
    rows.push(['Avg Order Value', formatPrice(summary.avgOrder)])
    rows.push([])

    rows.push(['Revenue & Profit by Period'])
    rows.push(['Date', 'Revenue', 'Profit', 'Orders', 'Units'])
    chartD.forEach(d => {
      rows.push([d.date, formatPrice(d.revenue), formatPrice(d.profit), d.orders, d.units])
    })
    rows.push([])

    rows.push(['Profit Margin by Period'])
    rows.push(['Date', 'Margin %'])
    marginD.forEach(d => {
      rows.push([d.date, `${d.margin.toFixed(1)}%`])
    })
    rows.push([])

    rows.push(['Cost Breakdown'])
    rows.push(['Category', 'Amount', 'Percentage'])
    pieD.forEach(d => {
      const pct = totalPieVal > 0 ? ((d.value / totalPieVal) * 100).toFixed(1) : '0.0'
      rows.push([d.name, formatPrice(d.value), `${pct}%`])
    })
    rows.push([])

    rows.push(['Top Customers by Spend'])
    rows.push(['Name', 'Email', 'Total Spend', 'Orders'])
    topCust.forEach(c => {
      rows.push([c.name, c.email, formatPrice(c.total), c.orders])
    })

    const csvString = Papa.unparse(rows)
    const dateStr = new Date().toISOString().split('T')[0]
    triggerDownload(csvString, `analytics-data-${dateRange}-${dateStr}.csv`, 'text/csv;charset=utf-8;')
  }

  const handleExportPDF = async () => {
    if (!reportRef.current) return
    setExporting(true)

    try {
      const html2canvas = (await import('html2canvas')).default
      const { jsPDF } = await import('jspdf')

      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#1A1A1A',
        logging: false,
        windowWidth: reportRef.current.scrollWidth,
      })

      const imgData = canvas.toDataURL('image/png')
      const imgWidth = canvas.width
      const imgHeight = canvas.height

      const pdf = new jsPDF({
        orientation: imgWidth > imgHeight ? 'landscape' : 'portrait',
        unit: 'mm',
        format: 'letter',
      })

      const pdfWidth = pdf.internal.pageSize.getWidth()
      const pdfHeight = pdf.internal.pageSize.getHeight()

      pdf.setFontSize(10)
      pdf.setTextColor(150, 150, 150)
      pdf.text(`Analytics Report — ${getDateRangeLabel()} — Generated ${new Date().toLocaleDateString()}`, 10, 8)

      const margin = 10
      const availableWidth = pdfWidth - margin * 2
      const scaledHeight = (imgHeight * availableWidth) / imgWidth
      const headerOffset = 12

      if (scaledHeight + headerOffset <= pdfHeight - margin) {
        pdf.addImage(imgData, 'PNG', margin, headerOffset, availableWidth, scaledHeight)
      } else {
        const pageContentHeight = pdfHeight - headerOffset - margin
        const sliceHeightInPx = (pageContentHeight / availableWidth) * imgWidth
        let yOffset = 0
        let page = 0

        while (yOffset < imgHeight) {
          if (page > 0) pdf.addPage()

          const sliceCanvas = document.createElement('canvas')
          sliceCanvas.width = imgWidth
          sliceCanvas.height = Math.min(sliceHeightInPx, imgHeight - yOffset)
          const ctx = sliceCanvas.getContext('2d')
          ctx.drawImage(canvas, 0, yOffset, imgWidth, sliceCanvas.height, 0, 0, imgWidth, sliceCanvas.height)

          const sliceData = sliceCanvas.toDataURL('image/png')
          const sliceScaledHeight = (sliceCanvas.height * availableWidth) / imgWidth
          pdf.addImage(sliceData, 'PNG', margin, page === 0 ? headerOffset : margin, availableWidth, sliceScaledHeight)

          yOffset += sliceHeightInPx
          page++
        }
      }

      const dateStr = new Date().toISOString().split('T')[0]
      pdf.save(`analytics-report-${dateRange}-${dateStr}.pdf`)
    } catch (err) {
      console.error('PDF export failed:', err)
      alert('PDF export failed. Please try again.')
    } finally {
      setExporting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-ktodd-dark flex items-center justify-center">
        <div className="text-yellow-500">Loading...</div>
      </div>
    )
  }

  const chartData = buildChartData()
  const marginData = buildMarginData()
  const pieData = buildPieData()
  const topCustomers = buildTopCustomers()
  const summary = getSummaryStats()
  const totalPie = pieData.reduce((s, d) => s + d.value, 0)

  return (
    <div className="min-h-screen bg-ktodd-dark">
      {/* Admin Header */}
      <header className="bg-ktodd-dark border-b border-gray-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <Link to="/" className="flex items-center gap-2">
                <div className="w-8 h-8 bg-yellow-500 rounded flex items-center justify-center">
                  <span className="text-black font-bold text-sm font-industrial">K</span>
                </div>
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
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 bg-gray-900 min-h-[calc(100vh-4rem)] border-r border-gray-800 hidden md:block">
          <nav className="p-4 space-y-2">
            <Link to="/admin" className="flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              Dashboard
            </Link>
            <Link to="/admin/orders" className="flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
              Orders
            </Link>
            <Link to="/admin/quotes" className="flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
              Quotes
            </Link>
            <Link to="/admin/email" className="flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Email Blast
            </Link>
            <Link to="/admin/analytics" className="flex items-center gap-3 px-4 py-3 text-yellow-500 bg-gray-800 rounded">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Analytics
            </Link>
            <div className="border-t border-gray-800 my-4"></div>
            <Link to="/" className="flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              View Website
            </Link>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6 lg:p-8">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-8">
              <h1 className="text-3xl font-industrial text-white">ANALYTICS</h1>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleExportCSV}
                  disabled={exporting}
                  className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white px-4 py-2 text-sm font-bold rounded border border-gray-700 transition-colors disabled:opacity-50"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Export CSV
                </button>
                <button
                  onClick={handleExportPDF}
                  disabled={exporting}
                  className="flex items-center gap-2 bg-yellow-500 hover:bg-yellow-400 text-black px-4 py-2 text-sm font-bold rounded transition-colors disabled:opacity-50"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  {exporting ? 'Generating...' : 'Export PDF'}
                </button>
              </div>
            </div>

            {/* Cost Settings */}
            <div className="bg-gray-800/50 border border-gray-700 p-6 mb-6">
              <h2 className="text-xl font-industrial text-yellow-500 mb-4">COST SETTINGS</h2>
              <div className="flex flex-wrap gap-6">
                <div>
                  <label className="text-gray-400 text-sm block mb-1">Weighted Avg Cost / Unit</label>
                  <div className="text-white text-lg font-bold">
                    {shipmentsLoading ? '...' : formatPrice(avgCostPerUnit)}
                  </div>
                  <Link to="/admin" className="text-yellow-500 text-xs hover:underline">
                    Manage shipments on Dashboard →
                  </Link>
                </div>
                <div>
                  <label className="text-gray-400 text-sm block mb-1">Fallback Shipping Per Order (cents)</label>
                  <input
                    type="number"
                    value={fallbackShipping}
                    onChange={e => handleFallbackShippingChange(e.target.value)}
                    className="bg-gray-900 border border-gray-700 text-white px-3 py-2 text-sm rounded w-40"
                    placeholder="e.g. 800"
                  />
                  <span className="text-gray-500 text-xs ml-2">{formatPrice(fallbackShipping)} per order</span>
                </div>
              </div>
            </div>

            {/* Date Range Picker */}
            <div className="flex flex-wrap items-center gap-2 mb-8">
              {['7d', '30d', '90d', 'year', 'all'].map(range => (
                <button key={range} onClick={() => setDateRange(range)}
                  className={`px-4 py-2 text-sm font-bold rounded ${dateRange === range ? 'bg-yellow-500 text-black' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
                  {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : range === '90d' ? '90 Days' : range === 'year' ? '1 Year' : 'All Time'}
                </button>
              ))}
              <div className="flex items-center gap-2 ml-4">
                <input type="date" value={customStart} onChange={e => { setCustomStart(e.target.value); setDateRange('custom') }}
                  className="bg-gray-800 border border-gray-700 text-white px-3 py-2 text-sm rounded" />
                <span className="text-gray-500">to</span>
                <input type="date" value={customEnd} onChange={e => { setCustomEnd(e.target.value); setDateRange('custom') }}
                  className="bg-gray-800 border border-gray-700 text-white px-3 py-2 text-sm rounded" />
              </div>
            </div>

            {/* Exportable Report Content */}
            <div ref={reportRef} style={{ backgroundColor: '#1A1A1A' }}>

            {/* Summary Cards */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              <div className="bg-gray-800/50 border border-gray-700 p-6">
                <div className="text-gray-400 text-sm mb-1">Revenue</div>
                <div className="text-3xl font-industrial text-green-400">{formatPrice(summary.totalRevenue)}</div>
              </div>
              <div className="bg-gray-800/50 border border-gray-700 p-6">
                <div className="text-gray-400 text-sm mb-1">Net Profit</div>
                <div className={`text-3xl font-industrial ${summary.totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {formatPrice(summary.totalProfit)}
                </div>
              </div>
              <div className="bg-gray-800/50 border border-gray-700 p-6">
                <div className="text-gray-400 text-sm mb-1">Margin %</div>
                <div className={`text-3xl font-industrial ${summary.margin > 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {summary.margin.toFixed(1)}%
                </div>
              </div>
              <div className="bg-gray-800/50 border border-gray-700 p-6">
                <div className="text-gray-400 text-sm mb-1">Orders</div>
                <div className="text-3xl font-industrial text-white">{summary.orders}</div>
              </div>
              <div className="bg-gray-800/50 border border-gray-700 p-6">
                <div className="text-gray-400 text-sm mb-1">Units Sold</div>
                <div className="text-3xl font-industrial text-white">{summary.totalUnits}</div>
              </div>
              <div className="bg-gray-800/50 border border-gray-700 p-6">
                <div className="text-gray-400 text-sm mb-1">Avg Order Value</div>
                <div className="text-3xl font-industrial text-white">{formatPrice(summary.avgOrder)}</div>
              </div>
            </div>

            {/* Revenue & Profit Trend — full width */}
            <div className="bg-gray-800/50 border border-gray-700 p-6 mb-6">
              <h3 className="text-lg font-industrial text-yellow-500 mb-4">REVENUE & PROFIT TREND</h3>
              {chartData.length === 0 ? (
                <div className="flex items-center justify-center h-64 text-gray-500">No data for selected period</div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={COLORS.revenue} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={COLORS.revenue} stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={COLORS.profit} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={COLORS.profit} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} />
                    <XAxis dataKey="date" tick={{ fill: COLORS.axisText, fontSize: 12 }} />
                    <YAxis tick={{ fill: COLORS.axisText, fontSize: 12 }} tickFormatter={v => formatPrice(v)} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ color: COLORS.axisText }} />
                    <Area type="monotone" dataKey="revenue" name="Revenue" stroke={COLORS.revenue} fill="url(#revenueGrad)" strokeWidth={2} />
                    <Area type="monotone" dataKey="profit" name="Profit" stroke={COLORS.profit} fill="url(#profitGrad)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* 2-column grid for remaining charts */}
            <div className="grid lg:grid-cols-2 gap-6 mb-6">

              {/* Orders Per Period */}
              <div className="bg-gray-800/50 border border-gray-700 p-6">
                <h3 className="text-lg font-industrial text-yellow-500 mb-4">ORDERS PER PERIOD</h3>
                {chartData.length === 0 ? (
                  <div className="flex items-center justify-center h-64 text-gray-500">No data for selected period</div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} />
                      <XAxis dataKey="date" tick={{ fill: COLORS.axisText, fontSize: 12 }} />
                      <YAxis tick={{ fill: COLORS.axisText, fontSize: 12 }} allowDecimals={false} />
                      <Tooltip content={<CountTooltip />} />
                      <Bar dataKey="orders" name="Orders" fill={COLORS.revenue} radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Units Sold Trend */}
              <div className="bg-gray-800/50 border border-gray-700 p-6">
                <h3 className="text-lg font-industrial text-yellow-500 mb-4">UNITS SOLD TREND</h3>
                {chartData.length === 0 ? (
                  <div className="flex items-center justify-center h-64 text-gray-500">No data for selected period</div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} />
                      <XAxis dataKey="date" tick={{ fill: COLORS.axisText, fontSize: 12 }} />
                      <YAxis tick={{ fill: COLORS.axisText, fontSize: 12 }} allowDecimals={false} />
                      <Tooltip content={<CountTooltip />} />
                      <Line type="monotone" dataKey="units" name="Units" stroke={COLORS.revenue} strokeWidth={2} dot={{ fill: COLORS.revenue, r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Profit Margin Over Time */}
              <div className="bg-gray-800/50 border border-gray-700 p-6">
                <h3 className="text-lg font-industrial text-yellow-500 mb-4">PROFIT MARGIN OVER TIME</h3>
                {marginData.length === 0 ? (
                  <div className="flex items-center justify-center h-64 text-gray-500">No data for selected period</div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={marginData}>
                      <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} />
                      <XAxis dataKey="date" tick={{ fill: COLORS.axisText, fontSize: 12 }} />
                      <YAxis tick={{ fill: COLORS.axisText, fontSize: 12 }} tickFormatter={v => `${v}%`} />
                      <Tooltip content={<CustomTooltip />} />
                      <Line type="monotone" dataKey="margin" name="Margin" stroke={COLORS.profit} strokeWidth={2} dot={{ fill: COLORS.profit, r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Cost Breakdown Pie Chart */}
              <div className="bg-gray-800/50 border border-gray-700 p-6">
                <h3 className="text-lg font-industrial text-yellow-500 mb-4">COST BREAKDOWN</h3>
                {pieData.length === 0 ? (
                  <div className="flex items-center justify-center h-64 text-gray-500">No data for selected period</div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        dataKey="value"
                        label={({ name, value }) => `${name}: ${totalPie > 0 ? ((value / totalPie) * 100).toFixed(0) : 0}% (${formatPrice(value)})`}
                        labelLine={true}
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => formatPrice(value)} contentStyle={{ backgroundColor: COLORS.tooltipBg, border: `1px solid ${COLORS.grid}`, color: '#fff' }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>

            </div>

            {/* Top Customers — full width horizontal bar chart */}
            <div className="bg-gray-800/50 border border-gray-700 p-6 mb-6">
              <h3 className="text-lg font-industrial text-yellow-500 mb-4">TOP CUSTOMERS BY SPEND</h3>
              {topCustomers.length === 0 ? (
                <div className="flex items-center justify-center h-64 text-gray-500">No data for selected period</div>
              ) : (
                <ResponsiveContainer width="100%" height={Math.max(250, topCustomers.length * 40)}>
                  <BarChart data={topCustomers} layout="vertical" margin={{ left: 20, right: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} horizontal={false} />
                    <XAxis type="number" tick={{ fill: COLORS.axisText, fontSize: 12 }} tickFormatter={v => formatPrice(v)} />
                    <YAxis type="category" dataKey="displayName" tick={{ fill: COLORS.axisText, fontSize: 12 }} width={130} />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload) return null
                        const item = topCustomers.find(c => c.displayName === label || c.name === label)
                        return (
                          <div className="bg-gray-800 border border-gray-700 p-3 rounded shadow-lg">
                            <p className="text-white text-sm font-bold mb-1">{item?.name || label}</p>
                            <p className="text-gray-400 text-xs mb-1">{item?.email}</p>
                            {payload.map((p, i) => (
                              <p key={i} style={{ color: p.color }} className="text-sm font-bold">
                                Total Spend: {formatPrice(p.value)}
                              </p>
                            ))}
                            <p className="text-gray-400 text-xs mt-1">{item?.orders} order{item?.orders !== 1 ? 's' : ''}</p>
                          </div>
                        )
                      }}
                    />
                    <Bar dataKey="total" name="Total Spend" fill={COLORS.revenue} radius={[0, 2, 2, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            </div>{/* End exportable report content */}

          </div>
        </main>
      </div>
    </div>
  )
}

export default AdminAnalyticsPage
