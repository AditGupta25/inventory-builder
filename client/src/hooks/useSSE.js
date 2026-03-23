import { useEffect, useRef } from 'react'

/**
 * EventSource lifecycle hook.
 * Connects to SSE endpoint when active, auto-cleans up on unmount or sessionId change.
 */
export function useSSE(sessionId, active, onEvent) {
  const eventSourceRef = useRef(null)
  const onEventRef = useRef(onEvent)
  onEventRef.current = onEvent

  useEffect(() => {
    if (!sessionId || !active) return

    const es = new EventSource(`/api/progress?session=${sessionId}`)
    eventSourceRef.current = es

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        onEventRef.current(data)
      } catch {
        // ignore parse errors
      }
    }

    es.onerror = () => {
      // EventSource will auto-reconnect; only close if session is done
      if (es.readyState === EventSource.CLOSED) {
        es.close()
      }
    }

    return () => {
      es.close()
      eventSourceRef.current = null
    }
  }, [sessionId, active])
}
