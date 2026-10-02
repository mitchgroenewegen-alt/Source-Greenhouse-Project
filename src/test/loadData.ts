import { buildData } from '../../scripts/prepare-data.ts'
import type { DataFile } from '../data/types'

let cached: DataFile | undefined

/** The real workbook, parsed once per test file. Tests run against the actual data. */
export function loadTestData(): DataFile {
  cached ??= buildData()
  return cached
}
