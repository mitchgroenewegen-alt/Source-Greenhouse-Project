import { XLSX_MIME } from './xlsxFile'

/** Hand bytes to the browser as a download. */
export function downloadFile(bytes: Uint8Array, filename: string, type: string = XLSX_MIME): void {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  // Some browsers start the download after the click returns.
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
