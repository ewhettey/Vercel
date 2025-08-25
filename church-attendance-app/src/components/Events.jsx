import React, { useEffect, useState } from 'react'
import { Calendar, MapPin, Clock, Loader2, ChevronRight, PlusCircle, Search, Sparkles, Users2, Star, AlertCircle, CheckCircle } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import AttendanceForm from './AttendanceForm'
import { useAuth } from '../contexts/AuthContext'
import { withinWindow, getStatus, formatStatusBadge } from '../lib/eventTime'

const Events = () => {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedEvent, setSelectedEvent] = useState(null)
  const { user, userProfile } = useAuth()
  const [activeTab, setActiveTab] = useState('ongoing') // ongoing | upcoming | past
  const [query, setQuery] = useState('')

  // Create event form state
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [createMsg, setCreateMsg] = useState('')
  // Edit state
  const [editingEvent, setEditingEvent] = useState(null)
  const [updating, setUpdating] = useState(false)
  const [updateError, setUpdateError] = useState('')
  const [updateMsg, setUpdateMsg] = useState('')
  const [form, setForm] = useState({
    name: '',
    description: '',
    event_date: '',
    end_date: '',
    start_time: '',
    end_time: '',
    church: '',
    event_type: 'Service',
    location: '',
    is_active: true,
  })

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        setLoading(true)
        setError('')
        
        // Call function to deactivate old events first
        await supabase.rpc('deactivate_old_events')
        
        const now = new Date()
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
        const yesterdayStr = yesterday.toISOString().slice(0, 10)
        const { data, error } = await supabase
          .from('events')
          .select('id, name, description, event_date, end_date, start_time, end_time, location, church, is_active')
          .eq('is_active', true)
          .gte('event_date', yesterdayStr)
          .order('event_date', { ascending: true })

        if (error) throw error
        
        setEvents(data || [])
      } catch (e) {
        console.error('Error loading events:', e)
        setError('Failed to load events')
      } finally {
        setLoading(false)
      }
    }
    fetchEvents()
  }, [])

  const canManageEvents = userProfile?.role === 'Admin' || userProfile?.role === 'Pastor'

  // Formatting helpers
  const toStartEndDates = (ev) => {
    if (!ev?.event_date) return { s: null, e: null }
    const [sy, sm, sd] = ev.event_date.split('-').map(Number)
    const [sh, smin] = (ev.start_time || '00:00').split(':').map(Number)
    const start = new Date(sy, (sm - 1), sd, sh || 0, smin || 0)
    const endDateStr = ev.end_date || ev.event_date
    const [ey, em, ed] = endDateStr.split('-').map(Number)
    const [eh, emin] = (ev.end_time || ev.start_time || '00:00').split(':').map(Number)
    const end = new Date(ey, (em - 1), ed, eh || 0, emin || 0)
    return { s: start, e: end }
  }
  const fmtDate = (d) => new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' }).format(d)
  const fmtTime = (d) => new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', hour12: true }).format(d)
  const formatDateRange = (ev) => {
    const { s, e } = toStartEndDates(ev)
    if (!s) return ev.event_date
    const sameDay = s.toDateString() === e.toDateString()
    if (sameDay) return fmtDate(s)
    return `${fmtDate(s)} → ${fmtDate(e)}`
  }
  const formatTimeRange = (ev) => {
    if (!ev.start_time) return 'Time TBA'
    const { s, e } = toStartEndDates(ev)
    const sameDay = s.toDateString() === e.toDateString()
    return sameDay ? `${fmtTime(s)} – ${fmtTime(e)}` : `${fmtTime(s)} → ${fmtTime(e)}`
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    setCreateError('')
    setCreateMsg('')

    // Basic validation
    if (!form.name || !form.event_date || !form.church) {
      setCreateError('Name, Date and Church are required')
      return
    }
    if (!canManageEvents) {
      setCreateError('You do not have permission to create events')
      return
    }

    // Validate end >= start when applicable
    try {
      if (form.start_time) {
        const s = new Date(`${form.event_date}T${(form.start_time||'00:00')}`)
        const ed = form.end_date || form.event_date
        const et = (form.end_time || form.start_time || '00:00')
        const eDt = new Date(`${ed}T${et}`)
        if (eDt < s) {
          setCreateError('End must be after Start')
          return
        }
      }
    } catch {}

    try {
      setCreating(true)
      const payload = {
        name: form.name,
        description: form.description || null,
        event_date: form.event_date, // YYYY-MM-DD
        end_date: form.end_date || null, // optional end date
        start_time: form.start_time || null, // HH:MM
        end_time: form.end_time || null,
        church: form.church,
        event_type: form.event_type,
        location: form.location || null,
        is_active: form.is_active,
        created_by: user?.id || null,
      }

      const { error: insertError } = await supabase
        .from('events')
        .insert(payload)

      if (insertError) throw insertError

      setCreateMsg('Event created successfully')
      setShowCreate(false)
      setForm({
        name: '', description: '', event_date: '', end_date: '', start_time: '', end_time: '', church: '', event_type: 'Service', location: '', is_active: true,
      })

      // Refresh list (same filter as initial load)
      const now = new Date()
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
      const yesterdayStr = yesterday.toISOString().slice(0, 10)
      const { data } = await supabase
        .from('events')
        .select('id, name, description, event_date, end_date, start_time, end_time, location, church, is_active')
        .eq('is_active', true)
        .gte('event_date', yesterdayStr)
        .order('event_date', { ascending: true })
      setEvents(data || [])
    } catch (err) {
      console.error('Error creating event:', err)
      setCreateError('Failed to create event')
    } finally {
      setCreating(false)
    }
  }

  const renderEventCard = (ev) => {
    const badge = formatStatusBadge(ev)
    const isOngoing = getStatus(ev) === 'ongoing'
    return (
      <div key={ev.id} className={`group bg-white rounded-2xl shadow-lg border border-gray-100 p-6 flex flex-col hover:shadow-xl hover:-translate-y-1 transition-all duration-300 ${isOngoing ? 'ring-2 ring-green-200 bg-gradient-to-br from-green-50 to-white' : ''}`}>
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-xl font-bold text-gray-900 truncate group-hover:text-primary-600 transition-colors">{ev.name}</h3>
              {isOngoing && <Star className="w-5 h-5 text-yellow-500 animate-pulse" />}
            </div>
            {ev.description && (
              <p className="text-gray-600 leading-relaxed line-clamp-2">{ev.description}</p>
            )}
          </div>
          <div className={`text-xs px-3 py-1.5 rounded-full font-semibold whitespace-nowrap shadow-sm ${badge.color}`}>{badge.label}</div>
        </div>
        
        <div className="flex flex-wrap items-center gap-4 text-gray-700 mb-4">
          <span className="inline-flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg">
            <Calendar className="w-4 h-4 text-primary-500" />
            <span className="font-medium">{formatDateRange(ev)}</span>
          </span>
          <span className="inline-flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg">
            <Clock className="w-4 h-4 text-primary-500" />
            <span className="font-medium">{formatTimeRange(ev)}</span>
          </span>
        </div>
        
        <div className="flex flex-wrap items-center gap-2 mb-6">
          {ev.church && (
            <span className="inline-flex items-center px-3 py-1.5 rounded-full bg-gradient-to-r from-blue-50 to-blue-100 text-blue-800 text-sm font-medium border border-blue-200">
              {ev.church}
            </span>
          )}
          {ev.event_type && (
            <span className="inline-flex items-center px-3 py-1.5 rounded-full bg-gradient-to-r from-primary-50 to-primary-100 text-primary-800 text-sm font-medium border border-primary-200">
              {ev.event_type}
            </span>
          )}
          {ev.location && (
            <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-gradient-to-r from-gray-50 to-gray-100 text-gray-700 text-sm font-medium border border-gray-200">
              <MapPin className="w-3 h-3" />{ev.location}
            </span>
          )}
        </div>
        
        {/* Actions always at bottom */}
        <div className="mt-auto pt-4 border-t border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {canManageEvents && (
                <button
                  onClick={() => {
                    setUpdateError(''); setUpdateMsg('')
                    setEditingEvent(ev)
                    setShowCreate(false)
                    setForm({
                      name: ev.name || '',
                      description: ev.description || '',
                      event_date: ev.event_date || '',
                      end_date: ev.end_date || '',
                      start_time: ev.start_time || '',
                      end_time: ev.end_time || '',
                      church: ev.church || '',
                      event_type: ev.event_type || 'Service',
                      location: ev.location || '',
                      is_active: !!ev.is_active,
                    })
                  }}
                  className="text-sm text-gray-600 hover:text-primary-600 font-medium transition-colors"
                >
                  Edit
                </button>
              )}
            </div>
            <button
              onClick={() => setSelectedEvent(ev)}
              className="group inline-flex items-center bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white font-semibold px-4 py-2 rounded-lg shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200"
            >
              Mark Attendance 
              <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {!selectedEvent && (
          <>
            {/* Hero Header */}
            <div className="text-center mb-12">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-primary-500 to-purple-600 rounded-2xl mb-6 shadow-lg">
                <Sparkles className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-gray-900 via-primary-600 to-purple-600 bg-clip-text text-transparent mb-4">
                Church Events
              </h1>
              <p className="text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
                Discover upcoming services, connect with your community, and mark your attendance with ease.
              </p>
            </div>

            {/* Action Bar */}
            <div className="flex flex-col lg:flex-row items-center justify-between gap-6 mb-8">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-gray-600">
                  <Users2 className="w-5 h-5" />
                  <span className="font-medium">{events.length} Events Available</span>
                </div>
                {canManageEvents && (
                  <div className="h-6 w-px bg-gray-300"></div>
                )}
              </div>
              {canManageEvents && (
                <button
                  onClick={() => { setShowCreate((v) => !v); setEditingEvent(null); setUpdateError(''); setUpdateMsg('') }}
                  className="group inline-flex items-center bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white font-semibold px-6 py-3 rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200"
                >
                  <PlusCircle className="w-5 h-5 mr-2 group-hover:rotate-90 transition-transform duration-200" />
                  {showCreate ? 'Close Form' : 'Create New Event'}
                </button>
              )}
            </div>

            {/* Search and Tabs */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 mb-8">
              <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search events, churches, locations..."
                    className="w-full pl-12 pr-4 py-3 text-lg border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200"
                  />
                </div>
                <div className="flex items-center bg-gray-50 rounded-xl p-1 shadow-inner">
                  {['all','ongoing','upcoming','past'].map(tab => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`px-4 py-2 text-sm font-medium capitalize rounded-lg transition-all duration-200 ${
                        activeTab===tab 
                          ? 'bg-white text-primary-700 shadow-md transform scale-105' 
                          : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              </div>
            </div>

          {canManageEvents && (showCreate || editingEvent) && (
            <div className="mb-8 bg-white border border-gray-200 rounded-2xl p-4 sm:p-6 md:p-8 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
                <div>
                  <h3 className="text-xl sm:text-2xl font-bold text-gray-900">{editingEvent ? 'Edit Event' : 'Create New Event'}</h3>
                  <p className="text-sm text-gray-600 mt-1">{editingEvent ? 'Update event details' : 'Fill in the details to create a new event'}</p>
                </div>
                {editingEvent && (
                  <button 
                    className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 font-medium transition-colors self-start sm:self-auto" 
                    onClick={()=>{ setEditingEvent(null); setUpdateError(''); setUpdateMsg('') }}
                  >
                    Cancel Edit
                  </button>
                )}
              </div>
              {createError && (
                <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg mb-4 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span className="text-sm">{createError}</span>
                </div>
              )}
              {createMsg && (
                <div className="bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded-lg mb-4 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 flex-shrink-0" />
                  <span className="text-sm">{createMsg}</span>
                </div>
              )}
              {updateError && (
                <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg mb-4 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span className="text-sm">{updateError}</span>
                </div>
              )}
              {updateMsg && (
                <div className="bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded-lg mb-4 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 flex-shrink-0" />
                  <span className="text-sm">{updateMsg}</span>
                </div>
              )}
              <form onSubmit={editingEvent ? undefined : handleCreate} className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                <div className="lg:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Event Name *</label>
                  <input 
                    type="text" 
                    className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-base focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200" 
                    value={form.name} 
                    onChange={(e)=>setForm(f=>({...f,name:e.target.value}))} 
                    placeholder="Enter event name"
                    required 
                  />
                </div>
                <div className="col-span-1">
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Start Date & Time *
                  </label>
                  <div className="relative">
                    <input
                      type="datetime-local"
                      className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-base focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200"
                      value={(form.event_date ? form.event_date : '') + (form.start_time ? `T${(form.start_time || '').slice(0,5)}` : (form.event_date ? 'T00:00' : ''))}
                      onChange={(e)=>{
                        const v = e.target.value // YYYY-MM-DDTHH:MM
                        if (!v) { setForm(f=>({...f,event_date:'', start_time:''})); return }
                        const [d,t] = v.split('T')
                        setForm(f=>({...f,event_date:d, start_time:t || ''}))
                      }}
                      min={new Date().toISOString().slice(0,16)}
                      required
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Event start time (cannot be in the past)
                  </p>
                </div>
                <div className="col-span-1">
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    End Date & Time
                  </label>
                  <div className="relative">
                    <input
                      type="datetime-local"
                      className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-base focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200"
                      value={(form.end_date ? form.end_date : (form.event_date || '')) + ((form.end_time || form.start_time) ? `T${((form.end_time || form.start_time) || '').slice(0,5)}` : ((form.end_date || form.event_date) ? 'T00:00' : ''))}
                      onChange={(e)=>{
                        const v = e.target.value
                        if (!v) { setForm(f=>({...f,end_date:'', end_time:''})); return }
                        const [d,t] = v.split('T')
                        setForm(f=>({...f,end_date:d, end_time:t || ''}))
                      }}
                      min={form.event_date && form.start_time ? `${form.event_date}T${form.start_time}` : new Date().toISOString().slice(0,16)}
                    />
                    {(form.end_date || form.end_time) && (
                      <button
                        type="button"
                        onClick={() => setForm(f => ({...f, end_date: '', end_time: ''}))}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                        title="Clear end time"
                      >
                        ×
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    Optional - leave empty for events without specific end time
                  </p>
                </div>
                <div className="col-span-1">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Church *</label>
                  <input 
                    type="text" 
                    className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-base focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200" 
                    value={form.church} 
                    onChange={(e)=>setForm(f=>({...f,church:e.target.value}))} 
                    placeholder="Enter church name"
                    required 
                  />
                </div>
                <div className="col-span-1">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Event Type</label>
                  <select className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-base focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200 bg-white" value={form.event_type} onChange={(e)=>setForm(f=>({...f,event_type:e.target.value}))}>
                    {['Service','Bible Study','Prayer Meeting','Special Event','Conference','Workshop','Other'].map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div className="lg:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
                  <input 
                    type="text" 
                    className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-base focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200" 
                    value={form.location} 
                    onChange={(e)=>setForm(f=>({...f,location:e.target.value}))} 
                    placeholder="Enter event location"
                  />
                </div>
                <div className="lg:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                  <textarea 
                    className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-base focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200 resize-none" 
                    rows={3} 
                    value={form.description} 
                    onChange={(e)=>setForm(f=>({...f,description:e.target.value}))} 
                    placeholder="Enter event description (optional)"
                  />
                </div>
                <div className="lg:col-span-2 flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
                  <input 
                    id="is_active" 
                    type="checkbox" 
                    className="h-5 w-5 text-primary-600 border-2 border-gray-300 rounded focus:ring-2 focus:ring-primary-500" 
                    checked={form.is_active} 
                    onChange={(e)=>setForm(f=>({...f,is_active:e.target.checked}))} 
                  />
                  <label htmlFor="is_active" className="text-sm font-medium text-gray-700">Make this event active and visible to users</label>
                </div>
                <div className="lg:col-span-2 flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t border-gray-200">
                  <button 
                    type="button" 
                    onClick={()=>{ setShowCreate(false); setEditingEvent(null)}} 
                    className="px-6 py-3 text-sm font-medium rounded-xl border-2 border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  {!editingEvent ? (
                    <button 
                      type="submit" 
                      disabled={creating} 
                      className="px-6 py-3 text-sm font-semibold rounded-xl bg-gradient-to-r from-primary-600 to-primary-700 text-white hover:from-primary-700 hover:to-primary-800 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl"
                    >
                      {creating ? (
                        <span className="flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Creating...
                        </span>
                      ) : (
                        'Create Event'
                      )}
                    </button>
                  ) : (
                    <button type="button" disabled={updating} onClick={async()=>{
                      setUpdateError(''); setUpdateMsg('')
                      // Validate
                      if (!form.name || !form.event_date || !form.church) {
                        setUpdateError('Name, Date and Church are required')
                        return
                      }
                      // end >= start validation if both provided
                      try {
                        if (form.start_time) {
                          const s = new Date(`${form.event_date}T${(form.start_time||'00:00')}`)
                          const ed = form.end_date || form.event_date
                          const et = (form.end_time || form.start_time || '00:00')
                          const e = new Date(`${ed}T${et}`)
                          if (e < s) {
                            setUpdateError('End must be after Start')
                            return
                          }
                        }
                      } catch {}
                      try {
                        setUpdating(true)
                        const payload = {
                          name: form.name,
                          description: form.description || null,
                          event_date: form.event_date,
                          end_date: form.end_date || null,
                          start_time: form.start_time || null,
                          end_time: form.end_time || null,
                          church: form.church,
                          event_type: form.event_type,
                          location: form.location || null,
                          is_active: form.is_active,
                        }
                        const { error: upErr } = await supabase
                          .from('events')
                          .update(payload)
                          .eq('id', editingEvent.id)
                        if (upErr) throw upErr
                        setUpdateMsg('Event updated')
                        setEditingEvent(null)
                        // Refresh events
                        const now = new Date()
                        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
                        const yesterdayStr = yesterday.toISOString().slice(0, 10)
                        const { data } = await supabase
                          .from('events')
                          .select('id, name, description, event_date, end_date, start_time, end_time, location, church, is_active')
                          .eq('is_active', true)
                          .gte('event_date', yesterdayStr)
                          .order('event_date', { ascending: true })
                        setEvents(data || [])
                      } catch (err) {
                        console.error('Error updating event:', err)
                        setUpdateError('Failed to update event')
                      } finally {
                        setUpdating(false)
                      }
                    }} className="px-6 py-3 text-sm font-semibold rounded-xl bg-gradient-to-r from-primary-600 to-primary-700 text-white hover:from-primary-700 hover:to-primary-800 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl">
                      {updating ? (
                        <span className="flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Saving...
                        </span>
                      ) : (
                        'Save Changes'
                      )}
                    </button>
                  )}
                </div>
              </form>
            </div>
          )}

          {loading && (
            <div className="flex items-center text-gray-500"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading events...</div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg mb-4">{error}</div>
          )}

          {!loading && !error && events.length === 0 && (
            <div className="text-gray-500">No upcoming events found.</div>
          )}

          {(() => {
            const now = new Date()
            const q = query.trim().toLowerCase()
            const searched = q
              ? events.filter(ev =>
                  (ev.name || '').toLowerCase().includes(q) ||
                  (ev.description || '').toLowerCase().includes(q) ||
                  (ev.church || '').toLowerCase().includes(q)
                )
              : events
            const partitioned = {
              ongoing: searched.filter(ev => getStatus(ev, now) === 'ongoing'),
              upcoming: searched.filter(ev => getStatus(ev, now) === 'upcoming'),
              past: searched.filter(ev => getStatus(ev, now) === 'ended'),
            }
            // Filter ended events from all tabs except 'past'
            const filterEnded = (events) => {
              if (activeTab === 'past') return events
              return events.filter(ev => getStatus(ev, now) !== 'ended')
            }
            
            const display = activeTab === 'all' ? filterEnded(searched) : partitioned[activeTab]
            // Sort: by event_date + start_time ascending
            const toTime = (ev) => {
              const [y,m,d] = (ev.event_date || '1970-01-01').split('-').map(Number)
              const [hh,mm,ss] = (ev.start_time || '00:00:00').split(':').map(Number)
              return new Date(y, (m-1), d, hh||0, mm||0, ss||0, 0).getTime()
            }
            display.sort((a,b)=> toTime(a) - toTime(b))
            return (
              <>
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                  {display.map(renderEventCard)}
                </div>
                {display.length===0 && (
                  <div className="text-center py-16">
                    <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Calendar className="w-12 h-12 text-gray-400" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">No events found</h3>
                    <p className="text-gray-600">Try adjusting your search or check a different tab.</p>
                  </div>
                )}
              </>
            )
          })()}
        </>
      )}

      {selectedEvent && (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
          <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
            {/* Header with back button */}
            <div className="flex items-center gap-3 sm:gap-4 mb-6 sm:mb-8">
              <button
                onClick={() => setSelectedEvent(null)}
                className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 font-medium transition-colors text-sm sm:text-base"
              >
                <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 rotate-180" />
                <span className="hidden sm:inline">Back to Events</span>
                <span className="sm:hidden">Back</span>
              </button>
              <div className="h-4 sm:h-6 w-px bg-gray-300"></div>
              <div className="text-xs sm:text-sm text-gray-500">Attendance Management</div>
            </div>

            {/* Event Details Card */}
            <div className="bg-white rounded-2xl sm:rounded-3xl shadow-xl border border-gray-100 overflow-hidden mb-6 sm:mb-8">
              {/* Header Section */}
              <div className="bg-gradient-to-r from-primary-600 to-primary-700 p-4 sm:p-6 md:p-8 text-white">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
                  <div className="flex-1">
                    <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-2">{selectedEvent.name}</h1>
                    {selectedEvent.description && (
                      <p className="text-primary-100 text-base sm:text-lg leading-relaxed">{selectedEvent.description}</p>
                    )}
                  </div>
                  <div className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-full font-semibold shadow-lg text-sm sm:text-base self-start ${
                    getStatus(selectedEvent) === 'ongoing' 
                      ? 'bg-green-500 text-white' 
                      : getStatus(selectedEvent) === 'upcoming'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-500 text-white'
                  }`}>
                    {formatStatusBadge(selectedEvent).label}
                  </div>
                </div>
              </div>

              {/* Details Grid */}
              <div className="p-4 sm:p-6 md:p-8">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-4 sm:mb-6">
                  <div className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl sm:rounded-2xl border border-blue-200">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-500 rounded-lg sm:rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
                      <Calendar className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm text-blue-600 font-semibold uppercase tracking-wide">Date</p>
                      <p className="text-sm sm:text-lg font-bold text-blue-900 truncate">{formatDateRange(selectedEvent)}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 bg-gradient-to-r from-purple-50 to-purple-100 rounded-xl sm:rounded-2xl border border-purple-200">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-purple-500 rounded-lg sm:rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
                      <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm text-purple-600 font-semibold uppercase tracking-wide">Time</p>
                      <p className="text-sm sm:text-lg font-bold text-purple-900 truncate">{formatTimeRange(selectedEvent)}</p>
                    </div>
                  </div>
                  
                  {selectedEvent.location && (
                    <div className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 bg-gradient-to-r from-green-50 to-green-100 rounded-xl sm:rounded-2xl border border-green-200 sm:col-span-2 lg:col-span-1">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-500 rounded-lg sm:rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
                        <MapPin className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm text-green-600 font-semibold uppercase tracking-wide">Location</p>
                        <p className="text-sm sm:text-lg font-bold text-green-900 truncate">{selectedEvent.location}</p>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Tags */}
                <div className="flex flex-wrap items-center gap-3">
                  {selectedEvent.church && (
                    <span className="inline-flex items-center px-4 py-2 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold shadow-md">
                      {selectedEvent.church}
                    </span>
                  )}
                  {selectedEvent.event_type && (
                    <span className="inline-flex items-center px-4 py-2 rounded-full bg-gradient-to-r from-primary-500 to-primary-600 text-white font-semibold shadow-md">
                      {selectedEvent.event_type}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Attendance Form Section */}
            <div className="bg-white rounded-2xl sm:rounded-3xl shadow-xl border border-gray-100 p-4 sm:p-6 md:p-8">
              <div className="text-center mb-6 sm:mb-8">
                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-r from-primary-500 to-primary-600 rounded-xl sm:rounded-2xl flex items-center justify-center mx-auto mb-3 sm:mb-4 shadow-lg">
                  <Users2 className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">Mark Attendance</h2>
                <p className="text-sm sm:text-base text-gray-600">Check in attendees for this event</p>
              </div>
              
              <AttendanceForm eventId={selectedEvent.id} eventName={selectedEvent.name} />
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  )
}

export default Events
