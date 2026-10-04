import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckField, PRIMARY_BUTTON, SECONDARY_BUTTON } from '../components/ui/fields'
import { ChevronLeftIcon } from '../components/ui/icons'
import { CopyBudgetsPanel } from '../components/setup/CopyBudgetsPanel'
import { CultivationForm } from '../components/setup/CultivationForm'
import { CultivationRow } from '../components/setup/CultivationRow'
import { FacilityForm } from '../components/setup/FacilityForm'
import { GreenhouseForm } from '../components/setup/GreenhouseForm'
import { WriteNotice } from '../components/setup/WriteNotice'
import type { Cultivation } from '../data/types'
import { fixed } from '../lib/format'
import { buildCatalog, greenhouseOf, liveCultivationsIn, type FacilityEntry, type GreenhouseEntry } from '../setup/catalog'
import { effectiveFruitTypes, fruitTypeIdOf } from '../setup/fruitTypes'
import { areaLeft, validateCultivation } from '../setup/validate'
import { useCropData } from '../state/CropDataContext'
import { useWorkspace } from '../workspace/WorkspaceContext'
import type { WorkspaceCultivation } from '../workspace/types'

/** What is open above the list: one form at a time. */
type Panel =
  | { kind: 'facility'; editing?: FacilityEntry }
  | { kind: 'greenhouse'; editing?: GreenhouseEntry; facilityId?: string }
  | { kind: 'cultivation'; editing?: Cultivation; greenhouseId?: string }
  | { kind: 'copy'; target: Cultivation }

const asWorkspaceCultivation = (c: Cultivation, archived: boolean): WorkspaceCultivation => ({ ...c, fruitType: c.fruitType ?? null, plannedEndDate: c.plannedEndDate ?? null, archived })

