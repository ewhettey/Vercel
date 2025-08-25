import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { Calendar, Users, UserPlus, TrendingUp, Download } from 'lucide-react'
import { format, subDays, startOfWeek, endOfWeek } from 'date-fns'

const Reports = () => {
  const [attendanceData, setAttendanceData] = useState([])
  const [stats, setStats] = useState({
    totalToday: 0,
    totalThisWeek: 0,
    membersToday: 0,
    visitorsToday: 0
  })
  const [weeklyData, setWeeklyData] = useState([])
  const [categoryData, setCategoryData] = useState([])
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState('today')

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444']

  useEffect(() => {
    fetchReportsData()
  }, [dateRange])

  const fetchReportsData = async () => {
    setLoading(true)
    try {
      const now = new Date()
      const toISODate = (d) => d.toISOString().split('T')[0]
      const startOfDayISO = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString()
      const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)

      const today = toISODate(now)
      const todayStartISO = startOfDayISO(now)
      const tomorrowStartISO = startOfDayISO(addDays(now, 1))

      const weekStartDate = startOfWeek(now)
      const weekEndDate = endOfWeek(now)
      const weekStartStartISO = startOfDayISO(weekStartDate)
      const weekEndNextStartISO = startOfDayISO(addDays(weekEndDate, 1))

      // Fetch today's attendance
      const { data: todayData } = await supabase
        .from('attendance_with_user')
        .select('*')
        .gte('created_at', todayStartISO)
        .lt('created_at', tomorrowStartISO)

      // Fetch this week's attendance
      const { data: weekData } = await supabase
        .from('attendance_with_user')
        .select('*')
        .gte('created_at', weekStartStartISO)
        .lt('created_at', weekEndNextStartISO)

      // Calculate stats
      const membersToday = todayData?.filter(record => record.category === 'Member').length || 0
      const visitorsToday = todayData?.filter(record => record.category === 'Visitor').length || 0

      setStats({
        totalToday: todayData?.length || 0,
        totalThisWeek: weekData?.length || 0,
        membersToday,
        visitorsToday
      })

      // Prepare weekly chart data
      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const date = subDays(new Date(), 6 - i)
        const dateStr = toISODate(date)
        const dayData = (weekData || []).filter(record => {
          const recDate = toISODate(new Date(record.created_at))
          return recDate === dateStr
        })
        
        return {
          date: format(date, 'MMM dd'),
          members: dayData.filter(record => record.category === 'Member').length,
          visitors: dayData.filter(record => record.category === 'Visitor').length,
          total: dayData.length
        }
      })

      setWeeklyData(last7Days)

      // Prepare category pie chart data
      const categoryStats = [
        { name: 'Members', value: membersToday, color: '#3b82f6' },
        { name: 'Visitors', value: visitorsToday, color: '#10b981' }
      ].filter(item => item.value > 0)

      setCategoryData(categoryStats)

      // Fetch attendance history based on date range
      let query = supabase.from('attendance_with_user').select('*')
      
      if (dateRange === 'today') {
        query = query.gte('created_at', todayStartISO).lt('created_at', tomorrowStartISO)
      } else if (dateRange === 'week') {
        query = query.gte('created_at', weekStartStartISO).lt('created_at', weekEndNextStartISO)
      } else if (dateRange === 'month') {
        const now2 = new Date()
        const monthStartDate = new Date(now2.getFullYear(), now2.getMonth(), 1)
        const monthStartISO = monthStartDate.toISOString()
        query = query.gte('created_at', monthStartISO)
      }

      const { data: historyData } = await query.order('created_at', { ascending: false })
      setAttendanceData(historyData || [])

    } catch (error) {
      console.error('Error fetching reports data:', error)
    } finally {
      setLoading(false)
    }
  }

  const exportData = () => {
    const csvContent = [
      ['Date', 'Name', 'Phone', 'Church', 'Category', 'How Heard', 'Marked By'],
      ...attendanceData.map(record => [
        format(new Date(record.created_at), 'yyyy-MM-dd'),
        record.name,
        record.phone,
        record.church,
        record.category,
        record.how_heard || '',
        record.marked_by_name || record.marked_by
      ])
    ].map(row => row.join(',')).join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `attendance-report-${dateRange}-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Today's Total</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.totalToday}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">This Week</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.totalThisWeek}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Users className="w-6 h-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Members Today</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.membersToday}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 bg-orange-100 rounded-lg">
              <UserPlus className="w-6 h-6 text-orange-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Visitors Today</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.visitorsToday}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weekly Attendance Chart */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Weekly Attendance</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={weeklyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="members" stackId="a" fill="#3b82f6" name="Members" />
              <Bar dataKey="visitors" stackId="a" fill="#10b981" name="Visitors" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Category Distribution */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Today's Distribution</h3>
          {categoryData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value, percent }) => `${name}: ${value} (${(percent * 100).toFixed(0)}%)`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-500">
              No attendance data for today
            </div>
          )}
        </div>
      </div>

      {/* Attendance History */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Attendance History</h3>
            <div className="mt-4 sm:mt-0 flex space-x-3">
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
              </select>
              <button
                onClick={exportData}
                className="flex items-center space-x-2 bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>Export</span>
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Phone
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Church
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Marked By
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {attendanceData.map((record) => (
                <tr key={record.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {record.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {record.phone}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {record.church}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      record.category === 'Member' 
                        ? 'bg-blue-100 text-blue-800' 
                        : 'bg-green-100 text-green-800'
                    }`}>
                      {record.category}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {format(new Date(record.created_at), 'MMM dd, yyyy')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {record.marked_by_name || record.marked_by}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {attendanceData.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              No attendance records found for the selected period.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Reports
