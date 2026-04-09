import { useState } from 'react'
import { useRoutines } from '../../data/useRoutines'
import { useSheetContext } from '../../data/useSheetContext'
import { createSharedTemplate, createCompeteSheet, inviteByEmail, inviteByLink } from '../../sheets/driveApi'

type ShareMode = 'choose' | 'copy' | 'invite-choose' | 'invite-email' | 'invite-link-warn' | 'done'

interface ShareModalProps {
  /** If set, share only this program. If null, share the whole sheet. */
  program: string | null
  onClose: () => void
}

export function ShareModal({ program, onClose }: ShareModalProps) {
  const { allRows } = useRoutines(null)
  const { setSpreadsheetId } = useSheetContext()
  const [mode, setMode] = useState<ShareMode>('choose')
  const [email, setEmail] = useState('')
  const [resultUrl, setResultUrl] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const programRows = program
    ? allRows.filter((r) => r.program === program)
    : allRows

  const programNames = program
    ? [program]
    : [...new Set(allRows.map((r) => r.program))].filter(Boolean)

  const handleCopy = async () => {
    setIsLoading(true)
    setError('')
    try {
      const { url } = await createSharedTemplate(programRows, programNames)
      const importUrl = `${window.location.origin}${window.location.pathname}?import=${url.split('/d/')[1]?.split('/')[0] ?? ''}`
      setResultUrl(importUrl)
      try { await navigator.clipboard.writeText(importUrl) } catch { /* clipboard may fail on mobile */ }
      setMode('done')
    } catch (e) {
      console.error('Share copy failed:', e)
      setError(String(e))
    }
    setIsLoading(false)
  }

  const handleInviteEmail = async () => {
    if (!email.trim()) return
    setIsLoading(true)
    setError('')
    try {
      const competeSheetId = await createCompeteSheet(programRows, programNames)
      await inviteByEmail(competeSheetId, email.trim())
      setSpreadsheetId(competeSheetId)
      const joinUrl = `${window.location.origin}${window.location.pathname}?join=${competeSheetId}`
      setResultUrl(joinUrl)
      setMode('done')
    } catch (e) {
      console.error('Invite email failed:', e)
      setError(String(e))
    }
    setIsLoading(false)
  }

  const handleInviteLink = async () => {
    setIsLoading(true)
    setError('')
    try {
      const competeSheetId = await createCompeteSheet(programRows, programNames)
      await inviteByLink(competeSheetId)
      setSpreadsheetId(competeSheetId)
      const joinUrl = `${window.location.origin}${window.location.pathname}?join=${competeSheetId}`
      setResultUrl(joinUrl)
      try { await navigator.clipboard.writeText(joinUrl) } catch { /* clipboard may fail on mobile */ }
      setMode('done')
    } catch (e) {
      console.error('Invite link failed:', e)
      setError(String(e))
    }
    setIsLoading(false)
  }

  // resultUrl is already the app import URL for copy mode, or a sheets URL for invite mode

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end z-50" onClick={onClose}>
      <div className="w-full bg-[#1a1a2e] rounded-t-2xl p-5" onClick={(e) => e.stopPropagation()}>

        {mode === 'choose' && (
          <>
            <h2 className="text-base font-bold text-center mb-1">
              Share {program ? `"${program}"` : 'Sheet'}
            </h2>
            <p className="text-xs text-gray-400 text-center mb-4">How would you like to share?</p>

            <button onClick={() => { handleCopy() }}
              className="w-full bg-[#2a2a4a] rounded-[10px] p-4 mb-2 text-left active:opacity-80">
              <div className="font-semibold text-sm">Share a Copy</div>
              <div className="text-[11px] text-gray-400 mt-1">
                Creates a read-only template. Safe for strangers — your logs are not included.
              </div>
            </button>

            <button onClick={() => setMode('invite-choose')}
              className="w-full bg-[#2a2a4a] rounded-[10px] p-4 mb-2 text-left active:opacity-80">
              <div className="font-semibold text-sm">Invite to Compete</div>
              <div className="text-[11px] text-gray-400 mt-1">
                Share your actual sheet. Both of you log workouts and can see each other's progress.
              </div>
            </button>

            {error && <p className="text-red-400 text-xs text-center mt-2">{error}</p>}

            <button onClick={onClose} className="w-full p-3 text-center text-gray-400 font-semibold text-sm mt-1">
              Cancel
            </button>
          </>
        )}

        {mode === 'invite-choose' && (
          <>
            <h2 className="text-base font-bold text-center mb-1">Invite to Compete</h2>
            <p className="text-xs text-gray-400 text-center mb-4">How should we share access?</p>

            <button onClick={() => setMode('invite-email')}
              className="w-full bg-[#2a2a4a] rounded-[10px] p-4 mb-2 text-left active:opacity-80">
              <div className="font-semibold text-sm">Invite by Email</div>
              <div className="text-[11px] text-gray-400 mt-1">Only they can access your sheet</div>
            </button>

            <button onClick={() => setMode('invite-link-warn')}
              className="w-full bg-[#2a2a4a] rounded-[10px] p-4 mb-2 text-left active:opacity-80">
              <div className="font-semibold text-sm">Create Share Link</div>
              <div className="text-[11px] text-gray-400 mt-1">Anyone with this link can view and log workouts</div>
            </button>

            <button onClick={() => setMode('choose')} className="w-full p-3 text-center text-gray-400 font-semibold text-sm mt-1">
              Back
            </button>
          </>
        )}

        {mode === 'invite-email' && (
          <>
            <h2 className="text-base font-bold text-center mb-4">Invite by Email</h2>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="friend@gmail.com"
              className="w-full bg-[#2a2a4a] border border-[#3a3a5a] rounded-[10px] px-4 py-3 text-sm outline-none focus:border-[#6c63ff] mb-3"
            />
            {error && <p className="text-red-400 text-xs mb-3">{error}</p>}
            <button onClick={handleInviteEmail} disabled={isLoading || !email.trim()}
              className="w-full bg-[#6c63ff] rounded-[10px] p-3 text-center font-semibold text-sm mb-2 disabled:opacity-50">
              {isLoading ? 'Sending...' : 'Send Invite'}
            </button>
            <button onClick={() => setMode('invite-choose')} className="w-full p-3 text-center text-gray-400 font-semibold text-sm">
              Back
            </button>
          </>
        )}

        {mode === 'invite-link-warn' && (
          <>
            <h2 className="text-base font-bold text-center mb-2">Warning</h2>
            <p className="text-xs text-gray-400 text-center mb-4">
              This will make your sheet editable by anyone with the link.
              They will be able to see your logs and log their own workouts.
            </p>
            {error && <p className="text-red-400 text-xs mb-3">{error}</p>}
            <button onClick={handleInviteLink} disabled={isLoading}
              className="w-full bg-red-500 rounded-[10px] p-3 text-center font-semibold text-sm mb-2 disabled:opacity-50">
              {isLoading ? 'Creating...' : 'I Understand, Create Link'}
            </button>
            <button onClick={() => setMode('invite-choose')} className="w-full p-3 text-center text-gray-400 font-semibold text-sm">
              Back
            </button>
          </>
        )}

        {mode === 'done' && (
          <>
            <h2 className="text-base font-bold text-center mb-2">Shared!</h2>
            {resultUrl ? (
              <>
                <p className="text-xs text-gray-400 text-center mb-3">Link copied to clipboard</p>
                <div className="bg-[#2a2a4a] rounded-[10px] p-3 mb-3">
                  <p className="text-[11px] text-gray-400 break-all">{resultUrl || resultUrl}</p>
                </div>
                <button onClick={() => navigator.clipboard.writeText(resultUrl || resultUrl)}
                  className="w-full bg-[#2a2a4a] rounded-[10px] p-3 text-center text-[#6c63ff] font-semibold text-sm mb-2">
                  Copy Link Again
                </button>
              </>
            ) : (
              <p className="text-xs text-gray-400 text-center mb-3">
                Invite sent to {email}. They'll see the sheet in their app.
              </p>
            )}
            <button onClick={onClose} className="w-full p-3 text-center text-gray-400 font-semibold text-sm">
              Done
            </button>
          </>
        )}

        {isLoading && mode === 'choose' && (
          <div className="absolute inset-0 bg-[#1a1a2e]/80 rounded-t-2xl flex items-center justify-center">
            <p className="text-gray-400 text-sm">Creating template...</p>
          </div>
        )}
      </div>
    </div>
  )
}
