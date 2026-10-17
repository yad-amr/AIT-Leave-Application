const apiOrigin = (import.meta.env.VITE_API_ORIGIN || '').replace(/\/+$/, '')

export function apiUrl(path) {
  return `${apiOrigin}/api${path}`
}

export async function api(path, body) {
  const multipart = body instanceof FormData
  const response = await fetch(apiUrl(path), { credentials: 'include', ...(body ? { method: 'POST', ...(multipart ? {} : { headers: { 'Content-Type': 'application/json' } }), body: multipart ? body : JSON.stringify(body) } : {}) })
  const data = await response.json()
  if (!response.ok) throw Object.assign(new Error(data.error || 'Request failed. Please try again.'), { ...data, status: response.status })
  return data
}
