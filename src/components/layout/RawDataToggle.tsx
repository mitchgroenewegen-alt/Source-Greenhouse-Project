import { useCropData } from '../../state/CropDataContext'

/** Global switch: score with the values exactly as recorded, ignoring data checks. */
export function RawDataToggle() {
  const { rawMode, setRawMode } = useCropData()
  return (
    <button
      type="button"
      role="switch"
      aria-checked={rawMode}
      aria-label="Show raw data"
      onClick={() => setRawMode(!rawMode)}
      className="flex min-h-10 shrink-0 items-center gap-2 rounded-lg border border-line bg-tile px-2.5 text-sm font-medium text-ink-2"
    >
      <span
        aria-hidden="true"
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${rawMode ? 'bg-brand' : 'bg-none-line'}`}
      >
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-field transition-all ${rawMode ? 'left-[1.1rem]' : 'left-0.5'}`} />
      </span>
      <span className="sm:hidden">Raw data</span>
      <span className="hidden sm:inline">Show raw data</span>
    </button>
  )
}
