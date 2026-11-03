import { createFileRoute } from '@tanstack/react-router'
import { useCallback, useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { Alert, AlertDescription } from '@workspace/ui/components/alert'
import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import { Card, CardContent } from '@workspace/ui/components/card'
import { Input } from '@workspace/ui/components/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@workspace/ui/components/select'
import { Separator } from '@workspace/ui/components/separator'
import { Textarea } from '@workspace/ui/components/textarea'
import { cn } from '@workspace/ui/lib/utils'
import { api, type Category, type Note } from '../api'

export const Route = createFileRoute('/')({ component: Home })

const UNCAT = 'uncategorized'
const NONE = 'none' // Radix Select cannot use an empty-string value

function Home() {
  const [cats, setCats] = useState<Category[]>([])
  const [notes, setNotes] = useState<Note[]>([])
  const [filter, setFilter] = useState<number | typeof UNCAT | null>(null)
  const [text, setText] = useState('')
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    const [c, n] = await Promise.all([api.categories(), api.notes()])
    setCats(c)
    setNotes(n)
  }, [])

  const run = useCallback(
    async (fn: () => Promise<unknown>) => {
      setError('')
      setBusy(true)
      try {
        await fn()
        await refresh()
      } catch (e) {
        setError(String(e))
      } finally {
        setBusy(false)
      }
    },
    [refresh],
  )

  useEffect(() => {
    run(async () => {})
  }, [run])

  const catName = (id: number | null) => cats.find((c) => c.id === id)?.name ?? 'Uncategorized'
  const shown = notes.filter((n) => (filter === null ? true : filter === UNCAT ? n.category_id === null : n.category_id === filter))

  return (
    <div className="flex min-h-screen">
      <aside className="w-72 shrink-0 space-y-4 border-r bg-card p-4">
        <h2 className="text-lg font-semibold">Categories</h2>
        <div className="grid gap-1">
          <NavButton testid="filter-all" active={filter === null} onClick={() => setFilter(null)}>
            All ({notes.length})
          </NavButton>
          {cats.map((c) => (
            <div key={c.id} className="flex gap-1">
              <NavButton testid={`filter-${c.name}`} title={c.description} active={filter === c.id} onClick={() => setFilter(c.id)} className="flex-1">
                {c.name} ({c.count})
              </NavButton>
              <Button variant="ghost" size="icon-sm" aria-label={`delete ${c.name}`} onClick={() => run(() => api.deleteCategory(c.id))}>
                <X />
              </Button>
            </div>
          ))}
          <NavButton testid="filter-uncategorized" active={filter === UNCAT} onClick={() => setFilter(UNCAT)}>
            Uncategorized ({notes.filter((n) => n.category_id === null).length})
          </NavButton>
        </div>

        <Separator />

        <form
          className="grid gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (!name.trim()) return
            run(async () => {
              await api.createCategory(name, desc)
              setName('')
              setDesc('')
            })
          }}
        >
          <strong className="text-sm">New category</strong>
          <Input data-testid="cat-name" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <Textarea data-testid="cat-desc" placeholder="Description (helps cold start)" rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} />
          <Button data-testid="cat-add" disabled={busy}>
            Add category
          </Button>
        </form>
        <Button variant="outline" disabled={busy} onClick={() => run(api.reclassify)}>
          Reclassify unconfirmed
        </Button>
      </aside>

      <main className="max-w-3xl flex-1 space-y-4 p-6">
        <h1 className="text-3xl font-semibold">Notes</h1>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (!text.trim()) return
            run(async () => {
              await api.createNote(text)
              setText('')
            })
          }}
        >
          <Input data-testid="note-input" placeholder="Write a note…" value={text} onChange={(e) => setText(e.target.value)} />
          <Button data-testid="note-add" disabled={busy}>
            Add
          </Button>
        </form>
        {error && (
          <Alert variant="destructive" data-testid="error">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <ul className="grid gap-2">
          {shown.map((n) => (
            <li key={n.id} data-testid="note">
              <Card className="py-3">
                <CardContent className="space-y-2 px-4">
                  <div>{n.text}</div>
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <Badge data-testid="note-category" variant={n.category_id !== null ? 'secondary' : 'destructive'}>
                      {catName(n.category_id)}
                    </Badge>
                    <span className="text-muted-foreground">{n.is_confirmed ? 'confirmed' : `${Math.round(n.confidence * 100)}%`}</span>
                    {!n.is_confirmed && n.category_id !== null && (
                      <Button data-testid="note-confirm" variant="outline" size="sm" onClick={() => run(() => api.setCategory(n.id, n.category_id))}>
                        ✓ accept
                      </Button>
                    )}
                    <Select
                      value={n.category_id === null ? NONE : String(n.category_id)}
                      onValueChange={(v) => run(() => api.setCategory(n.id, v === NONE ? null : Number(v)))}
                    >
                      <SelectTrigger data-testid="note-select" size="sm" className="w-44">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>Uncategorized</SelectItem>
                        {cats.map((c) => (
                          <SelectItem key={c.id} value={String(c.id)}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button data-testid="note-delete" variant="ghost" size="sm" className="ml-auto" aria-label="remove note" onClick={() => run(() => api.deleteNote(n.id))}>
                      Remove
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
          {shown.length === 0 && <li className="text-muted-foreground">No notes.</li>}
        </ul>
      </main>
    </div>
  )
}

function NavButton({
  testid,
  active,
  className,
  ...props
}: React.ComponentProps<typeof Button> & { testid: string; active: boolean }) {
  return (
    <Button data-testid={testid} variant={active ? 'default' : 'outline'} className={cn('justify-start', className)} {...props} />
  )
}
