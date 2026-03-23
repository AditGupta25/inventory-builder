import RobotAnimation from './RobotAnimation.jsx'
import './LoadingPanel.css'

const AGENT_LABELS = [
  { name: 'File Parser', message: 'Cracking open your file and reading every row...' },
  { name: 'Field Normalizer', message: 'Teaching your columns proper names...' },
  { name: 'UPC Conflict Resolver', message: 'Settling disputes between duplicate UPCs...' },
  { name: 'Category Mapper', message: 'Sorting products into their perfect categories...' },
  { name: 'Inventory Formatter', message: 'Polishing each row for the inventory template...' },
  { name: 'QA Validator', message: 'Running final quality checks on everything...' },
]

const FUN_FACTS = [
  'UPC barcodes were first used on a pack of Wrigley\'s gum in 1974.',
  'The average convenience store carries around 3,000 unique items.',
  'A well-organized inventory can boost sales by up to 20%.',
  'A single mistyped UPC digit can mix up completely different products.',
  'Category mapping helps customers find exactly what they need.',
]

export default function LoadingPanel({ agents, currentAgent, fileName }) {
  const progress = agents.length > 0
    ? agents.filter(a => a.status === 'complete').length / 6
    : 0
  const progressPct = Math.round(progress * 100)
  const isComplete = progressPct === 100

  const latestRows = agents
    .filter(a => a.rows_processed)
    .slice(-1)[0]?.rows_processed || 0

  const factIndex = Math.min(currentAgent - 1, FUN_FACTS.length - 1)
  const funFact = factIndex >= 0 ? FUN_FACTS[factIndex] : FUN_FACTS[0]

  return (
    <div className="loading">
      <RobotAnimation isComplete={isComplete} />

      <h2 className="loading__title">
        {isComplete ? 'All done!' : 'Processing your inventory'}
      </h2>
      <p className="loading__file">{fileName}</p>

      {/* Progress bar */}
      <div className="loading__progress-wrap">
        <div
          className="loading__progress-bar"
          role="progressbar"
          aria-valuenow={progressPct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Pipeline progress"
        >
          <div
            className="loading__progress-fill"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <div className="loading__progress-meta">
          <span className="loading__progress-pct">{progressPct}%</span>
          {latestRows > 0 && (
            <span className="loading__row-badge">
              {latestRows} rows
            </span>
          )}
        </div>
      </div>

      {/* Agent feed */}
      <div className="loading__feed" aria-live="polite" aria-label="Agent progress">
        {AGENT_LABELS.map((agent, idx) => {
          const agentData = agents.find(a => a.agent === idx + 1)
          const status = agentData?.status || 'pending'
          const isCurrent = currentAgent === idx + 1 && status !== 'complete'

          return (
            <div
              key={idx}
              className={`loading__agent loading__agent--${status} ${isCurrent ? 'loading__agent--current' : ''}`}
            >
              <div className="loading__agent-icon">
                {status === 'complete' ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" fill="var(--color-success)" />
                    <path d="M8 12l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : isCurrent ? (
                  <div className="loading__spinner" />
                ) : (
                  <div className="loading__dot" />
                )}
              </div>
              <div className="loading__agent-info">
                <span className="loading__agent-name">{agent.name}</span>
                <span className="loading__agent-msg">
                  {isCurrent ? (agentData?.message || agent.message) : status === 'complete' ? 'Done' : ''}
                </span>
              </div>
              {agentData?.rows_processed && status === 'complete' && (
                <span className="loading__agent-rows">{agentData.rows_processed} rows</span>
              )}
            </div>
          )
        })}
      </div>

      {/* Fun fact */}
      <div className="loading__fact">
        <span className="loading__fact-label">Did you know?</span>
        {funFact}
      </div>
    </div>
  )
}
