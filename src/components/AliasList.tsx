import AliasRow from './AliasRow'
import type { Alias } from '../types/electron'

interface AliasListProps {
  aliases: Alias[]
  shellFile: string
  loading: boolean
  error: string | null
  onAddNew: () => void
  onEdit: (alias: Alias) => void
  onDelete: (name: string) => void
  onReload: () => void
}

const btnBase =
  'inline-flex items-center gap-1.5 px-4 py-[7px] rounded border text-[13px] font-medium ' +
  'cursor-pointer transition-opacity duration-150 whitespace-nowrap ' +
  'hover:opacity-85 disabled:opacity-50 disabled:cursor-not-allowed'

const btnPrimary   = `${btnBase} bg-blue-600 text-white border-blue-600`
const btnSecondary = `${btnBase} bg-white dark:bg-[#2a2a2a] text-gray-800 dark:text-[#f0f0f0] border-gray-200 dark:border-[#3a3a3a]`

const thCls =
  'text-left px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.06em] ' +
  'text-gray-500 bg-gray-50 dark:bg-[#1e1e1e] border-b border-gray-200 dark:border-[#3a3a3a]'

export default function AliasList({ aliases, shellFile, loading, error, onAddNew, onEdit, onDelete, onReload }: AliasListProps) {
  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <header className="flex items-center justify-between px-5 py-3 bg-white dark:bg-[#2a2a2a] border-b border-gray-200 dark:border-[#3a3a3a] shadow-sm shrink-0 app-region-drag">
        <div className="flex items-center gap-3 app-region-no-drag">
          <h1 className="text-base font-semibold">Alias Manager</h1>
          {shellFile && (
            <span
              className="font-mono text-[11px] px-2 py-0.5 bg-gray-100 dark:bg-[#1e1e1e] border border-gray-200 dark:border-[#3a3a3a] rounded-full text-gray-500 cursor-default select-none"
              title={shellFile}
            >
              {shellFile}
            </span>
          )}
        </div>
        <div className="flex items-center gap-[10px] app-region-no-drag">
          <button className={btnPrimary} onClick={onAddNew}>
            + Add New Alias
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-5">
        {loading && (
          <div className="text-center py-16 px-5 text-gray-500 text-[15px]">Loading aliases…</div>
        )}

        {!loading && error && (
          <div className="text-center py-16 px-5 text-gray-500">
            <p className="text-red-600 mb-3.5 font-medium">Failed to read shell config: {error}</p>
            <button className={btnSecondary} onClick={onReload}>Retry</button>
          </div>
        )}

        {!loading && !error && aliases.length === 0 && (
          <div className="text-center py-16 px-5 text-gray-500">
            <p className="mb-[18px] text-[15px]">No aliases found in <code>{shellFile || 'your shell config'}</code>.</p>
            <button className={btnPrimary} onClick={onAddNew}>Add your first alias</button>
          </div>
        )}

        {!loading && !error && aliases.length > 0 && (
          <table className="w-full border-collapse bg-white dark:bg-[#2a2a2a] rounded overflow-hidden shadow-sm">
            <thead>
              <tr>
                <th className={thCls}>Name</th>
                <th className={thCls}>Command</th>
                <th className={thCls}>Description</th>
                <th className={thCls}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {aliases.map(alias => (
                <AliasRow
                  key={alias.name}
                  alias={alias}
                  onEdit={() => onEdit(alias)}
                  onDelete={() => onDelete(alias.name)}
                />
              ))}
            </tbody>
          </table>
        )}
      </main>
    </div>
  )
}
