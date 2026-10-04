import { useMemo } from 'react'
import { buildFinancials, type Financials } from '../financials'
import { buildCatalog } from '../setup/catalog'
import { effectiveFruitTypes } from '../setup/fruitTypes'
import { useWorkspace } from '../workspace/WorkspaceContext'
import { useCropData } from './CropDataContext'
import { useForecasts } from './useForecasts'
import { useView } from './ViewContext'

/** The money of the visible cultivations for the selected week and to date, from the same weekly values as the scores. */
export function useFinancials(): Financials {
  const { visibleCultivations, workbookCultivations, weeks, point } = useCropData()
  const { week } = useView()
  const { data } = useWorkspace()
  const { byCultivation } = useForecasts()
  return useMemo(
    () =>
      buildFinancials({
        cultivations: visibleCultivations,
        weeks: weeks.map((w) => w.id),
        week,
        point: (c, kpi, w) => point(c, kpi, w),
        fruitTypes: effectiveFruitTypes(data.fruitTypes).types,
        rates: data.rates,
        catalog: buildCatalog(workbookCultivations, { facilities: data.facilities, greenhouses: data.greenhouses }),
        forecasts: byCultivation,
      }),
    [visibleCultivations, workbookCultivations, weeks, week, point, data, byCultivation],
  )
}
