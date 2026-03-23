import { useEffect, useRef, useState } from 'react'
import './SkippedModal.css'

export default function SkippedModal({ open, onClose, skipped }) {
  const dialogRef = useRef(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (open && !dialog.open) {
      dialog.showModal()
    } else if (!open && dialog.open) {
      dialog.close()
    }
  }, [open])

  const handleCopy = async () => {
    const text = skipped
      .map((s, i) => `${i + 1}. ${s.row?.name || s.row?.upc || 'Unknown'} — ${s.reason}`)
      .join('\n')

    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for non-secure contexts
      const textarea = document.createElement('textarea')
      textarea.value = text
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleBackdropClick = (e) => {
    if (e.target === dialogRef.current) {
      onClose()
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="skipped-modal"
      onClick={handleBackdropClick}
      onClose={onClose}
      aria-label="Skipped items"
    >
      <div className="skipped-modal__content">
        <div className="skipped-modal__header">
          <h3 className="skipped-modal__title">
            Skipped Items ({skipped.length})
          </h3>
          <button
            className="skipped-modal__close"
            onClick={onClose}
            aria-label="Close modal"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <p className="skipped-modal__desc">
          These items were excluded from the final inventory because they lacked a valid UPC or had other critical issues.
        </p>

        <ul className="skipped-modal__list">
          {skipped.map((item, i) => (
            <li key={i} className="skipped-modal__item">
              <span className="skipped-modal__item-num">{i + 1}</span>
              <div className="skipped-modal__item-info">
                <span className="skipped-modal__item-name">
                  {item.row?.name || item.row?.upc || 'Unknown item'}
                </span>
                <span className="skipped-modal__item-reason">{item.reason}</span>
              </div>
            </li>
          ))}
        </ul>

        <button className="skipped-modal__copy" onClick={handleCopy}>
          {copied ? (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M20 6L9 17l-5-5" />
              </svg>
              Copied!
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="9" y="9" width="13" height="13" rx="2" />
                <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
              </svg>
              Copy to clipboard
            </>
          )}
        </button>
      </div>
    </dialog>
  )
}
