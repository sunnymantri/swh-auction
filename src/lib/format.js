// Australian-localised formatting helpers (AUD, DD/MM/YYYY).

export const fmtPoints = (n) =>
  new Intl.NumberFormat('en-AU').format(Number(n ?? 0))

export const fmtAUD = (n) =>
  new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' })
    .format(Number(n ?? 0))

export const fmtStatus = (value) =>
  String(value ?? '')
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ')

// Always DD/MM/YYYY as plain text
export const fmtDate = (d) => {
  if (!d) return ''
  const dt = new Date(d)
  const dd = String(dt.getDate()).padStart(2, '0')
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}/${dt.getFullYear()}`
}
