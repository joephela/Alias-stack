import { useEffect } from 'react'
import { createPortal } from 'react-dom'

interface ConfirmDialogProps {
  message: string
  detail?: string
  onConfirm: () => void
  onCancel: () => void
}

const btnBase =
  'inline-flex items-center gap-1.5 px-4 py-[7px] rounded border text-[13px] font-medium ' +
  'cursor-pointer transition-opacity duration-150 whitespace-nowrap ' +
  'hover:opacity-85 disabled:opacity-50 disabled:cursor-not-allowed'

export default function ConfirmDialog({ message, detail, onConfirm, onCancel }: ConfirmDialogProps) {
  // Escape key cancels
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onCancel])

  return createPortal(
    <div
      className="fixed inset-0 bg-black/45 flex items-center justify-center z-[200] animate-fade-in"
      onClick={onCancel}
    >
      <div
        className="bg-white dark:bg-[#2a2a2a] rounded p-6 w-[340px] shadow-[0_8px_32px_rgba(0,0,0,0.22)] animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        <p className="font-semibold text-[15px] mb-2">{message}</p>
        {detail && <p className="text-gray-500 text-[13px] mb-[22px] leading-[1.4]">{detail}</p>}
        <div className="flex gap-2.5 justify-end">
          <button
            className={`${btnBase} bg-white dark:bg-[#2a2a2a] text-gray-800 dark:text-[#f0f0f0] border-gray-200 dark:border-[#3a3a3a]`}
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className={`${btnBase} bg-red-600 text-white border-red-600`}
            onClick={onConfirm}
            autoFocus
          >
            Delete
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
