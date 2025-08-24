import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { Phone, User, MapPin, Users, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'

const AttendanceForm = () => {
  const { userProfile } = useAuth()
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

  const howHeardOptions = ['Friend', 'Social Media', 'Evangelism', 'Invitation', 'Other']

  // Auto-fill logic when phone number changes
  useEffect(() => {
    const searchByPhone = async () => {
      if (formData.phone.length >= 10) {
        setPhoneSearching(true)
        try {
          // First check members table
          const { data: memberData, error: memberError } = await supabase
            .from('members')
            .select('*')
            .eq('phone', formData.phone)
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

          // Then check visitors table
          const { data: visitorData, error: visitorError } = await supabase
            .from('visitors')
            .select('*')
            .eq('phone', formData.phone)
            .single()

          if (visitorData && !visitorError) {
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

      // Check if already marked attendance today
      const today = new Date().toISOString().split('T')[0]
      const { data: existingAttendance } = await supabase
        .from('attendance')
        .select('*')
        .eq('phone', formData.phone)
        .eq('date', today)

      if (existingAttendance && existingAttendance.length > 0) {
        setError('This person has already been marked present today')
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
          phone: formData.phone,
          name: formData.name,
          church: formData.church,
          how_heard: formData.howHeard || null,
          category: formData.category,
          marked_by: userProfile?.email || 'Unknown'
        })

      if (attendanceError) throw attendanceError

      setMessage(`✅ ${formData.name} marked present successfully!`)
      
      // Reset form
      setFormData({
        phone: '',
        name: '',
        church: '',
        howHeard: '',
        category: ''
      })

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
    <div className="max-w-md mx-auto">
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-primary-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <Users className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Mark Attendance</h2>
          <p className="text-gray-600 mt-2">Enter phone number to check in</p>
        </div>

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
                className="w-full pl-10 pr-10 py-4 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
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
                className="w-full pl-10 pr-4 py-4 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
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
                className="w-full pl-10 pr-4 py-4 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
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
                className={`py-3 px-4 rounded-lg border-2 font-medium transition-colors ${
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
                className={`py-3 px-4 rounded-lg border-2 font-medium transition-colors ${
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
                className="w-full py-4 px-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                required
              >
                <option value="">Select an option</option>
                {howHeardOptions.map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || !formData.phone || !formData.name || !formData.church || !formData.category}
            className="w-full bg-primary-500 hover:bg-primary-600 disabled:bg-gray-300 text-white font-semibold py-4 px-4 rounded-lg transition duration-200 flex items-center justify-center text-lg"
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
