import { useState, useEffect } from 'react'
import { useAuth } from '../auth/useAuth'
import { useSheetContext } from '../data/useSheetContext'
import { listRepSheets, renameSheet } from '../sheets/driveApi'
import { AuthExpiredError } from '../auth/authFetch'
import { ShareSheetModal } from './sharing/ShareSheetModal'
import type { RepSheet } from '../types'

interface SheetSwitcherModalProps {
  onClose: () => void
}

function EditIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11.5 1.5l3 3L5 14H2v-3z" />
    </svg>
  )
}

function ShareIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12v7a2 2 0 002 2h12a2 2 0 002-2v-7" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" y1="2" x2="12" y2="15" />
    </svg>
  )
}

export function SheetSwitcherModal({ onClose }: SheetSwitcherModalProps) {
  const { user, logout } = useAuth()
  const { spreadsheetId, setSpreadsheetId } = useSheetContext()
  const [sheets, setSheets] = useState<RepSheet[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [shareSheet, setShareSheet] = useState<RepSheet | null>(null)

  useEffect(() => {
    if (!user) return
    listRepSheets().then((s) => {
      setSheets(s)
      setIsLoading(false)
    }).catch((e) => {
      if (e instanceof AuthExpiredError) {
        // Re-auth is safe here since the modal was opened via user tap
        login()
      }
      setIsLoading(false)
    })
  }, [user, login])

  const handleSelect = (id: string) => {
    if (renamingId) return
    if (id !== spreadsheetId) {
      setSpreadsheetId(id)
    }
    onClose()
  }

  const startRename = (e: React.MouseEvent, sheet: RepSheet) => {
    e.stopPropagation()
    setRenamingId(sheet.spreadsheetId)
    setRenameValue(sheet.name)
  }

  const submitRename = async () => {
    if (!renamingId || !renameValue.trim()) return
    try {
      await renameSheet(renamingId, renameValue.trim())
      setSheets((prev) => prev.map((s) =>
        s.spreadsheetId === renamingId ? { ...s, name: renameValue.trim() } : s
      ))
    } catch (e) {
      console.error('Rename failed:', e)
    }
    setRenamingId(null)
  }

  const handleShare = (e: React.MouseEvent, sheet: RepSheet) => {
    e.stopPropagation()
    setShareSheet(sheet)
  }

  if (shareSheet) {
    return <ShareSheetModal sheet={shareSheet} onClose={() => setShareSheet(null)} />
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
              <div key={s.spreadsheetId}
                onClick={() => handleSelect(s.spreadsheetId)}
                className={`rounded-[10px] p-4 mb-2 active:opacity-80 cursor-pointer ${
                  s.spreadsheetId === spreadsheetId
                    ? 'bg-[#6c63ff]/15 border border-[#6c63ff]'
                    : 'bg-[#2a2a4a]'
                }`}>
                {renamingId === s.spreadsheetId ? (
                  <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="text"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && submitRename()}
                      className="flex-1 bg-[#1a1a2e] border border-[#3a3a5a] rounded px-2 py-1 text-sm outline-none focus:border-[#6c63ff]"
                      autoFocus
                    />
                    <button onClick={submitRename}
                      className="text-[#6c63ff] text-xs font-semibold px-2">Save</button>
                    <button onClick={() => setRenamingId(null)}
                      className="text-gray-400 text-xs px-2">Cancel</button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm truncate">{s.name}</div>
                      <div className="text-[11px] text-gray-500 mt-0.5">Owner: {s.owner}</div>
                    </div>
                    {s.isOwner && (
                      <button onClick={(e) => startRename(e, s)}
                        className="text-gray-500 p-1.5 active:text-white">
                        <EditIcon />
                      </button>
                    )}
                    {s.isOwner && (
                      <button onClick={(e) => handleShare(e, s)}
                        className="text-gray-500 p-1.5 active:text-[#6c63ff]">
                        <ShareIcon />
                      </button>
                    )}
                    {s.spreadsheetId === spreadsheetId && (
                      <div className="text-[#6c63ff] text-xs flex-shrink-0">Active</div>
                    )}
                  </div>
                )}
              </div>
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

        <div className="mt-4 pt-3 border-t border-[#3a3a5a]">
          <div className="text-[11px] text-gray-500 text-center mb-2">{user?.email}</div>
          <button onClick={() => { logout(); onClose() }}
            className="w-full p-2 text-center text-red-400 text-xs font-semibold">
            Log Out
          </button>
        </div>
      </div>
    </div>
  )
}
