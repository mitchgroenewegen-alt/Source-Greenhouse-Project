// The climate KPIs the Climate tab draws, named once. Their targets, tolerances and plan word ("target") come from
// src/config/kpis.ts; nothing about a score is decided here.

import { kpiConfig, kpisInCategory, type KpiConfig } from '../config/kpis'

export const T_24H = 'Temperature (24h)'
export const T_DAY = 'Temperature (day)'
export const T_NIGHT = 'Temperature (night)'
export const T_DIFF = 'Day/night temperature difference'
export const HUMIDITY = 'Relative humidity'
export const DEFICIT = 'Humidity deficit'
export const CO2 = 'CO2 (day)'
export const RADIATION = 'Solar radiation'
export const PAR = 'PAR light sum'
export const RTR = 'RTR (radiation-temperature ratio)'
/** Not a climate KPI (it is Resource usage) but it is the other half of the light picture: hours of LED light. */
export const LED_HOURS = 'LED lighting'

/** Every KPI of the Climate category, in the order of src/config/kpis.ts. Each gets a row in the days-off-target strip. */
export const CLIMATE_KPIS: KpiConfig[] = kpisInCategory('Climate')

export const config = (name: string): KpiConfig => kpiConfig(name)
