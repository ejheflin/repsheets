// Cloudflare Worker — OAuth token exchange and refresh
// Deploy: npx wrangler deploy
// Secrets: wrangler secret put GOOGLE_CLIENT_SECRET

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export default {
  async fetch(request, env) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS })
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS })
    }

    const url = new URL(request.url)
    const body = await request.json()

    try {
      if (url.pathname === '/auth/token') {
        // Exchange authorization code for tokens
        const { code, client_id, redirect_uri } = body

        const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            code,
            client_id,
            client_secret: env.GOOGLE_CLIENT_SECRET,
            redirect_uri,
            grant_type: 'authorization_code',
          }),
        })

        const tokenData = await tokenRes.json()

        if (!tokenRes.ok) {
          return new Response(JSON.stringify({ error: tokenData.error_description || tokenData.error }), {
            status: 400,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
          })
        }

        return new Response(JSON.stringify({
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          expires_in: tokenData.expires_in,
        }), {
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        })

      } else if (url.pathname === '/auth/refresh') {
        // Refresh access token using refresh token
        const { refresh_token, client_id } = body

        const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            refresh_token,
            client_id,
            client_secret: env.GOOGLE_CLIENT_SECRET,
            grant_type: 'refresh_token',
          }),
        })

        const tokenData = await tokenRes.json()

        if (!tokenRes.ok) {
          return new Response(JSON.stringify({ error: tokenData.error_description || tokenData.error }), {
            status: 400,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
          })
        }

        return new Response(JSON.stringify({
          access_token: tokenData.access_token,
          expires_in: tokenData.expires_in,
        }), {
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        })

      } else {
        return new Response('Not found', { status: 404, headers: CORS_HEADERS })
      }
    } catch (e) {
      return new Response(JSON.stringify({ error: String(e) }), {
        status: 500,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }
  },
}
