import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  collectionCounts,
  createCollection,
  deleteCollection,
  listCollections,
  planOf,
  renameCollection,
  setCollectionActive,
  setCollectionInExport,
} from '../db/collections'
import { PACKS, installPack, packStatus, removePack } from '../seed/install'
import { exportCollection, type DeckFormat } from '../lib/exportDeck'
import { saveSettings } from '../db/db'
import {
  DEFAULT_COLLECTION_ID,
  LANG_NAMES,
  activeTargets,
  type Collection,
  type Settings,
} from '../db/types'

/**
 * Your lists.
 *
 * It lives at the top of My words rather than in a tab of its own, because
 * that is where the question "which list is this word in" is already being
 * asked, and because an eighth tile does not fit a phone — the seven below
 * the header are already the most that will sit above the fold.
 *
 * Each list is a card and the card is the whole interface to it: how many
 * words, whether it is being studied, whether it is offered when exporting,
 * and the two files it can produce. There is no detail screen, because
 * everything a list has to say fits on the card.
 */
export function WordLists({ settings }: { settings: Settings }) {
  const [newName, setNewName] = useState('')
  const [renaming, setRenaming] = useState<string | null>(null)
  const [draftName, setDraftName] = useState('')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<{ kind: string; text: string } | null>(null)

  const collections = useLiveQuery(() => listCollections(), [], [])
  const counts = useLiveQuery(() => collectionCounts(), [], new Map<string, number>())
  const packs = useLiveQuery(
    () => packStatus(),
    [],
    new Map<string, { installed: number; total: number; listExists: boolean }>(),
  )

  const plan = planOf(settings)
  const mine = collections.filter((c) => c.kind === 'user')
  const libraries = collections.filter((c) => c.kind === 'library')
  const targets = activeTargets(settings)

  async function run(what: () => Promise<string | void>) {
    if (busy) return
    setBusy(true)
    setStatus(null)
    try {
      const message = await what()
      if (message) setStatus({ kind: 'ok', text: message })
    } catch (err) {
      setStatus({ kind: 'warn', text: err instanceof Error ? err.message : String(err) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="panel">
      <h2>Your lists</h2>
      <p className="muted small">
        Every word sits in exactly one list. Topics are separate and a word can
        have several of those — a list is where it is filed, a topic is what it
        is about.
      </p>

      <div className="list-cards">
        {mine.map((c) => (
          <ListCard
            key={c.id}
            collection={c}
            count={counts.get(c.id) ?? 0}
            limit={plan.wordsPerCollection}
            settings={settings}
            busy={busy}
            /* The default list has nowhere to send its words, so it has no
               remove button rather than one that explains itself after you
               press it. */
            canDelete={c.id !== DEFAULT_COLLECTION_ID}
            renaming={renaming === c.id}
            draftName={draftName}
            onDraftName={setDraftName}
            onStartRename={() => {
              setRenaming(c.id)
              setDraftName(c.name)
            }}
            onCancelRename={() => setRenaming(null)}
            onRename={() =>
              void run(async () => {
                await renameCollection(c.id, draftName)
                setRenaming(null)
              })
            }
            onToggleActive={() => void run(() => setCollectionActive(c.id, !c.active))}
            onToggleExport={() =>
              void run(() => setCollectionInExport(c.id, !c.inExport))
            }
            onExport={(format) =>
              void run(async () => {
                const n = await exportCollection(c, settings, format)
                return `Exported ${n} word${n === 1 ? '' : 's'} from ${c.name}.`
              })
            }
            onDelete={() =>
              void run(async () => {
                if (
                  !confirm(
                    `Remove the list "${c.name}"? Its words move to your default list — nothing is deleted.`,
                  )
                ) {
                  return
                }
                const moved = await deleteCollection(c.id)
                return `"${c.name}" removed. ${moved} word${moved === 1 ? '' : 's'} moved to your default list.`
              })
            }
          />
        ))}
      </div>

      {/* The limit, said out loud rather than discovered by pressing a button
          that refuses. */}
      <div className="row">
        <input
          className="field-grow"
          value={newName}
          maxLength={60}
          placeholder="Name a new list — Words at work, University…"
          disabled={busy || mine.length >= plan.collections}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter' || !newName.trim()) return
            void run(async () => {
              await createCollection(newName, settings)
              setNewName('')
            })
          }}
        />
        <button
          disabled={busy || !newName.trim() || mine.length >= plan.collections}
          onClick={() =>
            void run(async () => {
              await createCollection(newName, settings)
              setNewName('')
            })
          }
        >
          Add list
        </button>
      </div>
      <p className="muted small">
        {mine.length} of {plan.collections} list{plan.collections === 1 ? '' : 's'} used
        {mine.length >= plan.collections && ' — this is the limit on this plan.'}{' '}
        Starter packs below do not count against it.
        {settings.plan !== 'full' && (
          <>
            {' '}
            <button
              className="link"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await saveSettings({ plan: 'full' })
                  return 'Limits lifted on this account.'
                })
              }
            >
              Lift the limits
            </button>{' '}
            — there is no billing yet, so this is simply a switch.
          </>
        )}
        {settings.plan === 'full' && (
          <>
            {' '}
            <button
              className="link"
              disabled={busy}
              onClick={() => void run(() => saveSettings({ plan: 'free' }))}
            >
              Back to the free limits
            </button>
          </>
        )}
      </p>

      <h3>Starter packs</h3>
      <p className="muted small">
        {targets.length > 0
          ? `Ready-made words, written out in ${targets.map((l) => LANG_NAMES[l]).join(' and ')} — no model call, works offline.`
          : 'Ready-made words. Choose a language to study first.'}{' '}
        Each word is in one pack only, so adding all three gives you 300
        different words rather than 300 with the overlaps hidden.
      </p>

      <div className="list-cards">
        {PACKS.map((pack) => {
          const state = packs.get(pack.id)
          const installed = state?.installed ?? 0
          const here = libraries.find((c) => c.packId === pack.id)
          return (
            <div className="list-card pack" key={pack.id}>
              <div className="list-card-head">
                <strong>{pack.name}</strong>
                <span className="badge subtle">
                  {installed}/{state?.total ?? pack.rows.length}
                </span>
              </div>
              <p className="muted small">{pack.blurb}</p>
              {here && (
                <div className="list-card-toggles">
                  <label className="checkline">
                    <input
                      type="checkbox"
                      checked={here.active}
                      disabled={busy}
                      onChange={() =>
                        void run(() => setCollectionActive(here.id, !here.active))
                      }
                    />
                    <span>In review and learning</span>
                  </label>
                  <label className="checkline">
                    <input
                      type="checkbox"
                      checked={here.inExport}
                      disabled={busy}
                      onChange={() =>
                        void run(() => setCollectionInExport(here.id, !here.inExport))
                      }
                    />
                    <span>Offered when exporting</span>
                  </label>
                </div>
              )}
              <div className="row">
                {installed < (state?.total ?? 0) || !here ? (
                  <button
                    className="primary"
                    disabled={busy || targets.length === 0}
                    onClick={() =>
                      void run(async () => {
                        const r = await installPack(pack, settings)
                        return r.added === 0
                          ? `Nothing new — you already have all ${r.skipped} of these.`
                          : `Added ${r.added} word${r.added === 1 ? '' : 's'}${
                              r.skipped ? `, skipped ${r.skipped} you already had` : ''
                            }.`
                      })
                    }
                  >
                    {installed > 0 ? 'Add the rest' : 'Add these words'}
                  </button>
                ) : null}
                {here && (
                  <>
                    <button
                      className="link"
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          const n = await exportCollection(here, settings, 'anki')
                          return `Exported ${n} word${n === 1 ? '' : 's'}.`
                        })
                      }
                    >
                      Anki
                    </button>
                    <button
                      className="link"
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          const n = await exportCollection(here, settings, 'generic')
                          return `Exported ${n} word${n === 1 ? '' : 's'}.`
                        })
                      }
                    >
                      CSV
                    </button>
                    <button
                      className="link danger"
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          if (
                            !confirm(
                              `Remove "${pack.name}" and its words? Words you moved into your own lists stay.`,
                            )
                          ) {
                            return
                          }
                          const n = await removePack(pack.id)
                          return `Removed ${n} word${n === 1 ? '' : 's'}.`
                        })
                      }
                    >
                      remove
                    </button>
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Deliberately present and deliberately off. Bringing a whole list in
          from another app is not the same problem as the CSV importer under
          Settings — it has to decide what is a duplicate of what you already
          have, and in which language, before it writes anything. Until that
          is decided, a button that half works would be worse than one that
          says so. The CSV importer in Settings still works. */}
      <h3>Bring a list in</h3>
      <p className="muted small">
        Importing a whole list from Anki or another app is not switched on yet —
        deciding what counts as a duplicate of a word you already have is the
        part still to settle. The CSV importer under Settings brings words in
        one file at a time in the meantime.
      </p>
      <button disabled title="Not available yet">
        Import a list
      </button>

      {status && <div className={`status ${status.kind}`}>{status.text}</div>}
    </div>
  )
}

