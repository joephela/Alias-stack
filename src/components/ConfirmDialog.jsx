import { useEffect } from 'react'
import { createPortal } from 'react-dom'

export default function ConfirmDialog({ message, detail, onConfirm, onCancel }) {
  // Escape key cancels
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onCancel])

  return createPortal(
    <div className="dialog-overlay" onClick={onCancel}>
      <div className="dialog" onClick={e => e.stopPropagation()}>
        <p className="dialog-message">{message}</p>
        {detail && <p className="dialog-detail">{detail}</p>}
        <div className="dialog-actions">
          <button className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn btn-danger" onClick={onConfirm} autoFocus>
            Delete
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
