import { useEffect, useState } from 'react'
import AppShell from '../components/layout/AppShell'
import RoleGate from '../components/common/RoleGate'
import { useActiveAuction } from '../hooks/useActiveAuction'
import { createCategory, deleteCategory, listCategories, updateCategory } from '../lib/api'

const blank = { name: '', sequence_order: 1, minimum_required: 0, maximum_allowed: 0 }
const FIELD_LABELS = {
  sequence_order: 'Sequence order',
  minimum_required: 'Minimum required',
  maximum_allowed: 'Maximum allowed'
}

export default function CategoryConfig() {
  const { auction } = useActiveAuction()
  const [items, setItems] = useState([])
  const [form, setForm] = useState(blank)
  const [editId, setEditId] = useState(null)

  const reload = async () => {
    if (!auction) return
    setItems(await listCategories(auction.id))
  }
  useEffect(() => { reload() }, [auction])

  const save = async () => {
    const payload = { ...form, auction_id: auction.id, maximum_allowed: form.maximum_allowed || null }
    if (editId) await updateCategory(editId, payload)
    else await createCategory(payload)
    setForm(blank)
    setEditId(null)
    await reload()
  }

  if (!auction) {
    return (
      <AppShell title="Category Configuration">
        <RoleGate allow={['admin']}>
          <p className="text-teal-400">No auction selected. Create or select one on the Auctions screen.</p>
        </RoleGate>
      </AppShell>
    )
  }

  return (
    <AppShell title="Category Configuration">
      <RoleGate allow={['admin']}>
        <div className="grid md:grid-cols-3 gap-4">
          <div className="rounded-xl border border-teal-700/40 bg-ink-800/60 p-4 space-y-2">
            <label className="block text-xs text-teal-300 uppercase tracking-wide">
              Category name
              <input
                placeholder="e.g. Wicketkeeper"
                value={form.name}
                onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
                className="mt-1 w-full rounded-lg bg-ink-900 border border-teal-700/50 px-3 py-2"
              />
            </label>
            {['sequence_order', 'minimum_required', 'maximum_allowed'].map((f) => (
              <label key={f} className="block text-xs text-teal-300 uppercase tracking-wide">
                {FIELD_LABELS[f]}
                <input
                  placeholder={FIELD_LABELS[f]}
                  value={form[f]}
                  onChange={(e) => setForm((s) => ({ ...s, [f]: Number(e.target.value || 0) }))}
                  className="mt-1 w-full rounded-lg bg-ink-900 border border-teal-700/50 px-3 py-2"
                />
              </label>
            ))}
            <button onClick={save} className="px-4 py-2 rounded-lg bg-gold text-ink-900 font-semibold">Save</button>
          </div>
          <div className="md:col-span-2 rounded-xl border border-teal-700/40 bg-ink-800/60 p-4 space-y-2">
            {items.map((c) => (
              <div key={c.id} className="border border-teal-700/40 rounded-lg p-3 flex justify-between">
                <div>
                  <p>{c.sequence_order}. {c.name}</p>
                  <p className="text-xs text-teal-300">Min {c.minimum_required} · Max {c.maximum_allowed ?? '-'}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setEditId(c.id); setForm(c) }} className="px-2 py-1 text-xs rounded bg-teal-700/50">Edit</button>
                  <button onClick={async () => {
                    if (!window.confirm(`Delete category "${c.name}"? This cannot be undone.`)) return
                    await deleteCategory(c.id); reload()
                  }} className="px-2 py-1 text-xs rounded bg-live/40">Delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </RoleGate>
    </AppShell>
  )
}

