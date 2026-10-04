import type { ValueSource } from '../../workspace/types'

/** How the log says where a value edit came from. */
export const SOURCE_LABEL: Record<ValueSource, string> = {
  edited: 'Edited',
  corrected: 'Correction after a data check',
  entered: 'Entered',
  imported: 'Imported',
}
