import { useState, useEffect } from 'react'
import { useAuth } from '../auth/useAuth'
import { useSheetContext } from '../data/useSheetContext'
import { listRepSheets } from '../sheets/driveApi'
import type { RepSheet } from '../types'

interface SheetSwitcherModalProps {
  onClose: () => void
}

export function SheetSwitcherModal({ onClose }: SheetSwitcherModalProps) {
  const { user } = useAuth()
  const { spreadsheetId, setSpreadsheetId } = useSheetContext()
  const [sheets, setSheets] = useState<RepSheet[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    listRepSheets().then((s) => {
      setSheets(s)
      setIsLoading(false)
    }).catch(() => setIsLoading(false))
  }, [user])

  const handleSelect = (id: string) => {
    if (id !== spreadsheetId) {
      setSpreadsheetId(id)
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end z-50" onClick={onClose}>
      <div className="w-full bg-[#1a1a2e] rounded-t-2xl p-5 max-h-[70vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}>
        <h2 className="text-base font-bold text-center mb-1">Switch Sheet</h2>
        <p className="text-xs text-gray-400 text-center mb-4">Select a repsheets spreadsheet</p>

        {isLoading ? (
          <p className="text-gray-400 text-center py-4 text-sm">Loading sheets...</p>
        ) : (
          <>
            {sheets.map((s) => (
              <button key={s.spreadsheetId} onClick={() => handleSelect(s.spreadsheetId)}
                className={`w-full rounded-[10px] p-4 mb-2 text-left active:opacity-80 flex items-center gap-3 ${
                  s.spreadsheetId === spreadsheetId
                    ? 'bg-[#6c63ff]/15 border border-[#6c63ff]'
                    : 'bg-[#2a2a4a]'
                }`}>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate">{s.name}</div>
                  <div className="text-[11px] text-gray-500 mt-0.5">Owner: {s.owner}</div>
                </div>
                {s.spreadsheetId === spreadsheetId && (
                  <div className="text-[#6c63ff] text-xs flex-shrink-0">Active</div>
                )}
              </button>
            ))}
            {sheets.length === 0 && (
              <p className="text-gray-500 text-sm text-center py-4">No repsheets found</p>
            )}
          </>
        )}

        <button onClick={onClose}
          className="w-full p-3 text-center text-gray-400 font-semibold text-sm mt-2">
          Cancel
        </button>
      </div>
    </div>
  )
}
