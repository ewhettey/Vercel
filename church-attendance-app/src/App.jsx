import React, { useEffect } from 'react'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Login from './components/Login'
import Dashboard from './components/Dashboard'
import OfflineIndicator from './components/OfflineIndicator'
import { useOfflineSync } from './hooks/useOfflineSync'
import './App.css'

function AppContent() {
  const { user, loading } = useAuth()
  const { registerServiceWorker } = useOfflineSync()

  useEffect(() => {
    // Register service worker for PWA functionality
    registerServiceWorker()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    )
  }

  return (
    <>
      <OfflineIndicator />
      {user ? <Dashboard /> : <Login />}
    </>
  )
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}

export default App
