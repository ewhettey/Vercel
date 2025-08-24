import React from 'react'
import { useOfflineSync } from '../hooks/useOfflineSync'
import { Wifi, WifiOff, Cloud, CloudOff } from 'lucide-react'

const OfflineIndicator = () => {
  const { isOnline, offlineCount } = useOfflineSync()

  if (isOnline && offlineCount === 0) {
    return null
  }

  return (
    <div className={`fixed top-0 left-0 right-0 z-50 px-4 py-2 text-sm font-medium text-center ${
      isOnline ? 'bg-blue-500 text-white' : 'bg-orange-500 text-white'
    }`}>
      <div className="flex items-center justify-center space-x-2">
        {isOnline ? (
          <>
            <Cloud className="w-4 h-4" />
            <span>
              {offlineCount > 0 
                ? `Syncing ${offlineCount} offline records...` 
                : 'Connected'
              }
            </span>
          </>
        ) : (
          <>
            <CloudOff className="w-4 h-4" />
            <span>
              Offline mode - {offlineCount} records stored locally
            </span>
          </>
        )}
      </div>
    </div>
  )
}

export default OfflineIndicator
