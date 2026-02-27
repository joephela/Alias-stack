import AliasRow from './AliasRow'

export default function AliasList({ aliases, shellFile, loading, error, onAddNew, onEdit, onDelete, onReload }) {
  return (
    <div className="screen">
      <header className="topbar">
        <div className="topbar-left">
          <h1 className="app-title">Alias Manager</h1>
          {shellFile && (
            <span className="shell-file-badge" title={shellFile}>
              {shellFile}
            </span>
          )}
        </div>
        <div className="topbar-right">
          <button className="btn btn-primary" onClick={onAddNew}>
            + Add New Alias
          </button>
        </div>
      </header>

      <main className="content">
        {loading && (
          <div className="state-message">Loading aliases…</div>
        )}

        {!loading && error && (
          <div className="state-error">
            <p>Failed to read shell config: {error}</p>
            <button className="btn btn-secondary" onClick={onReload}>Retry</button>
          </div>
        )}

        {!loading && !error && aliases.length === 0 && (
          <div className="state-empty">
            <p>No aliases found in <code>{shellFile || 'your shell config'}</code>.</p>
            <button className="btn btn-primary" onClick={onAddNew}>Add your first alias</button>
          </div>
        )}

        {!loading && !error && aliases.length > 0 && (
          <table className="alias-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Command</th>
                <th>Description</th>
                <th>Actions</th>
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
