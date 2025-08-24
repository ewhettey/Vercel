const CACHE_NAME = 'church-attendance-v1'
const STATIC_CACHE_URLS = [
  '/',
  '/static/js/bundle.js',
  '/static/css/main.css',
  '/manifest.json',
  '/icon-192x192.png',
  '/icon-512x512.png'
]

const OFFLINE_ATTENDANCE_KEY = 'offline-attendance'

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(STATIC_CACHE_URLS)
      })
      .catch((error) => {
        console.log('Cache install failed:', error)
      })
  )
  self.skipWaiting()
})

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName)
          }
        })
      )
    })
  )
  self.clients.claim()
})

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Handle API requests to Supabase
  if (url.hostname.includes('supabase')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // If it's a POST request to attendance table and we're offline, store it
          if (request.method === 'POST' && url.pathname.includes('attendance')) {
            // Clone the request to read the body
            const clonedRequest = request.clone()
            clonedRequest.json().then((data) => {
              storeOfflineAttendance(data)
            }).catch(() => {
              // Ignore errors in reading request body
            })
          }
          return response
        })
        .catch(() => {
          // If network fails and it's a GET request, try to serve from cache
          if (request.method === 'GET') {
            return caches.match(request)
          }
          // For POST requests (like attendance), return a custom response
          if (request.method === 'POST' && url.pathname.includes('attendance')) {
            return new Response(JSON.stringify({ 
              success: false, 
              offline: true,
              message: 'Stored offline, will sync when online' 
            }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            })
          }
          throw new Error('Network failed and no cache available')
        })
    )
    return
  }

  // Handle static assets
  event.respondWith(
    caches.match(request)
      .then((response) => {
        // Return cached version or fetch from network
        return response || fetch(request)
      })
      .catch(() => {
        // If both cache and network fail, return offline page for navigation requests
        if (request.destination === 'document') {
          return caches.match('/')
        }
        throw new Error('Resource not available offline')
      })
  )
})

// Store attendance data for offline sync
function storeOfflineAttendance(attendanceData) {
  return new Promise((resolve) => {
    // Get existing offline data
    const existingData = JSON.parse(localStorage.getItem(OFFLINE_ATTENDANCE_KEY) || '[]')
    
    // Add timestamp and offline flag
    const offlineRecord = {
      ...attendanceData,
      offline: true,
      timestamp: new Date().toISOString()
    }
    
    existingData.push(offlineRecord)
    localStorage.setItem(OFFLINE_ATTENDANCE_KEY, JSON.stringify(existingData))
    resolve()
  })
}

// Listen for messages from the main thread
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SYNC_OFFLINE_DATA') {
    syncOfflineData()
  }
})

// Sync offline attendance data when online
async function syncOfflineData() {
  try {
    const offlineData = JSON.parse(localStorage.getItem(OFFLINE_ATTENDANCE_KEY) || '[]')
    
    if (offlineData.length === 0) {
      return
    }

    // Try to sync each record
    const syncPromises = offlineData.map(async (record) => {
      try {
        const response = await fetch('/api/attendance', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...record,
            offline: undefined, // Remove offline flag
            timestamp: undefined // Remove timestamp
          })
        })
        
        if (response.ok) {
          return { success: true, record }
        } else {
          return { success: false, record, error: 'Server error' }
        }
      } catch (error) {
        return { success: false, record, error: error.message }
      }
    })

    const results = await Promise.all(syncPromises)
    const successful = results.filter(r => r.success)
    const failed = results.filter(r => !r.success)

    // Remove successfully synced records
    if (successful.length > 0) {
      const remainingData = failed.map(r => r.record)
      localStorage.setItem(OFFLINE_ATTENDANCE_KEY, JSON.stringify(remainingData))
    }

    // Notify the main thread about sync results
    self.clients.matchAll().then(clients => {
      clients.forEach(client => {
        client.postMessage({
          type: 'SYNC_COMPLETE',
          synced: successful.length,
          failed: failed.length
        })
      })
    })

  } catch (error) {
    console.error('Sync failed:', error)
  }
}

// Background sync for attendance data
self.addEventListener('sync', (event) => {
  if (event.tag === 'attendance-sync') {
    event.waitUntil(syncOfflineData())
  }
})

// Push notifications (for future use)
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json()
    const options = {
      body: data.body,
      icon: '/icon-192x192.png',
      badge: '/icon-192x192.png',
      vibrate: [100, 50, 100],
      data: {
        dateOfArrival: Date.now(),
        primaryKey: 1
      }
    }
    event.waitUntil(
      self.registration.showNotification(data.title, options)
    )
  }
})
