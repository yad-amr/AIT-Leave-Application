export async function api(path, body) {
  const multipart = body instanceof FormData
  const response = await fetch(`/api${path}`, { credentials: 'same-origin', ...(body ? { method: 'POST', ...(multipart ? {} : { headers: { 'Content-Type': 'application/json' } }), body: multipart ? body : JSON.stringify(body) } : {}) })
  const data = await response.json()
  if (!response.ok) throw Object.assign(new Error(data.error || 'Request failed. Please try again.'), { ...data, status: response.status })
  return data
}
