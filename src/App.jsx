import { useState } from 'react'
import AliasList from './components/AliasList'
import AliasForm from './components/AliasForm'
import { useAliases } from './hooks/useAliases'

export default function App() {
  const { aliases, shellFile, loading, error, reload, saveAlias, deleteAlias } = useAliases()
  const [view, setView]                 = useState('list')   // 'list' | 'form'
  const [editingAlias, setEditingAlias] = useState(null)     // null | { name, command, description }

  function handleAddNew() {
    setEditingAlias(null)
    setView('form')
  }

  function handleEdit(alias) {
    setEditingAlias(alias)
    setView('form')
  }

  function handleCancel() {
    setView('list')
    setEditingAlias(null)
  }

  async function handleSave(aliasData) {
    const result = await saveAlias(aliasData)
    if (result.success) {
      setView('list')
      setEditingAlias(null)
    }
    return result
  }

  async function handleDelete(name) {
    await deleteAlias(name)
  }

  if (view === 'form') {
    return (
      <AliasForm
        initial={editingAlias}
        onSave={handleSave}
        onCancel={handleCancel}
      />
    )
  }

  return (
    <AliasList
      aliases={aliases}
      shellFile={shellFile}
      loading={loading}
      error={error}
      onAddNew={handleAddNew}
      onEdit={handleEdit}
      onDelete={handleDelete}
      onReload={reload}
    />
  )
}
