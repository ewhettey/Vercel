// Utility functions for event time windows and status
// Handles overnight events and the app's check-in window: [start - 2h, (end||start) + 2h]

export function buildEventTimestamps(ev) {
  // Returns { start: Date|null, endBase: Date|null } using local time
  if (!ev || !ev.event_date) return { start: null, endBase: null }
  const [y, m, d] = ev.event_date.split('-').map(Number)
  if (!ev.start_time) {
    return { start: null, endBase: null }
  }
  const [sh, sm, ss] = (ev.start_time || '00:00:00').split(':').map(Number)
  const start = new Date(y, (m - 1), d, sh || 0, sm || 0, ss || 0, 0)

  const endStr = ev.end_time || ev.start_time
  const [eh, em, es] = (endStr || '00:00:00').split(':').map(Number)
  // End date part uses end_date if provided, else event_date
  const [ey, emon, ed] = (ev.end_date || ev.event_date).split('-').map(Number)
  let endBase = new Date(ey, (emon - 1), ed, eh || 0, em || 0, es || 0, 0)
  // If end_date not provided and end_time is before start_time, treat as overnight
  if (!ev.end_date && ev.end_time && endBase < start) {
    endBase = new Date(endBase.getTime() + 24 * 60 * 60 * 1000)
  }
  return { start, endBase }
}

export function getWindow(ev) {
  // Returns { windowStart: Date|null, windowEnd: Date|null }
  const { start, endBase } = buildEventTimestamps(ev)
  if (!start) {
    // No start time: window is the event date only (local)
    const [y, m, d] = ev.event_date.split('-').map(Number)
    const dayStart = new Date(y, (m - 1), d, 0, 0, 0, 0)
    const dayEnd = new Date(y, (m - 1), d, 23, 59, 59, 999)
    return { windowStart: dayStart, windowEnd: dayEnd }
  }
  const windowStart = new Date(start.getTime() - 2 * 60 * 60 * 1000)
  const base = endBase || start
  // Attendance allowed until exactly event end (no grace period)
  const windowEnd = base
  return { windowStart, windowEnd }
}

export function withinWindow(ev, now = new Date()) {
  const { windowStart, windowEnd } = getWindow(ev)
  if (!windowStart || !windowEnd) {
    // Fallback: if no start time, allow only on the event date
    const [y, m, d] = ev.event_date.split('-').map(Number)
    return now.getFullYear() === y && (now.getMonth() + 1) === m && now.getDate() === d
  }
  return now >= windowStart && now <= windowEnd
}

export function getStatus(ev, now = new Date()) {
  const { start, endBase } = buildEventTimestamps(ev)
  
  // For events without start time, use date-based logic
  if (!start) {
    const [y, m, d] = ev.event_date.split('-').map(Number)
    const eventDay = new Date(y, (m - 1), d)
    const endDay = ev.end_date ? (() => {
      const [ey, em, ed] = ev.end_date.split('-').map(Number)
      return new Date(ey, (em - 1), ed)
    })() : eventDay
    
    if (now < eventDay) return 'upcoming'
    if (now > new Date(endDay.getTime() + 24 * 60 * 60 * 1000)) return 'ended'
    return 'ongoing'
  }
  
  // For timed events, show ended immediately when event ends
  const eventEnd = endBase || start
  
  if (now < start) return 'upcoming'
  if (now > eventEnd) return 'ended'
  return 'ongoing'
}

export function formatStatusBadge(ev, now = new Date()) {
  const status = getStatus(ev, now)
  if (status === 'upcoming') return { label: 'Starts soon', color: 'bg-blue-50 text-blue-700 border-blue-200' }
  if (status === 'ended') return { label: 'Ended', color: 'bg-gray-50 text-gray-700 border-gray-200' }
  return { label: 'Ongoing', color: 'bg-green-50 text-green-700 border-green-200' }
}
