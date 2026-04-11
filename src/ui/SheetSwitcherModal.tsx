import { useState, useEffect } from 'react'
import { useAuth } from '../auth/useAuth'
import { useSheetContext } from '../data/useSheetContext'
import { listRepSheets, renameSheet, cloneSheet, createExampleSheet, getFolderUrl } from '../sheets/driveApi'
import { shareOrCopy } from './sharing/shareLink'
import { AuthExpiredError } from '../auth/authFetch'
import { flushSync } from '../data/syncEngine'
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

function CloneIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </svg>
  )
}

type ModalView = 'list' | 'create' | 'created'

export function SheetSwitcherModal({ onClose }: SheetSwitcherModalProps) {
  const { user, login, logout } = useAuth()
  const { spreadsheetId, setSpreadsheetId } = useSheetContext()
  const [sheets, setSheets] = useState<RepSheet[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [shareSheet, setShareSheet] = useState<RepSheet | null>(null)
  const [view, setView] = useState<ModalView>('list')
  const [newSheetName, setNewSheetName] = useState('repsheets')
  const [isCreating, setIsCreating] = useState(false)
  const [createdSheetId, setCreatedSheetId] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    listRepSheets().then((s) => {
      setSheets(s)
      setIsLoading(false)
      if (spreadsheetId) flushSync(spreadsheetId)
    }).catch((e) => {
      if (e instanceof AuthExpiredError) login()
      setIsLoading(false)
    })
  }, [user, login])

  const handleSelect = (id: string) => {
    if (renamingId) return
    if (id !== spreadsheetId) setSpreadsheetId(id)
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
    } catch (e) { console.error('Rename failed:', e) }
    setRenamingId(null)
  }

  const handleClone = async (e: React.MouseEvent, sheet: RepSheet) => {
    e.stopPropagation()
    try {
      const newId = await cloneSheet(sheet.spreadsheetId, `${sheet.name} (copy)`)
      setSpreadsheetId(newId)
      onClose()
    } catch (e) { console.error('Clone failed:', e) }
  }

  const handleShare = (e: React.MouseEvent, sheet: RepSheet) => {
    e.stopPropagation()
    setShareSheet(sheet)
  }

  const handleCreate = async () => {
    if (!newSheetName.trim()) return
    setIsCreating(true)
    try {
      const id = await createExampleSheet([])
      await renameSheet(id, newSheetName.trim())
      setCreatedSheetId(id)
      setSpreadsheetId(id)
      setView('created')
    } catch (e) { console.error('Create failed:', e) }
    setIsCreating(false)
  }

  if (shareSheet) {
    return <ShareSheetModal sheet={shareSheet} onClose={() => setShareSheet(null)} />
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end z-50" onClick={onClose}>
      <div className="w-full bg-[#1a1a2e] rounded-t-2xl p-5 max-h-[70vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}>

        {view === 'list' && (
          <>
            <div className="flex justify-between items-center mb-1">
              <span />
              <h2 className="text-base font-bold">Sheets</h2>
              {getFolderUrl() ? (
                <a href={getFolderUrl()!} target="_blank" rel="noopener noreferrer"
                  className="text-gray-500 p-1 active:text-[#6c63ff]">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
                  </svg>
                </a>
              ) : <span />}
            </div>
            <p className="text-xs text-gray-400 text-center mb-4">Select a repsheets spreadsheet</p>

            {isLoading ? (
              <p className="text-gray-400 text-center py-4 text-sm">Loading sheets...</p>
            ) : (
              <>
                {sheets.map((s) => (
                  <div key={s.spreadsheetId}
                    onClick={() => handleSelect(s.spreadsheetId)}
                    className={`rounded-[10px] p-3 mb-2 active:opacity-80 cursor-pointer ${
                      s.spreadsheetId === spreadsheetId
                        ? 'bg-[#6c63ff]/15 border border-[#6c63ff]'
                        : 'bg-[#2a2a4a]'
                    }`}>
                    {renamingId === s.spreadsheetId ? (
                      <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                        <input type="text" value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && submitRename()}
                          className="flex-1 bg-[#1a1a2e] border border-[#3a3a5a] rounded px-2 py-1 text-sm outline-none focus:border-[#6c63ff]"
                          autoFocus />
                        <button onClick={submitRename} className="text-[#6c63ff] text-xs font-semibold px-2">Save</button>
                        <button onClick={() => setRenamingId(null)} className="text-gray-400 text-xs px-2">Cancel</button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm truncate">{s.name}</div>
                          <div className="text-[11px] text-gray-500 mt-0.5">{s.isOwner ? 'Owner' : `Shared by ${s.owner}`}</div>
                        </div>
                        {s.isOwner && (
                          <button onClick={(e) => startRename(e, s)} className="text-gray-500 p-1.5 active:text-white">
                            <EditIcon />
                          </button>
                        )}
                        {s.isOwner && (
                          <button onClick={(e) => handleClone(e, s)} className="text-gray-500 p-1.5 active:text-white">
                            <CloneIcon />
                          </button>
                        )}
                        {s.isOwner && (
                          <button onClick={(e) => handleShare(e, s)} className="text-gray-500 p-1.5 active:text-[#6c63ff]">
                            <ShareIcon />
                          </button>
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

            <button onClick={() => setView('create')}
              className="w-full border-2 border-dashed border-[#6c63ff] rounded-[10px] p-3 mt-2 text-center text-[#6c63ff] font-semibold text-sm">
              + Create New Sheet
            </button>

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
          </>
        )}

        {view === 'create' && (
          <>
            <h2 className="text-base font-bold text-center mb-4">Create New Sheet</h2>
            <input type="text" value={newSheetName}
              onChange={(e) => setNewSheetName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              placeholder="Sheet name"
              className="w-full bg-[#2a2a4a] border border-[#3a3a5a] rounded-[10px] px-4 py-3 text-base outline-none focus:border-[#6c63ff] mb-4"
              autoFocus />
            <button onClick={handleCreate} disabled={isCreating || !newSheetName.trim()}
              className="w-full bg-[#6c63ff] rounded-[10px] p-3 text-center font-semibold text-sm disabled:opacity-50">
              {isCreating ? 'Creating...' : 'Create'}
            </button>
            <button onClick={() => setView('list')}
              className="w-full p-3 text-center text-gray-400 font-semibold text-sm mt-1">
              Back
            </button>
          </>
        )}

        {view === 'created' && createdSheetId && (
          <>
            <h2 className="text-base font-bold text-center mb-2">Sheet Created!</h2>
            <p className="text-xs text-gray-400 text-center mb-4">"{newSheetName}" is ready to use</p>

            <a href={`https://docs.google.com/spreadsheets/d/${createdSheetId}/edit`}
              target="_blank" rel="noopener noreferrer"
              className="block w-full bg-[#2a2a4a] rounded-[10px] p-3 text-center text-sm text-[#6c63ff] font-semibold mb-2">
              Open in Google Sheets
            </a>
            <button onClick={() => shareOrCopy(`https://docs.google.com/spreadsheets/d/${createdSheetId}/edit`, 'repsheets')}
              className="w-full bg-[#2a2a4a] rounded-[10px] p-3 text-center text-sm text-gray-400 font-semibold mb-2">
              {navigator.share ? 'Share Link' : 'Copy Link'}
            </button>
            <button onClick={onClose}
              className="w-full p-3 text-center text-gray-400 font-semibold text-sm mt-1">
              Done
            </button>
          </>
        )}
      </div>
    </div>
  )
}
