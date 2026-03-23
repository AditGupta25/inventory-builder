import { useReducer, useCallback } from 'react'
import Sidebar from './components/Sidebar.jsx'
import DropZone from './components/DropZone.jsx'
import LoadingPanel from './components/LoadingPanel.jsx'
import ResultsPanel from './components/ResultsPanel.jsx'
import { useSSE } from './hooks/useSSE.js'

const initialState = {
  phase: 'upload',        // upload | processing | results
  activeNav: 'upload',    // upload | history | settings
  sessionId: null,
  fileName: null,
  fileType: null,
  agents: [],
  currentAgent: 0,
  result: null,
  error: null,
}

function reducer(state, action) {
  switch (action.type) {
    case 'UPLOAD_START':
      return {
        ...state,
        phase: 'processing',
        activeNav: 'upload',
        sessionId: action.sessionId,
        fileName: action.fileName,
        fileType: action.fileType,
        agents: [],
        currentAgent: 0,
        result: null,
        error: null,
      }

    case 'SSE_EVENT': {
      const event = action.payload
      if (event.status === 'connected') return state

      if (event.status === 'pipeline_complete') {
        return {
          ...state,
          phase: 'results',
          result: event.result,
        }
      }

      if (event.status === 'pipeline_error' || event.status === 'error') {
        return {
          ...state,
          phase: 'upload',
          error: event.message,
        }
      }

      if (event.status === 'start' || event.status === 'progress' || event.status === 'complete') {
        const agents = [...state.agents]
        const idx = agents.findIndex(a => a.agent === event.agent)
        if (idx >= 0) {
          agents[idx] = { ...agents[idx], ...event }
        } else {
          agents.push(event)
        }
        return {
          ...state,
          agents,
          currentAgent: event.agent,
        }
      }

      return state
    }

    case 'NAV':
      return { ...state, activeNav: action.id }

    case 'RESET':
      return { ...initialState }

    case 'SET_ERROR':
      return { ...state, error: action.message, phase: 'upload' }

    default:
      return state
  }
}

export default function App() {
  const [state, dispatch] = useReducer(reducer, initialState)

  const handleSSEEvent = useCallback((event) => {
    dispatch({ type: 'SSE_EVENT', payload: event })
  }, [])

  useSSE(state.sessionId, state.phase === 'processing', handleSSEEvent)

  const handleFileDrop = useCallback(async (file) => {
    try {
      const sessionRes = await fetch('/api/session', { method: 'POST' })
      if (!sessionRes.ok) throw new Error('Failed to create session')
      const { sessionId } = await sessionRes.json()

      const formData = new FormData()
      formData.append('file', file)

      dispatch({
        type: 'UPLOAD_START',
        sessionId,
        fileName: file.name,
        fileType: file.name.split('.').pop().toLowerCase(),
      })

      const uploadRes = await fetch(`/api/upload?session=${sessionId}`, {
        method: 'POST',
        body: formData,
      })

      if (!uploadRes.ok) {
        const err = await uploadRes.json()
        throw new Error(err.error || 'Upload failed')
      }
    } catch (err) {
      dispatch({ type: 'SET_ERROR', message: err.message })
    }
  }, [])

  const handleReset = useCallback(() => {
    dispatch({ type: 'RESET' })
  }, [])

  const handleNav = useCallback((id) => {
    dispatch({ type: 'NAV', id })
  }, [])

  // Determine what to show in the main area
  const showUploadFlow = state.activeNav === 'upload'
  const showHistory = state.activeNav === 'history'
  const showSettings = state.activeNav === 'settings'

  return (
    <div className="app">
      <Sidebar
        phase={state.phase}
        fileName={state.fileName}
        activeNav={state.activeNav}
        onNav={handleNav}
      />
      <main className="app__main">
        {showUploadFlow && state.phase === 'upload' && (
          <div className="phase-enter">
            <DropZone
              onFileDrop={handleFileDrop}
              error={state.error}
            />
          </div>
        )}

        {showUploadFlow && state.phase === 'processing' && (
          <div className="phase-enter">
            <LoadingPanel
              agents={state.agents}
              currentAgent={state.currentAgent}
              fileName={state.fileName}
            />
          </div>
        )}

        {showUploadFlow && state.phase === 'results' && (
          <div className="phase-enter">
            <ResultsPanel
              result={state.result}
              sessionId={state.sessionId}
              fileName={state.fileName}
              onReset={handleReset}
            />
          </div>
        )}

        {showHistory && (
          <div className="phase-enter">
            <div className="placeholder-panel">
              <div className="placeholder-panel__icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="placeholder-panel__title">Processing History</h2>
              <p className="placeholder-panel__text">
                Your past uploads and processed files will appear here. This feature is coming in v2.
              </p>
            </div>
          </div>
        )}

        {showSettings && (
          <div className="phase-enter">
            <div className="placeholder-panel">
              <div className="placeholder-panel__icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h2 className="placeholder-panel__title">Settings</h2>
              <p className="placeholder-panel__text">
                Configure your API key, default categories, and output preferences. Coming in v2.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
