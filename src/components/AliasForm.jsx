import { useState, useEffect } from 'react'

const NAME_RE = /^[\w.:\-]+$/

export default function AliasForm({ initial, onSave, onCancel }) {
  const isEdit = !!initial

  const [name,        setName]        = useState(initial?.name        ?? '')
  const [command,     setCommand]     = useState(initial?.command     ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [errors,      setErrors]      = useState({})
  const [saving,      setSaving]      = useState(false)
  const [saveError,   setSaveError]   = useState(null)

  // Escape key cancels the form
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onCancel])

  function validate() {
    const e = {}
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

  async function handleSubmit(ev) {
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

  function handleNameChange(e) {
    setName(e.target.value)
    if (errors.name) setErrors(prev => ({ ...prev, name: undefined }))
  }

  function handleCommandChange(e) {
    setCommand(e.target.value)
    if (errors.command) setErrors(prev => ({ ...prev, command: undefined }))
  }

  return (
    <div className="screen">
      <header className="topbar">
        <div className="topbar-left">
          <h1 className="app-title">{isEdit ? 'Edit Alias' : 'Add New Alias'}</h1>
        </div>
        <div className="topbar-right">
          <button className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </header>

      <main className="content content-form">
        <form className="alias-form" onSubmit={handleSubmit} noValidate>
          <div className="form-field">
            <label htmlFor="alias-name">
              Name <span className="required">*</span>
            </label>
            <input
              id="alias-name"
              type="text"
              value={name}
              onChange={handleNameChange}
              placeholder="e.g. gs"
              disabled={isEdit}
              className={errors.name ? 'input-error' : ''}
              autoFocus={!isEdit}
              autoComplete="off"
              spellCheck={false}
            />
            {errors.name && <span className="field-error">{errors.name}</span>}
            {isEdit && (
              <span className="field-hint">
                Alias name cannot be changed. Delete and re-add to rename.
              </span>
            )}
          </div>

          <div className="form-field">
            <label htmlFor="alias-command">
              Command <span className="required">*</span>
            </label>
            <input
              id="alias-command"
              type="text"
              value={command}
              onChange={handleCommandChange}
              placeholder="e.g. git status"
              className={errors.command ? 'input-error' : ''}
              autoFocus={isEdit}
              autoComplete="off"
              spellCheck={false}
            />
            {errors.command && <span className="field-error">{errors.command}</span>}
          </div>

          <div className="form-field">
            <label htmlFor="alias-description">
              Description <span className="optional">(optional)</span>
            </label>
            <input
              id="alias-description"
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="e.g. Short for git status"
              autoComplete="off"
            />
          </div>

          {saveError && (
            <div className="save-error">
              Save failed: {saveError}
            </div>
          )}

          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : (isEdit ? 'Save Changes' : 'Add Alias')}
            </button>
            <button type="button" className="btn btn-secondary" onClick={onCancel}>
              Cancel
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}
