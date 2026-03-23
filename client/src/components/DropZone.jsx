import { useState, useRef, useCallback } from 'react'
import './DropZone.css'

const ACCEPTED_FORMATS = [
  { ext: 'CSV', color: '#2ECC71' },
  { ext: 'XLSX', color: '#3498DB' },
  { ext: 'XLS', color: '#2980B9' },
  { ext: 'PDF', color: '#E74C3C' },
  { ext: 'TSV', color: '#9B59B6' },
]

const ACCEPTED_EXTENSIONS = ['.csv', '.xlsx', '.xls', '.pdf', '.tsv', '.txt']

export default function DropZone({ onFileDrop, error }) {
  const [isDragOver, setIsDragOver] = useState(false)
  const [selectedFile, setSelectedFile] = useState(null)
  const fileInputRef = useRef(null)

  const handleDragOver = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)

    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }, [])

  const handleClick = () => fileInputRef.current?.click()

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (file) processFile(file)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleClick()
    }
  }

  const processFile = (file) => {
    const ext = '.' + file.name.split('.').pop().toLowerCase()
    if (!ACCEPTED_EXTENSIONS.includes(ext)) {
      return
    }
    setSelectedFile(file)
    onFileDrop(file)
  }

  return (
    <div className="dropzone-wrapper">
      <h1 className="dropzone__title">Transform your sales data</h1>
      <p className="dropzone__subtitle">
        Drop a messy sales report and our AI agents will clean, categorize, and format it into a perfect inventory file.
      </p>

      <div
        className={`dropzone ${isDragOver ? 'dropzone--active' : ''} ${selectedFile ? 'dropzone--has-file' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        role="button"
        tabIndex={0}
        aria-label="Drop a file here or click to browse"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_EXTENSIONS.join(',')}
          onChange={handleFileChange}
          className="dropzone__input"
          aria-hidden="true"
          tabIndex={-1}
        />

        <div className="dropzone__icon">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true">
            <rect x="4" y="8" width="40" height="32" rx="4" stroke="var(--color-primary)" strokeWidth="2" fill="none" />
            <path d="M24 18v12M18 24l6-6 6 6" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        <div className="dropzone__text">
          <span className="dropzone__cta">
            {isDragOver ? 'Release to upload' : 'Drag & drop your sales report'}
          </span>
          <span className="dropzone__or">or click to browse files</span>
        </div>

        <div className="dropzone__formats" aria-label="Accepted formats">
          {ACCEPTED_FORMATS.map(f => (
            <span
              key={f.ext}
              className="dropzone__badge"
              style={{ '--badge-color': f.color }}
            >
              {f.ext}
            </span>
          ))}
        </div>

        {/* Drag overlay shimmer */}
        {isDragOver && <div className="dropzone__shimmer" />}
      </div>

      {error && (
        <div className="dropzone__error" role="alert">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4M12 16h.01" />
          </svg>
          {error}
        </div>
      )}
    </div>
  )
}
