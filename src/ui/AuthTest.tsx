import { useState } from 'react'
import { GOOGLE_CLIENT_ID, SCOPES } from '../config'
import { getStoredUser, silentRefresh } from '../auth/googleAuth'

export function AuthTest() {
  const [results, setResults] = useState<string[]>([])

  const log = (msg: string) => {
    setResults((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`])
  }

  const testCurrentToken = async () => {
    const user = getStoredUser()
    if (!user) { log('Test 1: No stored user'); return }
    log(`Test 1: Stored token exists, testing API call...`)
    try {
      const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${user.accessToken}` }
      })
      log(`Test 1: API returned ${res.status} ${res.statusText}`)
      if (res.ok) {
        const data = await res.json()
        log(`Test 1: PASS — token valid for ${data.email}`)
      } else {
        log(`Test 1: FAIL — token expired or invalid`)
      }
    } catch (e) {
      log(`Test 1: ERROR — ${e}`)
    }
  }

  const testSilentRefresh = () => {
    log('Test 2: Attempting silent refresh (prompt: "")...')
    try {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: SCOPES,
        callback: (response) => {
          if (response.error) {
            log(`Test 2: FAIL — callback error: ${response.error}`)
          } else {
            log(`Test 2: PASS — got new token: ${response.access_token.slice(0, 20)}...`)
            // Save it
            const user = getStoredUser()
            if (user) {
              user.accessToken = response.access_token
              localStorage.setItem('repsheets_user', JSON.stringify(user))
              localStorage.setItem('repsheets_token', response.access_token)
              log('Test 2: Token saved to localStorage')
            }
          }
        },
        error_callback: (error) => {
          log(`Test 2: FAIL — error_callback: ${error.type} ${(error as Record<string, unknown>).message ?? ''}`)
        },
      })
      client.requestAccessToken({ prompt: '' })
    } catch (e) {
      log(`Test 2: ERROR — ${e}`)
    }
  }

  const testInteractiveRefresh = () => {
    log('Test 3: Attempting interactive refresh (no prompt option)...')
    try {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: SCOPES,
        callback: (response) => {
          if (response.error) {
            log(`Test 3: FAIL — callback error: ${response.error}`)
          } else {
            log(`Test 3: PASS — got new token: ${response.access_token.slice(0, 20)}...`)
            const user = getStoredUser()
            if (user) {
              user.accessToken = response.access_token
              localStorage.setItem('repsheets_user', JSON.stringify(user))
              localStorage.setItem('repsheets_token', response.access_token)
              log('Test 3: Token saved to localStorage')
            }
          }
        },
        error_callback: (error) => {
          log(`Test 3: FAIL — error_callback: ${error.type} ${(error as Record<string, unknown>).message ?? ''}`)
        },
      })
      client.requestAccessToken()
    } catch (e) {
      log(`Test 3: ERROR — ${e}`)
    }
  }

  const testConsentRefresh = () => {
    log('Test 4: Attempting consent refresh (prompt: "consent")...')
    try {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: SCOPES,
        callback: (response) => {
          if (response.error) {
            log(`Test 4: FAIL — callback error: ${response.error}`)
          } else {
            log(`Test 4: PASS — got new token: ${response.access_token.slice(0, 20)}...`)
            const user = getStoredUser()
            if (user) {
              user.accessToken = response.access_token
              localStorage.setItem('repsheets_user', JSON.stringify(user))
              localStorage.setItem('repsheets_token', response.access_token)
              log('Test 4: Token saved to localStorage')
            }
          }
        },
        error_callback: (error) => {
          log(`Test 4: FAIL — error_callback: ${error.type} ${(error as Record<string, unknown>).message ?? ''}`)
        },
      })
      client.requestAccessToken({ prompt: 'consent' })
    } catch (e) {
      log(`Test 4: ERROR — ${e}`)
    }
  }

  const testSelectAccountRefresh = () => {
    log('Test 5: Attempting select_account refresh...')
    try {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: SCOPES,
        callback: (response) => {
          if (response.error) {
            log(`Test 5: FAIL — callback error: ${response.error}`)
          } else {
            log(`Test 5: PASS — got new token: ${response.access_token.slice(0, 20)}...`)
            const user = getStoredUser()
            if (user) {
              user.accessToken = response.access_token
              localStorage.setItem('repsheets_user', JSON.stringify(user))
              localStorage.setItem('repsheets_token', response.access_token)
              log('Test 5: Token saved to localStorage')
            }
          }
        },
        error_callback: (error) => {
          log(`Test 5: FAIL — error_callback: ${error.type} ${(error as Record<string, unknown>).message ?? ''}`)
        },
      })
      client.requestAccessToken({ prompt: 'select_account' })
    } catch (e) {
      log(`Test 5: ERROR — ${e}`)
    }
  }

  const testGISLoaded = () => {
    log(`Test 6: window.google exists: ${!!window.google}`)
    log(`Test 6: window.google.accounts exists: ${!!window.google?.accounts}`)
    log(`Test 6: oauth2 exists: ${!!window.google?.accounts?.oauth2}`)
    log(`Test 6: initTokenClient exists: ${typeof window.google?.accounts?.oauth2?.initTokenClient}`)
    log(`Test 6: CLIENT_ID present: ${GOOGLE_CLIENT_ID ? 'yes (' + GOOGLE_CLIENT_ID.slice(0, 15) + '...)' : 'EMPTY'}`)
  }

  const testClearAndLogin = () => {
    log('Test 7: Clearing stored user and doing fresh login...')
    localStorage.removeItem('repsheets_user')
    localStorage.removeItem('repsheets_token')
    localStorage.removeItem('repsheets_token_time')
    testInteractiveRefresh()
  }

  const testRefreshTokenStored = () => {
    const rt = localStorage.getItem('repsheets_refresh_token')
    if (rt) {
      log(`Worker A: Refresh token STORED ✓ (${rt.slice(0, 12)}...)`)
    } else {
      log('Worker A: Refresh token NOT FOUND ✗ — log in via redirect first')
    }
  }

  const testSimulateExpiry = () => {
    const user = getStoredUser()
    if (!user) { log('Worker B: No stored user — log in first'); return }
    user.accessToken = 'simulated_expired_token'
    localStorage.setItem('repsheets_user', JSON.stringify(user))
    localStorage.setItem('repsheets_token', 'simulated_expired_token')
    localStorage.setItem('repsheets_token_time', '0')
    log('Worker B: Access token replaced with expired placeholder ✓')
    log('Worker B: Now run "Worker C: Test Worker Renewal"')
  }

  const testWorkerRenewal = async () => {
    log('Worker C: Calling silentRefresh() via Cloudflare worker...')
    try {
      const user = await silentRefresh()
      if (user) {
        log(`Worker C: PASS ✓ — renewed token for ${user.email}`)
        log(`Worker C: New token: ${user.accessToken.slice(0, 20)}...`)
      } else {
        log('Worker C: FAIL ✗ — silentRefresh returned null (no refresh token or worker error)')
      }
    } catch (e) {
      log(`Worker C: ERROR — ${e}`)
    }
  }

  const testApiAfterRefresh = async () => {
    const user = getStoredUser()
    if (!user) { log('Test 8: No stored user — run a refresh test first'); return }
    log(`Test 8: Testing Sheets API with current token...`)
    try {
      const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets?fields=sheets.properties.title`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${user.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ properties: { title: '__auth_test__' } }),
      })
      log(`Test 8: Sheets API returned ${res.status}`)
      if (res.status === 401) log('Test 8: FAIL — token is expired')
      else if (res.ok) log('Test 8: PASS — token works with Sheets API')
      else log(`Test 8: OTHER — ${res.statusText}`)
    } catch (e) {
      log(`Test 8: ERROR — ${e}`)
    }
  }

  return (
    <div className="min-h-screen bg-[#1a1a2e] text-white p-4">
      <h1 className="text-xl font-bold mb-4">Auth Test Page</h1>
      <p className="text-xs text-gray-400 mb-4">Log in, wait for token to expire (~1hr), then test each method.</p>

      <div className="space-y-2 mb-6">
        <button onClick={testGISLoaded} className="w-full bg-[#2a2a4a] rounded-lg p-3 text-left text-sm">
          Test 6: Check GIS Library Loaded
        </button>
        <button onClick={testCurrentToken} className="w-full bg-[#2a2a4a] rounded-lg p-3 text-left text-sm">
          Test 1: Check Current Token
        </button>
        <button onClick={testSilentRefresh} className="w-full bg-[#2a2a4a] rounded-lg p-3 text-left text-sm">
          Test 2: Silent Refresh (prompt: "")
        </button>
        <button onClick={testInteractiveRefresh} className="w-full bg-[#2a2a4a] rounded-lg p-3 text-left text-sm">
          Test 3: Interactive Refresh (no prompt)
        </button>
        <button onClick={testConsentRefresh} className="w-full bg-[#2a2a4a] rounded-lg p-3 text-left text-sm">
          Test 4: Consent Refresh (prompt: "consent")
        </button>
        <button onClick={testSelectAccountRefresh} className="w-full bg-[#2a2a4a] rounded-lg p-3 text-left text-sm">
          Test 5: Select Account Refresh
        </button>
        <button onClick={testClearAndLogin} className="w-full bg-[#2a2a4a] rounded-lg p-3 text-left text-sm">
          Test 7: Clear & Fresh Login
        </button>
        <button onClick={testApiAfterRefresh} className="w-full bg-[#2a2a4a] rounded-lg p-3 text-left text-sm">
          Test 8: Test Sheets API With Current Token
        </button>

        <div className="border-t border-[#3a3a5a] pt-3 mt-1">
          <p className="text-xs text-gray-400 mb-2">Cloudflare Worker Tests — run A → B → C in order</p>
          <button onClick={testRefreshTokenStored} className="w-full bg-[#1a2a1a] border border-green-800 rounded-lg p-3 text-left text-sm mb-2">
            Worker A: Check Refresh Token Stored
          </button>
          <button onClick={testSimulateExpiry} className="w-full bg-[#1a2a1a] border border-green-800 rounded-lg p-3 text-left text-sm mb-2">
            Worker B: Simulate Token Expiry
          </button>
          <button onClick={testWorkerRenewal} className="w-full bg-[#1a2a1a] border border-green-800 rounded-lg p-3 text-left text-sm">
            Worker C: Test Worker Renewal
          </button>
        </div>
      </div>

      <div className="bg-[#2a2a4a] rounded-lg p-3">
        <h3 className="text-xs font-semibold mb-2 text-gray-400">Results</h3>
        <div className="space-y-1 max-h-[50vh] overflow-y-auto">
          {results.length === 0 && <p className="text-xs text-gray-500">No tests run yet</p>}
          {results.map((r, i) => (
            <p key={i} className={`text-[11px] font-mono ${r.includes('PASS') ? 'text-green-400' : r.includes('FAIL') ? 'text-red-400' : 'text-gray-300'}`}>
              {r}
            </p>
          ))}
        </div>
      </div>

      <button onClick={() => setResults([])} className="mt-3 text-xs text-gray-500">Clear Results</button>
      <a href="/" className="block mt-2 text-xs text-[#6c63ff]">Back to App</a>
    </div>
  )
}
