import { useState } from 'react'
import ConfirmDialog from './ConfirmDialog'
import type { Alias } from '../types/electron'

interface AliasRowProps {
  alias: Alias
  onEdit: () => void
  onDelete: () => void
}

export default function AliasRow({ alias, onEdit, onDelete }: AliasRowProps) {
  const [confirming, setConfirming] = useState(false)

  return (
    <>
      <tr>
        <td>
          <code className="alias-name">{alias.name}</code>
        </td>
        <td>
          <code className="alias-command">{alias.command}</code>
        </td>
        <td className="alias-description">
          {alias.description || <span className="muted">—</span>}
        </td>
        <td className="alias-actions">
          <button
            className="btn-icon"
            onClick={onEdit}
            title="Edit alias"
            aria-label={`Edit alias ${alias.name}`}
          >
            ✏️
          </button>
          <button
            className="btn-icon btn-icon-danger"
            onClick={() => setConfirming(true)}
            title="Delete alias"
            aria-label={`Delete alias ${alias.name}`}
          >
            🗑
          </button>
        </td>
      </tr>

      {confirming && (
        <ConfirmDialog
          message={`Delete alias "${alias.name}"?`}
          detail="This will remove the alias line from your shell config file. The change takes effect in new terminal sessions."
          onConfirm={() => { setConfirming(false); onDelete() }}
          onCancel={() => setConfirming(false)}
        />
      )}
    </>
  )
}