export default function SetupScreen() {
  const { cultivations, workbookCultivations, showArchived, setShowArchived, dataStateOf, data: merged, decidedBy } = useCropData()
  const { data, canWrite, user, save } = useWorkspace()
  const [panel, setPanel] = useState<Panel | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const catalog = useMemo(() => buildCatalog(workbookCultivations, data), [workbookCultivations, data])
  const { types: fruitTypes } = effectiveFruitTypes(data.fruitTypes)
  const workbookIds = useMemo(() => new Set(workbookCultivations.map((c) => c.id)), [workbookCultivations])
  const typeName = (c: Cultivation) => fruitTypes.find((t) => t.id === fruitTypeIdOf(c))?.name ?? null
  const archivedCount = cultivations.filter((c) => c.archived).length
  const open = (next: Panel | null) => {
    setMessage(null)
    setPanel(next)
  }

  async function toggleArchive(c: Cultivation) {
    setMessage(null)
    if (c.archived) {
      // Coming back, it takes its room in the greenhouse again, so the same checks apply as when adding.
      const found = validateCultivation(
        { id: c.id, greenhouseId: greenhouseOf(c, catalog)?.id ?? '', fruitType: fruitTypeIdOf(c) ?? '', variety: c.variety, plantingDate: c.plantingDate, plannedEndDate: c.plannedEndDate ?? '', areaM2: String(c.areaM2) },
        { catalog, cultivations, fruitTypeIds: fruitTypes.map((t) => t.id), editingId: c.id },
      )
      const problem = found.areaM2 ?? found.greenhouseId
      if (problem) return setMessage(`${c.id} can't be restored: ${problem}`)
    }
    await save('cultivations', [asWorkspaceCultivation(c, !c.archived)])
  }

  const body = (facility: FacilityEntry) => {
    const houses = catalog.greenhouses.filter((g) => g.facilityId === facility.id)
    return (
      <section key={facility.id} aria-labelledby={`setup-${facility.id}`} className="flex min-w-0 flex-col gap-3 rounded-2xl border border-line bg-card p-4 shadow-sm">
        <header className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 id={`setup-${facility.id}`} className="text-lg font-semibold">
              {facility.name} <span className="text-sm font-normal text-ink-2">({facility.id})</span>
            </h2>
            <p className="text-sm text-ink-2">
              {facility.region || 'No region entered'} · {facility.currency}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => open({ kind: 'facility', editing: facility })} disabled={!canWrite} className={SECONDARY_BUTTON}>
              Edit
            </button>
            <button type="button" onClick={() => open({ kind: 'greenhouse', facilityId: facility.id })} disabled={!canWrite} className={SECONDARY_BUTTON}>
              Add greenhouse
            </button>
          </div>
        </header>
        {houses.length === 0 && <p className="text-sm text-ink-2">No greenhouse yet.</p>}
        {houses.map((g) => {
          const all = cultivations.filter((c) => c.facility === g.facilityName && c.greenhouse === g.name)
          const shown = all.filter((c) => showArchived || !c.archived)
          const { used } = areaLeft(g, cultivations)
          return (
            <div key={g.id} className="flex flex-col gap-2 rounded-xl border border-line-soft bg-field p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold">
                    {g.name} <span className="text-sm font-normal text-ink-2">({g.id})</span>
                  </h3>
                  <p className="num text-sm text-ink-2">
                    {fixed(g.areaM2, 0)} m², {fixed(used, 0)} m² in use ({liveCultivationsIn(g, cultivations).length} live)
                    {g.ledWattsPerM2 === null ? '' : ` · LED ${fixed(g.ledWattsPerM2, 0)} W/m²`}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => open({ kind: 'greenhouse', editing: g })} disabled={!canWrite} className={SECONDARY_BUTTON}>
                    Edit
                  </button>
                  <button type="button" onClick={() => open({ kind: 'cultivation', greenhouseId: g.id })} disabled={!canWrite} className={SECONDARY_BUTTON}>
                    Add cultivation
                  </button>
                </div>
              </div>
              {shown.length === 0 ? (
                <p className="text-sm text-ink-2">{all.length > 0 ? 'Only archived cultivations here. Turn on Show archived to see them.' : 'No cultivation yet.'}</p>
              ) : (
                <ul className="grid grid-cols-1 gap-2 lg:grid-cols-2">
                  {shown.map((c) => (
                    <CultivationRow
                      key={c.id}
                      cultivation={c}
                      fruitTypeName={typeName(c)}
                      state={dataStateOf(c.id)}
                      canCopyBudgets={!workbookIds.has(c.id)}
                      canWrite={canWrite}
                      onEdit={() => open({ kind: 'cultivation', editing: c })}
                      onToggleArchive={() => void toggleArchive(c)}
                      onCopyBudgets={() => open({ kind: 'copy', target: c })}
                    />
                  ))}
                </ul>
              )}
            </div>
          )
        })}
      </section>
    )
  }

  const close = () => setPanel(null)
  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link to="/more" className="mb-1 inline-flex min-h-9 items-center gap-1 text-sm font-semibold underline">
          <ChevronLeftIcon width={16} height={16} /> More
        </Link>
        <h1 className="text-2xl font-semibold">Setup</h1>
        <p>
          Facilities, greenhouses and cultivations. The workbook ones are here too; changing one saves an edit on top of the workbook, which is never changed.
        </p>
      </div>

      <WriteNotice what="change the setup" />

      <div className="flex flex-col gap-2 rounded-2xl border border-line bg-card p-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => open({ kind: 'facility' })} disabled={!canWrite} className={PRIMARY_BUTTON}>
            Add facility
          </button>
          <button type="button" onClick={() => open({ kind: 'greenhouse' })} disabled={!canWrite} className={SECONDARY_BUTTON}>
            Add greenhouse
          </button>
          <button type="button" onClick={() => open({ kind: 'cultivation' })} disabled={!canWrite} className={SECONDARY_BUTTON}>
            Add cultivation
          </button>
        </div>
        <CheckField
          label={`Show archived${archivedCount > 0 ? ` (${archivedCount})` : ''}`}
          checked={showArchived}
          onChange={setShowArchived}
          hint="Archived cultivations are hidden on the Scorecard and Facilities unless this is on."
        />
      </div>

      {message && (
        <p role="alert" className="rounded-2xl border border-bad-line bg-bad-bg p-3 text-sm font-semibold text-bad-ink">
          {message}
        </p>
      )}

      {panel?.kind === 'facility' && (
        <FacilityForm key={panel.editing?.id ?? 'new'} catalog={catalog} editing={panel.editing} disabled={!canWrite} onSave={(f) => save('facilities', [f])} onCancel={close} />
      )}
      {panel?.kind === 'greenhouse' && (
        <GreenhouseForm key={panel.editing?.id ?? `new-${panel.facilityId ?? ''}`} catalog={catalog} cultivations={cultivations} editing={panel.editing} facilityId={panel.facilityId} disabled={!canWrite} onSave={(g) => save('greenhouses', [g])} onCancel={close} />
      )}
      {panel?.kind === 'cultivation' && (
        <CultivationForm
          key={panel.editing?.id ?? `new-${panel.greenhouseId ?? ''}`}
          catalog={catalog}
          cultivations={cultivations}
          fruitTypes={fruitTypes}
          editing={panel.editing}
          fromWorkbook={panel.editing ? workbookIds.has(panel.editing.id) : false}
          greenhouseId={panel.greenhouseId}
          disabled={!canWrite}
          onSave={(c) => save('cultivations', [c])}
          onCancel={close}
        />
      )}
      {panel?.kind === 'copy' && (
        <CopyBudgetsPanel
          key={panel.target.id}
          target={panel.target}
          cultivations={cultivations}
          daily={merged.daily}
          fruitTypes={fruitTypes}
          createdBy={user ?? (decidedBy || 'this browser')}
          disabled={!canWrite}
          onSave={(edits) => save('valueEdits', edits)}
          onCancel={close}
        />
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">{catalog.facilities.map(body)}</div>
    </div>
  )
}
