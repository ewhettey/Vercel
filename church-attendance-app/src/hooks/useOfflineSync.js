import { useState, useEffect } from 'react'

export const useOfflineSync = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [offlineCount, setOfflineCount] = useState(0)

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      // Trigger sync when coming back online
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'SYNC_OFFLINE_DATA'
        })
      }
    }

    const handleOffline = () => {
      setIsOnline(false)
    }

    const handleSyncComplete = (event) => {
      if (event.data && event.data.type === 'SYNC_COMPLETE') {
        console.log(`Synced ${event.data.synced} records, ${event.data.failed} failed`)
        updateOfflineCount()
      }
    }

    // Update offline count on mount and when storage changes
    const updateOfflineCount = () => {
      const offlineData = JSON.parse(localStorage.getItem('offline-attendance') || '[]')
      setOfflineCount(offlineData.length)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    navigator.serviceWorker?.addEventListener('message', handleSyncComplete)

    // Initial count
    updateOfflineCount()

    // Listen for storage changes
    window.addEventListener('storage', updateOfflineCount)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      navigator.serviceWorker?.removeEventListener('message', handleSyncComplete)
      window.removeEventListener('storage', updateOfflineCount)
    }
  }, [])

  const registerServiceWorker = async () => {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js')
        console.log('SW registered: ', registration)
        
        // Enable background sync if supported
        if ('sync' in window.ServiceWorkerRegistration.prototype) {
          await registration.sync.register('attendance-sync')
        }
        
        return registration
      } catch (error) {
        console.log('SW registration failed: ', error)
      }
    }
  }

  return {
    isOnline,
    offlineCount,
    registerServiceWorker
  }
}
