import { useState } from 'react'
import PreviewTable from './PreviewTable.jsx'
import SkippedModal from './SkippedModal.jsx'
import './ResultsPanel.css'

export default function ResultsPanel({ result, sessionId, fileName, onReset }) {
  const [showSkipped, setShowSkipped] = useState(false)

  if (!result) return null

  const { qa, cleanCount, flaggedCount, skipped, conflicts, elapsed } = result
  const summary = qa?.summary || {}
  const qualityScore = qa?.qualityScore ?? 0
  const plainSummary = qa?.plainEnglishSummary || ''

  const scoreClass =
    qualityScore >= 80 ? 'results__score--good' :
    qualityScore >= 50 ? 'results__score--ok' :
    'results__score--bad'

  return (
    <div className="results">
      <div className="results__header">
        <div className="results__header-text">
          <h2 className="results__title">Inventory Ready</h2>
          <p className="results__subtitle">
            Processed <strong>{summary.totalProcessed || 0}</strong> items from{' '}
            <span className="results__filename">{fileName}</span>
            {elapsed && <> in {elapsed}s</>}
          </p>
        </div>
        <div className={`results__score ${scoreClass}`}>
          <span className="results__score-num">{qualityScore}</span>
          <span className="results__score-label">Quality</span>
        </div>
      </div>

      {/* Download buttons */}
      <div className="results__downloads">
        <a
          href={`/api/download/${sessionId}/clean`}
          className="results__download results__download--clean"
          download
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
          </svg>
          Clean Inventory
          <span className="results__download-count">{cleanCount}</span>
        </a>
        <a
          href={`/api/download/${sessionId}/flagged`}
          className="results__download results__download--flagged"
          download
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
          </svg>
          Flagged Items
          <span className="results__download-count">{flaggedCount}</span>
        </a>
      </div>

      {/* Summary */}
      {plainSummary && (
        <p className="results__summary">{plainSummary}</p>
      )}

      {/* Stats grid */}
      <div className="results__stats">
        <div className="results__stat">
          <span className="results__stat-num results__stat-num--clean">{summary.cleanCount || 0}</span>
          <span className="results__stat-label">Clean</span>
        </div>
        <div className="results__stat">
          <span className="results__stat-num results__stat-num--flagged">{summary.flaggedCount || 0}</span>
          <span className="results__stat-label">Flagged</span>
        </div>
        <div className="results__stat">
          <span className="results__stat-num results__stat-num--skipped">{summary.skippedCount || 0}</span>
          <span className="results__stat-label">Skipped</span>
        </div>
        <div className="results__stat">
          <span className="results__stat-num results__stat-num--conflicts">{summary.conflictsResolved || 0}</span>
          <span className="results__stat-label">Conflicts</span>
        </div>
      </div>

      {/* Conflicts mini-report */}
      {conflicts && conflicts.length > 0 && (
        <div className="results__card">
          <h3 className="results__card-title">Conflicts Resolved</h3>
          <ul className="results__conflict-list">
            {conflicts.slice(0, 5).map((c, i) => (
              <li key={i} className="results__conflict-item">
                <span className="results__conflict-upc">UPC {c.upc}</span>
                <span className="results__conflict-reason">{c.reason}</span>
              </li>
            ))}
            {conflicts.length > 5 && (
              <li className="results__conflict-more">
                +{conflicts.length - 5} more conflicts
              </li>
            )}
          </ul>
        </div>
      )}

      {/* Skipped items */}
      {skipped && skipped.length > 0 && (
        <button
          className="results__skipped-btn"
          onClick={() => setShowSkipped(true)}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4M12 16h.01" />
          </svg>
          {skipped.length} items skipped — click to view
        </button>
      )}

      {/* Preview table */}
      {result.clean && result.clean.length > 0 && (
        <div className="results__preview-section">
          <h3 className="results__card-title">Preview (first 10 rows)</h3>
          <PreviewTable rows={result.clean} />
        </div>
      )}

      {/* Restart */}
      <button className="results__restart" onClick={onReset}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        Drop a new file
      </button>

      {/* Skipped modal */}
      <SkippedModal
        open={showSkipped}
        onClose={() => setShowSkipped(false)}
        skipped={skipped || []}
      />
    </div>
  )
}
