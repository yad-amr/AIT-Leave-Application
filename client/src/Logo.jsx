import './Logo.css'

export default function Logo() {
  return <span className="logo" aria-label="Smart Leave">
    <svg className="logo-mark" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path className="logo-document" d="M7 3h12l6 6v17a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3Z" />
      <path className="logo-fold" d="M19 3v7h6" />
      <path className="logo-shield" d="m19 14 10 4v5c0 4-5 7-10 9-5-2-10-5-10-9v-5l10-4Z" transform="translate(2 1) scale(.85)" />
      <path className="logo-check" d="m14 21 3 3 6-7" />
    </svg>
    <span className="logo-wordmark">Smart Leave</span>
  </span>
}
