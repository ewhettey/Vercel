import React from 'react'
import { useAuth } from '../contexts/AuthContext'
import { Users, UserPlus, BarChart3, LogOut, Calendar, Settings } from 'lucide-react'
import AttendanceForm from './AttendanceForm'
import Reports from './Reports'
import MemberManagement from './MemberManagement'

const Dashboard = () => {
  const { user, userProfile, signOut } = useAuth()
  const [activeTab, setActiveTab] = React.useState('attendance')

  const handleSignOut = async () => {
    await signOut()
  }

  const getTabsForRole = (role) => {
    const baseTabs = []
    
    if (role === 'Admin') {
      baseTabs.push(
        { id: 'attendance', label: 'Attendance', icon: Calendar },
        { id: 'members', label: 'Members', icon: Users },
        { id: 'reports', label: 'Reports', icon: BarChart3 },
        { id: 'settings', label: 'Settings', icon: Settings }
      )
    } else if (role === 'Usher') {
      baseTabs.push(
        { id: 'attendance', label: 'Attendance', icon: Calendar }
      )
    } else if (role === 'Pastor') {
      baseTabs.push(
        { id: 'reports', label: 'Reports', icon: BarChart3 }
      )
    }
    
    return baseTabs
  }

  const tabs = getTabsForRole(userProfile?.role || 'Usher')

  const renderTabContent = () => {
    switch (activeTab) {
      case 'attendance':
        return <AttendanceForm />
      case 'members':
        return <MemberManagement />
      case 'reports':
        return <Reports />
      case 'settings':
        return <div className="p-4 text-center text-gray-500">Settings coming soon...</div>
      default:
        return <AttendanceForm />
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-primary-500 rounded-full flex items-center justify-center">
                <Calendar className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Church Attendance</h1>
                <p className="text-sm text-gray-500">
                  Welcome, {userProfile?.name || user?.email} ({userProfile?.role || 'User'})
                </p>
              </div>
            </div>
            <button
              onClick={handleSignOut}
              className="flex items-center space-x-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              <LogOut className="w-5 h-5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8 overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{tab.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {renderTabContent()}
      </div>
    </div>
  )
}

export default Dashboard
