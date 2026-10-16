import './Logo.css'

export default function Logo() {
  return <span className="logo" aria-label="Smart Leave">
    <svg className="logo-mark" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect className="logo-tile" x="2" y="2" width="28" height="28" rx="6" />
      <path className="logo-check" d="m9 16 5 5 9-10" />
    </svg>
    <span className="logo-wordmark">Smart Leave</span>
  </span>
}
