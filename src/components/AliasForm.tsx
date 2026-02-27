import { useState, useEffect } from 'react'
import type { Alias, IpcResponse } from '../types/electron'

const NAME_RE = /^[\w.:\-]+$/

interface AliasFormProps {
  initial: Alias | null
  onSave: (alias: Alias) => Promise<IpcResponse>
  onCancel: () => void
}

interface FormErrors {
  name?: string
  command?: string
}

const btnBase =
  'inline-flex items-center gap-1.5 px-4 py-[7px] rounded border text-[13px] font-medium ' +
  'cursor-pointer transition-opacity duration-150 whitespace-nowrap ' +
  'hover:opacity-85 disabled:opacity-50 disabled:cursor-not-allowed'

const btnPrimary   = `${btnBase} bg-blue-600 text-white border-blue-600`
const btnSecondary = `${btnBase} bg-white dark:bg-[#2a2a2a] text-gray-800 dark:text-[#f0f0f0] border-gray-200 dark:border-[#3a3a3a]`

const inputCls =
  'w-full px-3 py-[9px] border rounded ' +
  'bg-white dark:bg-[#2a2a2a] text-gray-800 dark:text-[#f0f0f0] text-sm ' +
  'outline-none transition-[border-color,box-shadow] duration-150 ' +
  'border-gray-200 dark:border-[#3a3a3a] ' +
  'focus:border-blue-600 focus:shadow-focus-ring ' +
  'disabled:opacity-55 disabled:cursor-not-allowed disabled:bg-gray-100 dark:disabled:bg-[#1e1e1e]'

export default function AliasForm({ initial, onSave, onCancel }: AliasFormProps) {
  const isEdit = !!initial

  const [name,        setName]        = useState(initial?.name        ?? '')
  const [command,     setCommand]     = useState(initial?.command     ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [errors,      setErrors]      = useState<FormErrors>({})
  const [saving,      setSaving]      = useState(false)
  const [saveError,   setSaveError]   = useState<string | null>(null)

  // Escape key cancels the form
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onCancel])

  function validate(): FormErrors {
    const e: FormErrors = {}
    if (!name.trim()) {
      e.name = 'Name is required'
    } else if (!NAME_RE.test(name.trim())) {
      e.name = 'Name can only contain letters, digits, _ . : -'
    }
    if (!command.trim()) {
      e.command = 'Command is required'
    }
    return e
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault()
    const e = validate()
    if (Object.keys(e).length) {
      setErrors(e)
      return
    }

    setSaving(true)
    setSaveError(null)

    const result = await onSave({
      name:        name.trim(),
      command:     command.trim(),
      description: description.trim(),
    })

    setSaving(false)
    if (!result.success) {
      setSaveError(result.error || 'Unknown error')
    }
  }

  function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    setName(e.target.value)
    if (errors.name) setErrors(prev => ({ ...prev, name: undefined }))
  }

  function handleCommandChange(e: React.ChangeEvent<HTMLInputElement>) {
    setCommand(e.target.value)
    if (errors.command) setErrors(prev => ({ ...prev, command: undefined }))
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <header className="flex items-center justify-between px-5 py-3 bg-white dark:bg-[#2a2a2a] border-b border-gray-200 dark:border-[#3a3a3a] shadow-sm shrink-0 app-region-drag">
        <div className="flex items-center gap-3 app-region-no-drag">
          <h1 className="text-base font-semibold">{isEdit ? 'Edit Alias' : 'Add New Alias'}</h1>
        </div>
        <div className="flex items-center gap-[10px] app-region-no-drag">
          <button className={btnSecondary} onClick={onCancel}>
            Cancel
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-5">
        <div className="max-w-[520px] mx-auto pt-6">
          <form className="flex flex-col gap-[22px]" onSubmit={handleSubmit} noValidate>

            <div className="flex flex-col gap-[7px]">
              <label htmlFor="alias-name" className="text-[13px] font-medium">
                Name <span className="text-red-600 ml-0.5">*</span>
              </label>
              <input
                id="alias-name"
                type="text"
                value={name}
                onChange={handleNameChange}
                placeholder="e.g. gs"
                disabled={isEdit}
                className={`${inputCls}${errors.name ? ' border-red-600' : ''}`}
                autoFocus={!isEdit}
                autoComplete="off"
                spellCheck={false}
              />
              {errors.name && <span className="text-red-600 text-xs">{errors.name}</span>}
              {isEdit && (
                <span className="text-gray-500 text-xs">
                  Alias name cannot be changed. Delete and re-add to rename.
                </span>
              )}
            </div>

            <div className="flex flex-col gap-[7px]">
              <label htmlFor="alias-command" className="text-[13px] font-medium">
                Command <span className="text-red-600 ml-0.5">*</span>
              </label>
              <input
                id="alias-command"
                type="text"
                value={command}
                onChange={handleCommandChange}
                placeholder="e.g. git status"
                className={`${inputCls}${errors.command ? ' border-red-600' : ''}`}
                autoFocus={isEdit}
                autoComplete="off"
                spellCheck={false}
              />
              {errors.command && <span className="text-red-600 text-xs">{errors.command}</span>}
            </div>

            <div className="flex flex-col gap-[7px]">
              <label htmlFor="alias-description" className="text-[13px] font-medium">
                Description <span className="text-gray-500 text-xs font-normal ml-1">(optional)</span>
              </label>
              <input
                id="alias-description"
                type="text"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="e.g. Short for git status"
                className={inputCls}
                autoComplete="off"
              />
            </div>

            {saveError && (
              <div className="text-red-600 text-[13px] px-3.5 py-2.5 bg-red-600/[.08] border border-red-600/20 rounded">
                Save failed: {saveError}
              </div>
            )}

            <div className="flex gap-2.5 pt-1">
              <button type="submit" className={btnPrimary} disabled={saving}>
                {saving ? 'Saving…' : (isEdit ? 'Save Changes' : 'Add Alias')}
              </button>
              <button type="button" className={btnSecondary} onClick={onCancel}>
                Cancel
              </button>
            </div>

          </form>
        </div>
      </main>
    </div>
  )
}
