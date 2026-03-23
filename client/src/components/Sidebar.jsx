import './Sidebar.css'

const NAV_ITEMS = [
  { id: 'upload', label: 'Upload', icon: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z' },
  { id: 'history', label: 'History', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
  { id: 'settings', label: 'Settings', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
]

export default function Sidebar({ phase, fileName, activeNav, onNav }) {
  const statusLabel = phase === 'processing' ? 'Processing' : phase === 'results' ? 'Ready' : null

  return (
    <aside className="sidebar" role="complementary" aria-label="Navigation sidebar">
      {/* Logo */}
      <div className="sidebar__logo">
        <div className="sidebar__logo-icon">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
            <rect width="28" height="28" rx="7" fill="var(--color-primary)" />
            <path d="M8 10h12M8 14h8M8 18h10" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
        <div className="sidebar__logo-text">
          <span className="sidebar__brand">Inventory Builder</span>
          <span className="sidebar__sub">Smart Inventory</span>
        </div>
      </div>

      {/* Status */}
      {statusLabel && (
        <div className="sidebar__status">
          <span
            className={`sidebar__pill sidebar__pill--${phase}`}
            role="status"
            aria-live="polite"
          >
            <span className="sidebar__pill-dot" />
            {statusLabel}
          </span>
          {fileName && (
            <span className="sidebar__filename" title={fileName}>
              {fileName}
            </span>
          )}
        </div>
      )}

      {/* Nav */}
      <nav className="sidebar__nav" aria-label="Main navigation">
        {NAV_ITEMS.map(item => (
          <button
            key={item.id}
            className={`sidebar__nav-item ${item.id === activeNav ? 'sidebar__nav-item--active' : ''}`}
            aria-current={item.id === activeNav ? 'page' : undefined}
            onClick={() => onNav(item.id)}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d={item.icon} />
            </svg>
            {item.label}
          </button>
        ))}
      </nav>

      {/* Footer */}
      <div className="sidebar__footer">
        <div className="sidebar__version">v1.0.0</div>
      </div>
    </aside>
  )
}
