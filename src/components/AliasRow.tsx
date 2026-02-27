import { useState } from 'react'
import ConfirmDialog from './ConfirmDialog'
import type { Alias } from '../types/electron'

interface AliasRowProps {
  alias: Alias
  onEdit: () => void
  onDelete: () => void
}

const tdCls = 'px-3.5 py-[11px] border-b border-gray-200 dark:border-[#3a3a3a] align-middle'

const iconBtn =
  'inline-flex items-center justify-center bg-transparent border-none p-[5px_8px] ' +
  'rounded cursor-pointer text-sm leading-none opacity-55 ' +
  'transition-[opacity,background] duration-100 hover:opacity-100 hover:bg-gray-200 dark:hover:bg-[#3a3a3a]'

export default function AliasRow({ alias, onEdit, onDelete }: AliasRowProps) {
  const [confirming, setConfirming] = useState(false)

  return (
    <>
      <tr className="[&:last-child>td]:border-b-0 hover:bg-gray-50 dark:hover:bg-[#1e1e1e]">
        <td className={tdCls}>
          <code className="font-mono font-semibold text-blue-600 dark:text-blue-400 text-[13px]">
            {alias.name}
          </code>
        </td>
        <td className={tdCls}>
          <code className="font-mono text-xs text-gray-800 dark:text-[#f0f0f0]">
            {alias.command}
          </code>
        </td>
        <td className={`${tdCls} text-gray-500 text-[13px]`}>
          {alias.description || <span className="text-gray-400">—</span>}
        </td>
        <td className={`${tdCls} w-[90px] whitespace-nowrap text-right`}>
          <button
            className={iconBtn}
            onClick={onEdit}
            title="Edit alias"
            aria-label={`Edit alias ${alias.name}`}
          >
            ✏️
          </button>
          <button
            className={`${iconBtn} hover:!bg-red-50 dark:hover:!bg-red-900/20`}
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
