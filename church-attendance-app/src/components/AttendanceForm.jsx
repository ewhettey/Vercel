import React, { useState, useEffect, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { Phone, User, MapPin, Users, CheckCircle, AlertCircle, Loader2, Calendar, Clock, Sparkles, Heart, Star } from 'lucide-react'
import { withinWindow, getWindow } from '../lib/eventTime'

const AttendanceForm = ({ eventId: providedEventId = '', eventName: providedEventName = '' }) => {
  const { user, userProfile } = useAuth()
  const [formData, setFormData] = useState({
    phone: '',
    name: '',
    church: '',
    howHeard: '',
    category: ''
  })
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [phoneSearching, setPhoneSearching] = useState(false)
  const [events, setEvents] = useState([])
  const [selectedEventId, setSelectedEventId] = useState(providedEventId || '')
  const [eventsLoading, setEventsLoading] = useState(true)
  const [eventsError, setEventsError] = useState('')
  const phoneInputRef = useRef(null)
  const [selectedEventInfo, setSelectedEventInfo] = useState(null)
  const [eventStartError, setEventStartError] = useState('')
  const [foundFromLookup, setFoundFromLookup] = useState(false)

  // Reveal more fields only after phone has input
  const showDetails = (formData.phone?.trim()?.length || 0) > 0

  const howHeardOptions = ['Friend', 'Social Media', 'Evangelism', 'Invitation', 'Other']

  // Load upcoming/active events when no event is provided
  useEffect(() => {
    if (providedEventId) {
      setSelectedEventId(providedEventId)
      setEventsLoading(false)
      return
    }
    const fetchEvents = async () => {
      try {
        setEventsLoading(true)
        setEventsError('')
        const now = new Date()
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
        const yesterdayStr = yesterday.toISOString().slice(0, 10)
        const { data, error } = await supabase
          .from('public_active_events')
          .select('id, name, event_date, start_time, end_time, church, is_active')
          .gte('event_date', yesterdayStr)
          .order('event_date', { ascending: true })

        if (error) throw error
        // Show only events that are currently within the allowed attendance window
        const ongoing = (data || []).filter(ev => {
          try {
            return withinWindow(ev)
          } catch {
            return false
          }
        })
        setEvents(ongoing)
      } catch (e) {
        console.error('Error loading events:', e)
        setEventsError(e?.message || 'Failed to load events')
      } finally {
        setEventsLoading(false)
      }
    }
    fetchEvents()
  }, [providedEventId])

  // Load details for the selected event to determine if it has started
  useEffect(() => {
    const loadSelectedEvent = async () => {
      setEventStartError('')
      setSelectedEventInfo(null)
      if (!selectedEventId) return
      try {
        // First try from the public view (works for anonymous)
        let data = null
        let error = null
        const viewRes = await supabase
          .from('public_active_events')
          .select('id, name, event_date, end_date, start_time, end_time, is_active')
          .eq('id', selectedEventId)
          .maybeSingle()
        if (viewRes.error) {
          error = viewRes.error
        } else {
          data = viewRes.data
        }

        // If not found in view (e.g., inactive), try full table (may require auth)
        if (!data) {
          const fullRes = await supabase
            .from('events')
            .select('id, name, event_date, end_date, start_time, end_time, is_active')
            .eq('id', selectedEventId)
            .maybeSingle()
          if (fullRes.error) error = fullRes.error
          else data = fullRes.data
        }

        if (!data) throw error || new Error('Event not found')
        setSelectedEventInfo(data)

        // Use shared util to determine window and allowability
        const allowed = withinWindow(data)

        if (!data.is_active) {
          setEventStartError('This event is inactive')
        } else if (!allowed) {
          const { windowStart, windowEnd } = getWindow(data)
          if (windowStart && windowEnd) {
            const fmt = (d)=> new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', hour12: true }).format(d)
            const dateStr = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'short', day: 'numeric' }).format(windowStart)
            setEventStartError(`You can only mark attendance on ${dateStr} from ${fmt(windowStart)} until ${fmt(windowEnd)}`)
          } else {
            setEventStartError('You can only mark attendance on the event date')
          }
        } else {
          setEventStartError('')
        }
      } catch (e) {
        console.error('Error loading selected event details:', e)
        setEventStartError('Could not verify event start time')
      }
    }
    loadSelectedEvent()
  }, [selectedEventId])

  // Auto-fill logic when phone number changes
  useEffect(() => {
    const searchByPhone = async () => {
      if (formData.phone.length >= 7) {
        setPhoneSearching(true)
        try {
          const { data, error } = await supabase
            .rpc('lookup_person_by_phone', { p_phone: formData.phone })

          if (error) throw error

          if (data && data.length > 0) {
            const row = data[0]
            setFormData(prev => ({
              ...prev,
              name: row.name || '',
              church: row.church || '',
              howHeard: row.how_heard || '',
              category: row.category || ''
            }))
            setFoundFromLookup(true)
          } else {
            setFormData(prev => ({
              ...prev,
              name: '',
              church: '',
              howHeard: '',
              category: ''
            }))
            setFoundFromLookup(false)
          }
        } catch (err) {
          console.error('Error searching phone:', err)
          setFoundFromLookup(false)
        }
        setPhoneSearching(false)
      }
    }

    const debounceTimer = setTimeout(searchByPhone, 500)
    return () => clearTimeout(debounceTimer)
  }, [formData.phone])

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    setError('')
    setMessage('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')

    try {
      // Validate required fields
      if (!formData.phone || !formData.name || !formData.church) {
        setError('Please fill in all required fields')
        setLoading(false)
        return
      }

      if (!selectedEventId) {
        setError('Please select an event')
        setLoading(false)
        return
      }

      if (!formData.category) {
        setError('Please select Member or Visitor')
        setLoading(false)
        return
      }

      if (formData.category === 'Visitor' && !formData.howHeard) {
        setError('Please select how the visitor heard about us')
        setLoading(false)
        return
      }

      // Check if already marked attendance for this event
      const { data: existingAttendance, error: existingError } = await supabase
        .from('attendance')
        .select('id')
        .eq('phone', formData.phone)
        .eq('event_id', selectedEventId)

      if (existingError) throw existingError

      if (existingAttendance && existingAttendance.length > 0) {
        setError('This number has already been marked present for this event')
        setLoading(false)
        return
      }

      // Save to members/visitors table if new
      if (formData.category === 'Member') {
        const { error: memberError } = await supabase
          .from('members')
          .upsert({
            phone: formData.phone,
            name: formData.name,
            church: formData.church,
            category: 'Member'
          }, { onConflict: 'phone' })

        if (memberError) throw memberError
      } else {
        const { error: visitorError } = await supabase
          .from('visitors')
          .upsert({
            phone: formData.phone,
            name: formData.name,
            church: formData.church,
            how_heard: formData.howHeard,
            category: 'Visitor'
          }, { onConflict: 'phone' })

        if (visitorError) throw visitorError
      }

      // Mark attendance
      const { error: attendanceError } = await supabase
        .from('attendance')
        .insert({
          event_id: selectedEventId,
          phone: formData.phone,
          name: formData.name,
          church: formData.church,
          how_heard: formData.howHeard || null,
          category: formData.category,
          marked_by: user?.id || null
        })

      if (attendanceError) {
        // Handle unique violation (duplicate per event_id + phone)
        if (attendanceError.code === '23505') {
          setError('This number has already been marked present for this event')
          setLoading(false)
          return
        }
        throw attendanceError
      }

      setMessage(`✅ ${formData.name} marked present successfully!`)
      
      // Reset form but keep selected event so multiple people can be checked in
      setFormData({
        phone: '',
        name: '',
        church: '',
        howHeard: '',
        category: ''
      })
      // Keep selected event to allow continuous check-ins

      // Focus phone input for the next entry
      if (phoneInputRef.current) {
        phoneInputRef.current.focus()
      }

      // Clear message after 3 seconds
      setTimeout(() => setMessage(''), 3000)

    } catch (err) {
      console.error('Error marking attendance:', err)
      setError('Failed to mark attendance. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary-200/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-200/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>
      
      <div className="relative max-w-md mx-auto px-3 py-4">
        <div className="bg-white/90 backdrop-blur-md rounded-2xl shadow-2xl border border-white/30 p-4 sm:p-6 relative overflow-hidden">
          {/* Subtle inner glow */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/50 to-transparent rounded-3xl pointer-events-none"></div>
          
          <div className="relative text-center mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-primary-500 via-primary-600 to-primary-700 rounded-2xl mb-4 shadow-lg shadow-primary-500/25 animate-pulse">
              <Users className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent mb-2">Mark Attendance</h1>
            <p className="text-sm text-gray-600 font-medium">Join us in worship today</p>
            <div className="w-12 h-0.5 bg-gradient-to-r from-primary-500 to-primary-600 rounded-full mx-auto mt-3"></div>
          </div>

          {error && (
            <div className="bg-red-50/80 backdrop-blur-sm border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-6 flex items-center">
              <AlertCircle className="w-5 h-5 mr-3 flex-shrink-0" />
              <span className="font-medium">{error}</span>
            </div>
          )}

          {message && (
            <div className="bg-green-50/80 backdrop-blur-sm border border-green-200 text-green-700 px-4 py-3 rounded-xl mb-6 flex items-center">
              <CheckCircle className="w-5 h-5 mr-3 flex-shrink-0" />
              <span className="font-medium">{message}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Event Selection (only when no pre-selected event) */}
            {!providedEventId && (
              <div>
                <label className="block text-xs font-semibold text-gray-800 mb-2 flex items-center gap-2">
                  <Calendar className="w-3 h-3 text-primary-600" />
                  Event *
                </label>
                <div className="relative">
                  <select
                    name="event"
                    value={selectedEventId}
                    onChange={(e) => setSelectedEventId(e.target.value)}
                    className="w-full py-3 px-3 text-sm border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white/50 backdrop-blur-sm transition-all duration-200"
                    required
                    disabled={eventsLoading || (!!eventsError)}
                  >
                    <option value="">{eventsLoading ? 'Loading events...' : 'Select an event'}</option>
                    {events.map(ev => (
                      <option key={ev.id} value={ev.id}>
                        {ev.name} — {ev.event_date}
                      </option>
                    ))}
                  </select>
                  {eventsError && (
                    <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      {eventsError}
                    </p>
                  )}
                </div>
              </div>
            )}
            {/* Phone Number */}
            <div className="group">
              <label className="block text-xs font-semibold text-gray-800 mb-2 flex items-center gap-2">
                <Phone className="w-3 h-3 text-primary-600" />
                Phone Number *
              </label>
              <div className="relative">
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  ref={phoneInputRef}
                  className="w-full px-4 py-4 text-base border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white/60 backdrop-blur-sm transition-all duration-300 hover:bg-white/80 hover:border-gray-300 focus:bg-white/90 focus:shadow-lg focus:shadow-primary-500/10"
                  placeholder="Enter your phone number"
                  required
                />
                {phoneSearching && (
                  <Loader2 className="absolute right-4 top-1/2 transform -translate-y-1/2 text-primary-500 w-5 h-5 animate-spin" />
                )}
              </div>
              <p className="text-xs text-gray-600 mt-1">
                Auto-fill if visited before
              </p>
            </div>

            {/* Name/Church/Category - show summary if found, else fields */}
            {showDetails && foundFromLookup && (
            <div className="rounded-lg border border-gray-200 bg-white/60 backdrop-blur-sm p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] uppercase tracking-wide text-gray-500 font-semibold">Details</span>
              </div>
              <div className="space-y-1.5 text-sm text-gray-800">
                <div className="flex items-center gap-2"><User className="w-3.5 h-3.5 text-primary-600" /><span className="font-medium">{formData.name || '—'}</span></div>
                <div className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5 text-primary-600" /><span>{formData.church || '—'}</span></div>
                <div className="flex items-center gap-2"><Heart className="w-3.5 h-3.5 text-primary-600" /><span>{formData.category || '—'}</span></div>
                {formData.category === 'Visitor' && formData.howHeard && (
                  <div className="flex items-center gap-2"><Sparkles className="w-3.5 h-3.5 text-primary-600" /><span>{formData.howHeard}</span></div>
                )}
              </div>
            </div>
            )}

            {showDetails && !foundFromLookup && (
            <div>
              <label className="block text-xs font-semibold text-gray-800 mb-2 flex items-center gap-2">
                <User className="w-3 h-3 text-primary-600" />
                Full Name *
              </label>
              <div className="relative">
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className="w-full px-3 py-3 text-sm border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white/60 backdrop-blur-sm transition-all duration-300 hover:bg-white/80 hover:border-gray-300 focus:bg-white/90 focus:shadow-lg focus:shadow-primary-500/10"
                  placeholder="Enter your full name"
                  required
                />
              </div>
            </div>
            )}

            {/* Church */}
            {showDetails && !foundFromLookup && (
            <div>
              <label className="block text-xs font-semibold text-gray-800 mb-2 flex items-center gap-2">
                <MapPin className="w-3 h-3 text-primary-600" />
                Church *
              </label>
              <div className="relative">
                <input
                  type="text"
                  name="church"
                  value={formData.church}
                  onChange={handleInputChange}
                  className="w-full px-3 py-3 text-sm border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white/60 backdrop-blur-sm transition-all duration-300 hover:bg-white/80 hover:border-gray-300 focus:bg-white/90 focus:shadow-lg focus:shadow-primary-500/10"
                  placeholder="Enter your church name"
                  required
                />
              </div>
            </div>
            )}

            {/* Category Selection */}
            {showDetails && !foundFromLookup && (
            <div>
              <label className="block text-xs font-semibold text-gray-800 mb-2 flex items-center gap-2">
                <Heart className="w-3 h-3 text-primary-600" />
                I am a... *
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, category: 'Member' }))}
                  className={`py-3 px-4 rounded-lg border-2 font-semibold transition-all duration-200 text-sm flex items-center justify-center gap-1.5 ${
                    formData.category === 'Member'
                      ? 'border-primary-500 bg-primary-500 text-white shadow-lg'
                      : 'border-gray-200 text-gray-700 hover:border-primary-300 hover:bg-primary-50 bg-white/50 backdrop-blur-sm'
                  }`}
                >
                  <Star className="w-3 h-3" />
                  Member
                </button>
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, category: 'Visitor' }))}
                  className={`py-3 px-4 rounded-lg border-2 font-semibold transition-all duration-200 text-sm flex items-center justify-center gap-1.5 ${
                    formData.category === 'Visitor'
                      ? 'border-primary-500 bg-primary-500 text-white shadow-lg'
                      : 'border-gray-200 text-gray-700 hover:border-primary-300 hover:bg-primary-50 bg-white/50 backdrop-blur-sm'
                  }`}
                >
                  <Sparkles className="w-3 h-3" />
                  Visitor
                </button>
              </div>
            </div>
            )}

            {/* How Heard (only for visitors). If found and missing, still ask. */}
            {showDetails && formData.category === 'Visitor' && (!foundFromLookup || !formData.howHeard) && (
              <div className="animate-in slide-in-from-top-2 duration-300">
                <label className="block text-xs font-semibold text-gray-800 mb-2 flex items-center gap-2">
                  <Sparkles className="w-3 h-3 text-primary-600" />
                  How did you hear about us? *
                </label>
                <div className="relative">
                  <select
                    name="howHeard"
                    value={formData.howHeard}
                    onChange={handleInputChange}
                    className="w-full py-3 px-3 text-sm border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white/50 backdrop-blur-sm transition-all duration-200"
                    required
                  >
                    <option value="">Tell us how you found us</option>
                    {howHeardOptions.map(option => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Event start restriction message */}
            {showDetails && eventStartError && (
              <div className="bg-amber-50/80 backdrop-blur-sm border border-amber-200 text-amber-700 px-3 py-2 rounded-lg text-xs flex items-center gap-2">
                <span className="font-medium">{eventStartError}</span>
              </div>
            )}

            {/* Submit Button */}
            {showDetails && (
            <div className="pt-1">
              <button
                type="submit"
                disabled={
                  loading ||
                  !selectedEventId ||
                  !formData.phone ||
                  !formData.name ||
                  !formData.church ||
                  !formData.category ||
                  !!eventStartError
                }
                className="relative w-full bg-gradient-to-r from-primary-500 via-primary-600 to-primary-700 hover:from-primary-600 hover:via-primary-700 hover:to-primary-800 disabled:from-gray-300 disabled:to-gray-400 text-white font-bold py-3.5 px-4 rounded-xl transition-all duration-300 flex items-center justify-center text-base shadow-2xl hover:shadow-primary-500/25 disabled:shadow-none transform hover:scale-[1.02] active:scale-[0.98] disabled:transform-none overflow-hidden group"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                {loading ? (
                  <div className="flex items-center gap-2 relative z-10">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Marking...</span>
                  </div>
                ) : (
                  <div className="relative z-10">
                    <span>Mark Attendance</span>
                  </div>
                )}
              </button>
            </div>
            )}
          </form>
        </div>
      </div>
    </div>
  )
}

export default AttendanceForm
