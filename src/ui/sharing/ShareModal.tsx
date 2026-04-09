import { useState } from 'react'
import { useRoutines } from '../../data/useRoutines'
import { createSharedTemplate } from '../../sheets/driveApi'

type CopyMode = 'confirm' | 'done'

interface ShareCopyModalProps {
  program: string
  sheetLevel?: boolean  // when true, share all programs
  onClose: () => void
}

/** Share a read-only copy of routines (safe for strangers) */
export function ShareCopyModal({ program, sheetLevel, onClose }: ShareCopyModalProps) {
  const { allRows } = useRoutines(null)
  const [mode, setMode] = useState<CopyMode>('confirm')
  const [resultUrl, setResultUrl] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const programRows = sheetLevel
    ? allRows
    : allRows.filter((r) => r.program === program)

  const programNames = sheetLevel
    ? [...new Set(allRows.map((r) => r.program))].filter(Boolean)
    : [program]

  const label = sheetLevel ? 'all programs' : `"${program}"`

  const handleCopy = async () => {
    setIsLoading(true)
    setError('')
    try {
      const { url } = await createSharedTemplate(programRows, programNames)
      const importUrl = `${window.location.origin}${window.location.pathname}?import=${url.split('/d/')[1]?.split('/')[0] ?? ''}`
      setResultUrl(importUrl)
      try { await navigator.clipboard.writeText(importUrl) } catch {}
      setMode('done')
    } catch (e) {
      console.error('Share copy failed:', e)
      setError(String(e))
    }
    setIsLoading(false)
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end z-50" onClick={onClose}>
      <div className="w-full bg-[#1a1a2e] rounded-t-2xl p-5" onClick={(e) => e.stopPropagation()}>

        {mode === 'confirm' && (
          <>
            <h2 className="text-base font-bold text-center mb-1">Share {label}</h2>
            <p className="text-xs text-gray-400 text-center mb-2">
              Creates a read-only copy of the routines. Your logs are not included.
            </p>
            <p className="text-[10px] text-gray-500 text-center mb-4">
              Looking to invite them to work out together? Share the sheet instead.
            </p>
            {error && <p className="text-red-400 text-xs text-center mb-3">{error}</p>}
            <button onClick={handleCopy} disabled={isLoading}
              className="w-full bg-[#6c63ff] rounded-[10px] p-3 text-center font-semibold text-sm mb-2 disabled:opacity-50">
              {isLoading ? 'Creating...' : 'Create Share Link'}
            </button>
            <button onClick={onClose} className="w-full p-3 text-center text-gray-400 font-semibold text-sm">
              Cancel
            </button>
          </>
        )}

        {mode === 'done' && (
          <>
            <h2 className="text-base font-bold text-center mb-2">Link Created!</h2>
            <p className="text-xs text-gray-400 text-center mb-3">Link copied to clipboard</p>
            <div className="bg-[#2a2a4a] rounded-[10px] p-3 mb-3">
              <p className="text-[11px] text-gray-400 break-all">{resultUrl}</p>
            </div>
            <button onClick={() => { try { navigator.clipboard.writeText(resultUrl) } catch {} }}
              className="w-full bg-[#2a2a4a] rounded-[10px] p-3 text-center text-[#6c63ff] font-semibold text-sm mb-2">
              Copy Link Again
            </button>
            <button onClick={onClose} className="w-full p-3 text-center text-gray-400 font-semibold text-sm">
              Done
            </button>
          </>
        )}
      </div>
    </div>
  )
}
