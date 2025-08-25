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
          .from('events')
          .select('id, name, event_date, start_time, end_time, church, is_active')
          .eq('is_active', true)
          .gte('event_date', yesterdayStr)
          .order('event_date', { ascending: true })

        if (error) throw error
        // Filter to only events that have not yet ended (supports overnight)
        const activeNotEnded = (data || []).filter(ev => {
          try {
            const [y, m, d] = ev.event_date.split('-').map(Number)
            if (!ev.start_time) {
              // No start time: show only on the event date (whole day)
              return now.getFullYear() === y && (now.getMonth()+1) === m && now.getDate() === d
            }
            const [sh, sm, ss] = (ev.start_time || '00:00:00').split(':').map(Number)
            const start = new Date(y, (m-1), d, sh || 0, sm || 0, ss || 0, 0)
            const endStr = ev.end_time || ev.start_time
            const [eh, em, es] = (endStr || '00:00:00').split(':').map(Number)
            let endBase = new Date(y, (m-1), d, eh || 0, em || 0, es || 0, 0)
            if (ev.end_time && endBase < start) {
              // Overnight event
              endBase = new Date(endBase.getTime() + 24 * 60 * 60 * 1000)
            }
            const windowEnd = new Date(endBase.getTime() + 2 * 60 * 60 * 1000)
            return now <= windowEnd
          } catch {
            return false
          }
        })
        setEvents(activeNotEnded)
      } catch (e) {
        console.error('Error loading events:', e)
        setEventsError('Failed to load events')
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
        const { data, error } = await supabase
          .from('events')
          .select('id, name, event_date, end_date, start_time, end_time, is_active')
          .eq('id', selectedEventId)
          .single()
        if (error) throw error
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
          const rawPhone = formData.phone
          const digitsPhone = formData.phone.replace(/\D/g, '')
          const tryVisitors = async () => {
            // Then check visitors table
            const { data: visitorData, error: visitorError } = await supabase
              .from('visitors')
              .select('*')
              .eq('phone', rawPhone)
              .single()

            if (visitorData && !visitorError) return { visitorData }

            if (digitsPhone && digitsPhone !== rawPhone) {
              const { data: visitorData2, error: visitorError2 } = await supabase
                .from('visitors')
                .select('*')
                .eq('phone', digitsPhone)
                .single()
              if (visitorData2 && !visitorError2) return { visitorData: visitorData2 }
            }
            return {}
          }

          // First check members table
          const { data: memberData, error: memberError } = await supabase
            .from('members')
            .select('*')
            .eq('phone', rawPhone)
            .single()

          if (memberData && !memberError) {
            setFormData(prev => ({
              ...prev,
              name: memberData.name,
              church: memberData.church,
              category: 'Member',
              howHeard: ''
            }))
            setPhoneSearching(false)
            return
          }

          // Try digits-only match for members
          if (digitsPhone && digitsPhone !== rawPhone) {
            const { data: memberData2, error: memberError2 } = await supabase
              .from('members')
              .select('*')
              .eq('phone', digitsPhone)
              .single()
            if (memberData2 && !memberError2) {
              setFormData(prev => ({
                ...prev,
                name: memberData2.name,
                church: memberData2.church,
                category: 'Member',
                howHeard: ''
              }))
              setPhoneSearching(false)
              return
            }
          }

          // Then check visitors table (raw then digits-only)
          const { visitorData } = await tryVisitors()

          if (visitorData) {
            setFormData(prev => ({
              ...prev,
              name: visitorData.name,
              church: visitorData.church,
              howHeard: visitorData.how_heard,
              category: 'Visitor'
            }))
          } else {
            // Reset form if not found
            setFormData(prev => ({
              ...prev,
              name: '',
              church: '',
              howHeard: '',
              category: ''
            }))
          }
        } catch (err) {
          console.error('Error searching phone:', err)
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
    <div className="w-full sm:max-w-md sm:mx-auto">
      <div className="bg-white rounded-lg shadow-lg p-6">

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg mb-4 flex items-center">
            <AlertCircle className="w-5 h-5 mr-2" />
            {error}
          </div>
        )}

        {message && (
          <div className="bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded-lg mb-4 flex items-center">
            <CheckCircle className="w-5 h-5 mr-2" />
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Event Selection (only when no pre-selected event) */}
          {!providedEventId && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Event *
              </label>
              <div className="relative">
                <select
                  name="event"
                  value={selectedEventId}
                  onChange={(e) => setSelectedEventId(e.target.value)}
                  className="w-full py-3 px-3 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
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
                  <p className="mt-1 text-sm text-red-600">{eventsError}</p>
                )}
              </div>
            </div>
          )}
          {/* Phone Number */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Phone Number *
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                ref={phoneInputRef}
                className="w-full pl-10 pr-10 py-3 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Enter phone number"
                required
              />
              {phoneSearching && (
                <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 animate-spin" />
              )}
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Full Name *
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className="w-full pl-10 pr-4 py-3 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Enter full name"
                required
              />
            </div>
          </div>

          {/* Church */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Church *
            </label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                name="church"
                value={formData.church}
                onChange={handleInputChange}
                className="w-full pl-10 pr-4 py-3 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Enter church name"
                required
              />
            </div>
          </div>

          {/* Category Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Category *
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, category: 'Member' }))}
                className={`py-3 px-4 rounded-lg border-2 font-medium transition-colors text-base ${
                  formData.category === 'Member'
                    ? 'border-primary-500 bg-primary-50 text-primary-700'
                    : 'border-gray-300 text-gray-700 hover:border-gray-400'
                }`}
              >
                Member
              </button>
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, category: 'Visitor' }))}
                className={`py-3 px-4 rounded-lg border-2 font-medium transition-colors text-base ${
                  formData.category === 'Visitor'
                    ? 'border-primary-500 bg-primary-50 text-primary-700'
                    : 'border-gray-300 text-gray-700 hover:border-gray-400'
                }`}
              >
                Visitor
              </button>
            </div>
          </div>

          {/* How Heard (only for visitors) */}
          {formData.category === 'Visitor' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                How did you hear about us? *
              </label>
              <select
                name="howHeard"
                value={formData.howHeard}
                onChange={handleInputChange}
                className="w-full py-3 px-3 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                required
              >
                <option value="">Select an option</option>
                {howHeardOptions.map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>
          )}

          {/* Event start restriction message */}
          {eventStartError && (
            <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-2 rounded-lg text-sm">
              {eventStartError}
            </div>
          )}

          {/* Submit Button */}
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
            className="w-full bg-primary-500 hover:bg-primary-600 disabled:bg-gray-300 text-white font-semibold py-3 px-4 rounded-lg transition duration-200 flex items-center justify-center text-base"
          >
            {loading ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              'Mark Present'
            )}
          </button>
        </form>
      </div>
    </div>
  )
}

export default AttendanceForm
