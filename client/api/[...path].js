import { Buffer } from 'node:buffer'
import process from 'node:process'

const hopByHopHeaders = new Set([
  'connection',
  'content-length',
  'host',
  'keep-alive',
  'transfer-encoding',
])

export default async function handler(req, res) {
  const backendOrigin = process.env.API_ORIGIN
  let backendUrl

  try {
    backendUrl = new URL(backendOrigin)
  } catch {
    return res.status(500).json({ error: 'Set API_ORIGIN to the HTTPS origin of the backend service.' })
  }

  if (
    backendUrl.protocol !== 'https:' ||
    backendUrl.username ||
    backendUrl.password ||
    backendUrl.pathname !== '/' ||
    backendUrl.search ||
    backendUrl.hash
  ) {
    return res.status(500).json({ error: 'API_ORIGIN must be an HTTPS origin without a path.' })
  }

  const target = new URL(req.url, backendUrl)
  const headers = new Headers(req.headers)
  for (const header of hopByHopHeaders) headers.delete(header)

  const hasBody = !['GET', 'HEAD'].includes(req.method)

  try {
    const response = await fetch(target, {
      method: req.method,
      headers,
      ...(hasBody ? { body: req, duplex: 'half' } : {}),
      redirect: 'manual',
    })

    res.status(response.status)
    for (const [name, value] of response.headers) {
      if (name !== 'set-cookie' && !hopByHopHeaders.has(name.toLowerCase())) {
        res.setHeader(name, value)
      }
    }

    const cookies = response.headers.getSetCookie()
    if (cookies.length) res.setHeader('set-cookie', cookies)

    return res.send(Buffer.from(await response.arrayBuffer()))
  } catch (error) {
    console.error('Vercel API proxy failed:', error)
    return res.status(502).json({ error: 'The backend service could not be reached.' })
  }
}

export const config = {
  api: {
    bodyParser: false,
  },
}
