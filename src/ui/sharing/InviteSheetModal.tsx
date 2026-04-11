import { useState } from 'react'
import { inviteByEmail, inviteByLink } from '../../sheets/driveApi'
import { shareOrCopy } from './shareLink'

type InviteMode = 'choose' | 'email' | 'link-warn' | 'done'

interface InviteSheetModalProps {
  spreadsheetId: string
  sheetName: string
  onClose: () => void
}

export function InviteSheetModal({ spreadsheetId, sheetName, onClose }: InviteSheetModalProps) {
  const [mode, setMode] = useState<InviteMode>('choose')
  const [email, setEmail] = useState('')
  const [resultUrl, setResultUrl] = useState('')
  const [usedNativeShare, setUsedNativeShare] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleEmail = async () => {
    if (!email.trim()) return
    setIsLoading(true)
    setError('')
    try {
      await inviteByEmail(spreadsheetId, email.trim())
      const joinUrl = `${window.location.origin}${window.location.pathname}?join=${spreadsheetId}`
      setResultUrl(joinUrl)
      setMode('done')
    } catch (e) {
      console.error('Invite email failed:', e)
      setError(String(e))
    }
    setIsLoading(false)
  }

  const handleLink = async () => {
    setIsLoading(true)
    setError('')
    try {
      await inviteByLink(spreadsheetId)
      const joinUrl = `${window.location.origin}${window.location.pathname}?join=${spreadsheetId}`
      setResultUrl(joinUrl)
      const native = await shareOrCopy(joinUrl, `Join repsheets - ${sheetName}`)
      setUsedNativeShare(native)
      setMode('done')
    } catch (e) {
      console.error('Invite link failed:', e)
      setError(String(e))
    }
    setIsLoading(false)
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end z-50" onClick={onClose}>
      <div className="w-full bg-[#1a1a2e] rounded-t-2xl p-5" onClick={(e) => e.stopPropagation()}>

        {mode === 'choose' && (
          <>
            <h2 className="text-base font-bold text-center mb-1">Invite to Sheet</h2>
            <p className="text-xs text-gray-400 text-center mb-4">
              Share "{sheetName}" so others can log workouts and see each other's progress
            </p>

            <button onClick={() => setMode('email')}
              className="w-full bg-[#2a2a4a] rounded-[10px] p-4 mb-2 text-left active:opacity-80">
              <div className="font-semibold text-sm">Invite by Email</div>
              <div className="text-[11px] text-gray-400 mt-1">Only they can access your sheet</div>
            </button>

            <button onClick={() => setMode('link-warn')}
              className="w-full bg-[#2a2a4a] rounded-[10px] p-4 mb-2 text-left active:opacity-80">
              <div className="font-semibold text-sm">Share Link</div>
              <div className="text-[11px] text-gray-400 mt-1">Anyone with this link can view and log workouts</div>
            </button>

            <button onClick={onClose} className="w-full p-3 text-center text-gray-400 font-semibold text-sm mt-1">
              Cancel
            </button>
          </>
        )}

        {mode === 'email' && (
          <>
            <h2 className="text-base font-bold text-center mb-4">Invite by Email</h2>
            <input type="email" value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="friend@gmail.com"
              className="w-full bg-[#2a2a4a] border border-[#3a3a5a] rounded-[10px] px-4 py-3 text-base outline-none focus:border-[#6c63ff] mb-3" />
            {error && <p className="text-red-400 text-xs mb-3">{error}</p>}
            <button onClick={handleEmail} disabled={isLoading || !email.trim()}
              className="w-full bg-[#6c63ff] rounded-[10px] p-3 text-center font-semibold text-sm mb-2 disabled:opacity-50">
              {isLoading ? 'Sending...' : 'Send Invite'}
            </button>
            <button onClick={() => setMode('choose')} className="w-full p-3 text-center text-gray-400 font-semibold text-sm">
              Back
            </button>
          </>
        )}

        {mode === 'link-warn' && (
          <>
            <h2 className="text-base font-bold text-center mb-2">Warning</h2>
            <p className="text-xs text-gray-400 text-center mb-4">
              This will make your sheet editable by anyone with the link.
              They will be able to see your logs and log their own workouts.
            </p>
            {error && <p className="text-red-400 text-xs mb-3">{error}</p>}
            <button onClick={handleLink} disabled={isLoading}
              className="w-full bg-red-500 rounded-[10px] p-3 text-center font-semibold text-sm mb-2 disabled:opacity-50">
              {isLoading ? 'Sharing...' : 'I Understand, Share'}
            </button>
            <button onClick={() => setMode('choose')} className="w-full p-3 text-center text-gray-400 font-semibold text-sm">
              Back
            </button>
          </>
        )}

        {mode === 'done' && (
          <>
            <h2 className="text-base font-bold text-center mb-2">
              {usedNativeShare || !resultUrl ? 'Shared!' : 'Link Copied!'}
            </h2>
            {!usedNativeShare && resultUrl ? (
              <>
                <p className="text-xs text-gray-400 text-center mb-3">Link copied to clipboard</p>
                <div className="bg-[#2a2a4a] rounded-[10px] p-3 mb-3">
                  <p className="text-[11px] text-gray-400 break-all">{resultUrl}</p>
                </div>
                <button onClick={() => shareOrCopy(resultUrl)}
                  className="w-full bg-[#2a2a4a] rounded-[10px] p-3 text-center text-[#6c63ff] font-semibold text-sm mb-2">
                  Copy Link Again
                </button>
              </>
            ) : !resultUrl ? (
              <p className="text-xs text-gray-400 text-center mb-3">
                Invite sent to {email}. They'll see the sheet in their app.
              </p>
            ) : null}
            <button onClick={onClose} className="w-full p-3 text-center text-gray-400 font-semibold text-sm">
              Done
            </button>
          </>
        )}
      </div>
    </div>
  )
}