function ListCard({
  collection,
  count,
  limit,
  busy,
  canDelete,
  renaming,
  draftName,
  onDraftName,
  onStartRename,
  onCancelRename,
  onRename,
  onToggleActive,
  onToggleExport,
  onExport,
  onDelete,
}: {
  collection: Collection
  count: number
  limit: number
  settings: Settings
  busy: boolean
  canDelete: boolean
  renaming: boolean
  draftName: string
  onDraftName: (v: string) => void
  onStartRename: () => void
  onCancelRename: () => void
  onRename: () => void
  onToggleActive: () => void
  onToggleExport: () => void
  onExport: (format: DeckFormat) => void
  onDelete: () => void
}) {
  const full = count >= limit
  return (
    <div className={`list-card${collection.active ? '' : ' is-off'}`}>
      <div className="list-card-head">
        {renaming ? (
          <input
            className="field-grow"
            value={draftName}
            maxLength={60}
            autoFocus
            onChange={(e) => onDraftName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onRename()
              if (e.key === 'Escape') onCancelRename()
            }}
          />
        ) : (
          <strong>{collection.name}</strong>
        )}
        <span className={`badge subtle${full ? ' flag' : ''}`}>
          {count}/{limit}
        </span>
      </div>

      <div className="list-card-toggles">
        <label className="checkline">
          <input
            type="checkbox"
            checked={collection.active}
            disabled={busy}
            onChange={onToggleActive}
          />
          <span>In review and learning</span>
        </label>
        <label className="checkline">
          <input
            type="checkbox"
            checked={collection.inExport}
            disabled={busy}
            onChange={onToggleExport}
          />
          <span>Offered when exporting</span>
        </label>
      </div>

      <div className="row">
        {renaming ? (
          <>
            <button disabled={busy} onClick={onRename}>
              Save
            </button>
            <button className="link" onClick={onCancelRename}>
              Cancel
            </button>
          </>
        ) : (
          <>
            <button
              className="link"
              disabled={busy || count === 0}
              onClick={() => onExport('anki')}
              title="Tab-separated, one column per language — for Anki"
            >
              Anki
            </button>
            <button
              className="link"
              disabled={busy || count === 0}
              onClick={() => onExport('generic')}
              title="Two columns — for Quizlet, Memrise and a spreadsheet"
            >
              CSV
            </button>
            <button className="link" disabled={busy} onClick={onStartRename}>
              rename
            </button>
            {canDelete && (
              <button className="link danger" disabled={busy} onClick={onDelete}>
                remove
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
