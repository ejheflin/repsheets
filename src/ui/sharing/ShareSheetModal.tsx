import { useState } from 'react'
import { ShareCopyModal } from './ShareModal'
import { InviteSheetModal } from './InviteSheetModal'
import type { RepSheet } from '../../types'

type Mode = 'choose' | 'copy' | 'invite'

interface ShareSheetModalProps {
  sheet: RepSheet
  onClose: () => void
}

export function ShareSheetModal({ sheet, onClose }: ShareSheetModalProps) {
  const [mode, setMode] = useState<Mode>('choose')

  if (mode === 'copy') {
    return <ShareCopyModal program="" sheetLevel onClose={onClose} />
  }

  if (mode === 'invite') {
    return <InviteSheetModal spreadsheetId={sheet.spreadsheetId} sheetName={sheet.name} onClose={onClose} />
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end z-50" onClick={onClose}>
      <div className="w-full bg-[#1a1a2e] rounded-t-2xl p-5" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-base font-bold text-center mb-1">Share "{sheet.name}"</h2>
        <p className="text-xs text-gray-400 text-center mb-4">How would you like to share?</p>

        <button onClick={() => setMode('copy')}
          className="w-full bg-[#2a2a4a] rounded-[10px] p-4 mb-2 text-left active:opacity-80">
          <div className="font-semibold text-sm">Share a Copy</div>
          <div className="text-[11px] text-gray-400 mt-1">
            Creates a read-only template of all programs. Safe for strangers — your logs are not included.
          </div>
        </button>

        <button onClick={() => setMode('invite')}
          className="w-full bg-[#2a2a4a] rounded-[10px] p-4 mb-2 text-left active:opacity-80">
          <div className="font-semibold text-sm">Invite to Sheet</div>
          <div className="text-[11px] text-gray-400 mt-1">
            Share your actual sheet. Both of you log workouts and can see each other's progress.
          </div>
        </button>

        <button onClick={onClose} className="w-full p-3 text-center text-gray-400 font-semibold text-sm mt-1">
          Cancel
        </button>
      </div>
    </div>
  )
}
