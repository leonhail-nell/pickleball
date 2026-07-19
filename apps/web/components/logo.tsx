/** Pickleball paddle + ball logo mark. */
export function PaddleLogo({ size = 26 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block' }}
    >
      {/* paddle face, angled */}
      <g transform="rotate(-35 22 20)">
        <rect x="10" y="2" width="24" height="30" rx="11" fill="#43a047" stroke="#2c6e31" strokeWidth="2" />
        {/* holes */}
        <circle cx="18" cy="12" r="1.6" fill="#2c6e31" opacity="0.55" />
        <circle cx="24" cy="10" r="1.6" fill="#2c6e31" opacity="0.55" />
        <circle cx="27" cy="16" r="1.6" fill="#2c6e31" opacity="0.55" />
        <circle cx="20" cy="19" r="1.6" fill="#2c6e31" opacity="0.55" />
        <circle cx="25" cy="23" r="1.6" fill="#2c6e31" opacity="0.55" />
        {/* handle */}
        <rect x="19.5" y="30" width="5" height="12" rx="2.5" fill="#8d6e63" stroke="#6d4c41" strokeWidth="1.5" />
      </g>
      {/* ball */}
      <circle cx="37" cy="35" r="7" fill="#cbe74d" stroke="#a8bf3a" strokeWidth="1.5" />
      <circle cx="34.5" cy="33" r="1.1" fill="#a8bf3a" />
      <circle cx="39.5" cy="33.5" r="1.1" fill="#a8bf3a" />
      <circle cx="37" cy="37.5" r="1.1" fill="#a8bf3a" />
    </svg>
  );
}
