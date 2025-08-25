import React, { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabaseClient'
import { Users, UserPlus, Edit2, Trash2, Search, Phone, MapPin, Filter, ChevronLeft, ChevronRight, Download } from 'lucide-react'

const MemberManagement = () => {
  const [members, setMembers] = useState([])
  const [visitors, setVisitors] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [activeTab, setActiveTab] = useState('members')
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [sortBy, setSortBy] = useState('name')
  const [sortDir, setSortDir] = useState('asc')
  const [totalCount, setTotalCount] = useState(0)
  // Filters
  const [churchFilter, setChurchFilter] = useState('')
  const [howHeardFilter, setHowHeardFilter] = useState('')
  const [phoneMode, setPhoneMode] = useState('contains') // 'contains' | 'starts'
  const [dateFrom, setDateFrom] = useState('') // yyyy-mm-dd
  const [dateTo, setDateTo] = useState('')
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    church: '',
    howHeard: ''
  })

  const howHeardOptions = ['Friend', 'Social Media', 'Evangelism', 'Invitation', 'Other']

  // Debounce search input
  const [debouncedSearch, setDebouncedSearch] = useState(searchTerm)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm), 300)
    return () => clearTimeout(t)
  }, [searchTerm])

  useEffect(() => {
    fetchData()
  }, [activeTab, page, pageSize, sortBy, sortDir, debouncedSearch, churchFilter, howHeardFilter, phoneMode, dateFrom, dateTo])

  const fetchData = async () => {
    setLoading(true)
    setErrorMsg('')
    try {
      const table = activeTab === 'members' ? 'members' : 'visitors'
      const from = (page - 1) * pageSize
      const to = from + pageSize - 1

      let query = supabase
        .from(table)
        .select('*', { count: 'exact', head: false })
        .order(sortBy, { ascending: sortDir === 'asc' })
        .range(from, to)

      if (debouncedSearch?.trim()) {
        const s = debouncedSearch.trim()
        const phoneExpr = phoneMode === 'starts' ? `phone.ilike.${s}%` : `phone.ilike.%${s}%`
        query = query.or(`name.ilike.%${s}%,${phoneExpr},church.ilike.%${s}%`)
      }

      if (churchFilter.trim()) {
        query = query.ilike('church', `%${churchFilter.trim()}%`)
      }

      if (activeTab === 'visitors' && howHeardFilter) {
        query = query.eq('how_heard', howHeardFilter)
      }

      if (dateFrom) {
        query = query.gte('created_at', new Date(dateFrom).toISOString())
      }
      if (dateTo) {
        // include entire day
        const to = new Date(dateTo)
        to.setHours(23,59,59,999)
        query = query.lte('created_at', to.toISOString())
      }

      const { data, error, count } = await query
      if (error) throw error

      if (activeTab === 'members') setMembers(data || [])
      else setVisitors(data || [])
      setTotalCount(count || 0)
    } catch (error) {
      console.error('Error fetching data:', error)
      setErrorMsg(error?.message || 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      const table = activeTab === 'members' ? 'members' : 'visitors'
      // Normalize phone: strip non-digits
      const normalizedPhone = (formData.phone || '').replace(/\D/g, '')
      const data = {
        name: formData.name,
        phone: normalizedPhone,
        church: formData.church,
        ...(activeTab === 'visitors' && { how_heard: formData.howHeard })
      }

      if (editingItem) {
        const { error } = await supabase
          .from(table)
          .update(data)
          .eq('id', editingItem.id)
        
        if (error) throw error
      } else {
        const { error } = await supabase
          .from(table)
          .insert(data)
        if (error) {
          // Handle unique phone violation gracefully
          if (error.code === '23505') {
            throw new Error('A record with this phone already exists. Try searching and editing it instead.')
          }
          throw error
        }
      }

      await fetchData()
      resetForm()
    } catch (error) {
      console.error('Error saving data:', error)
      alert(error?.message || 'Error saving data. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (item) => {
    setEditingItem(item)
    setFormData({
      name: item.name,
      phone: item.phone,
      church: item.church,
      howHeard: item.how_heard || ''
    })
    setShowAddForm(true)
  }

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this record?')) return

    setLoading(true)
    try {
      const table = activeTab === 'members' ? 'members' : 'visitors'
      const { error } = await supabase
        .from(table)
        .delete()
        .eq('id', id)

      if (error) throw error
      await fetchData()
    } catch (error) {
      console.error('Error deleting data:', error)
      alert('Error deleting record. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({ name: '', phone: '', church: '', howHeard: '' })
    setEditingItem(null)
    setShowAddForm(false)
  }

  const currentData = activeTab === 'members' ? members : visitors
  const pageCount = Math.max(1, Math.ceil((totalCount || 0) / pageSize))
  const onHeaderClick = (col) => {
    if (sortBy === col) setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'))
    else { setSortBy(col); setSortDir('asc') }
  }

  // Prevent Enter key from submitting any surrounding form inadvertently
  const preventEnterSubmit = (e) => {
    if (e.key === 'Enter') e.preventDefault()
  }

  if (loading && !showAddForm) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Member Management</h2>
          <p className="text-gray-600 mt-1">Manage church members and visitors</p>
        </div>
        <div className="mt-4 sm:mt-0 flex items-center gap-2">
          <button type="button"
            onClick={() => setShowAddForm(true)}
            className="flex items-center space-x-2 bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            <UserPlus className="w-5 h-5" />
            <span>Add {activeTab === 'members' ? 'Member' : 'Visitor'}</span>
          </button>
          <button type="button"
            onClick={() => exportCSV(currentData, activeTab)}
            className="flex items-center space-x-2 bg-white border border-gray-300 text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-50"
            title="Export current page"
          >
            <Download className="w-4 h-4" />
            <span className="text-sm">Export</span>
          </button>
        </div>
      </div>

      {/* Add/Edit Form Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                {editingItem ? 'Edit' : 'Add'} {activeTab === 'members' ? 'Member' : 'Visitor'}
              </h3>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phone Number *
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Church *
                  </label>
                  <input
                    type="text"
                    value={formData.church}
                    onChange={(e) => setFormData(prev => ({ ...prev, church: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    required
                  />
                </div>

                {activeTab === 'visitors' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      How did they hear about us? *
                    </label>
                    <select
                      value={formData.howHeard}
                      onChange={(e) => setFormData(prev => ({ ...prev, howHeard: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      required
                    >
                      <option value="">Select an option</option>
                      {howHeardOptions.map(option => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="flex space-x-3 pt-4">
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 bg-primary-500 hover:bg-primary-600 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {editingItem ? 'Update' : 'Add'}
                  </button>
                  <button
                    type="button"
                    onClick={resetForm}
                    className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 font-medium py-2 px-4 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          <button type="button"
            onClick={() => setActiveTab('members')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'members'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Members ({members.length})
          </button>
          <button type="button"
            onClick={() => setActiveTab('visitors')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'visitors'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Visitors ({visitors.length})
          </button>
        </nav>
      </div>

      {/* Error */}
      {errorMsg && (
        <div className="rounded-md bg-red-50 border border-red-200 text-red-700 p-3 text-sm">{errorMsg}</div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
        <input
          type="text"
          placeholder={`Search ${activeTab}...`}
          value={searchTerm}
          onChange={(e) => { setPage(1); setSearchTerm(e.target.value) }}
          onKeyDown={preventEnterSubmit}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
      </div>

      {/* Advanced Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs text-gray-600 mb-1">Church</label>
          <input
            type="text"
            value={churchFilter}
            onChange={(e)=> { setChurchFilter(e.target.value); setPage(1) }}
            onKeyDown={preventEnterSubmit}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder="e.g. RCCG"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">Phone Search</label>
          <select
            value={phoneMode}
            onChange={(e)=> { setPhoneMode(e.target.value); setPage(1) }}
            onKeyDown={preventEnterSubmit}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="contains">Contains</option>
            <option value="starts">Starts with</option>
          </select>
        </div>
        {activeTab === 'visitors' && (
          <div>
            <label className="block text-xs text-gray-600 mb-1">How Heard</label>
            <select
              value={howHeardFilter}
              onChange={(e)=> { setHowHeardFilter(e.target.value); setPage(1) }}
              onKeyDown={preventEnterSubmit}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="">All</option>
              {howHeardOptions.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-600 mb-1">From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e)=> { setDateFrom(e.target.value); setPage(1) }}
              onKeyDown={preventEnterSubmit}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e)=> { setDateTo(e.target.value); setPage(1) }}
              onKeyDown={preventEnterSubmit}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>
      <div className="flex items-center justify-end -mt-1">
        <button type="button"
          onClick={()=>{ setChurchFilter(''); setHowHeardFilter(''); setPhoneMode('contains'); setDateFrom(''); setDateTo(''); setSearchTerm(''); setPage(1) }}
          className="text-sm text-gray-600 hover:text-gray-800"
        >
          Clear filters
        </button>
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => onHeaderClick('name')}>
                  Name {sortBy==='name' && (sortDir==='asc' ? '▲' : '▼')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => onHeaderClick('phone')}>
                  Phone {sortBy==='phone' && (sortDir==='asc' ? '▲' : '▼')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => onHeaderClick('church')}>
                  Church {sortBy==='church' && (sortDir==='asc' ? '▲' : '▼')}
                </th>
                {activeTab === 'visitors' && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    How Heard
                  </th>
                )}
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {currentData.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                        <Users className="w-5 h-5 text-primary-600" />
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">{item.name}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center text-sm text-gray-500">
                      <Phone className="w-4 h-4 mr-2" />
                      {item.phone}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center text-sm text-gray-500">
                      <MapPin className="w-4 h-4 mr-2" />
                      {item.church}
                    </div>
                  </td>
                  {activeTab === 'visitors' && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {item.how_heard}
                    </td>
                  )}
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end space-x-2">
                      <button type="button"
                        onClick={() => handleEdit(item)}
                        className="text-primary-600 hover:text-primary-900 p-1"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button type="button"
                        onClick={() => handleDelete(item.id)}
                        className="text-red-600 hover:text-red-900 p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {currentData.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No {activeTab} found.
          </div>
        )}

        {/* Pagination */}
        <div className="flex items-center justify-between p-4 border-t border-gray-200">
          <div className="text-sm text-gray-600">
            Page {page} of {pageCount} • {totalCount} total
          </div>
          <div className="flex items-center gap-2">
            <button type="button"
              className="px-3 py-1 border rounded disabled:opacity-50"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button type="button"
              className="px-3 py-1 border rounded disabled:opacity-50"
              onClick={() => setPage(p => Math.min(pageCount, p + 1))}
              disabled={page >= pageCount}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <select
              value={pageSize}
              onChange={(e)=> { setPageSize(Number(e.target.value)); setPage(1) }}
              className="ml-2 border rounded px-2 py-1 text-sm"
            >
              {[10,20,50].map(sz => <option key={sz} value={sz}>{sz}/page</option>)}
            </select>
          </div>
        </div>
      </div>
    </div>
  )
}

export default MemberManagement

// Helpers
function exportCSV(rows, tab) {
  if (!rows || rows.length === 0) return
  const headers = tab === 'visitors'
    ? ['Name','Phone','Church','How Heard']
    : ['Name','Phone','Church']
  const dataRows = rows.map(r => tab === 'visitors'
    ? [r.name, r.phone, r.church, r.how_heard || '']
    : [r.name, r.phone, r.church]
  )
  const csv = [headers, ...dataRows].map(r => r.join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${tab}-export-${new Date().toISOString().slice(0,10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
