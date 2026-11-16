export default function Logo({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="#3DDC97" />
      <path
        d="M16 24V14M16 14c0-4 3-6 7-6 0 4-3 6-7 6zM16 17c0-3-2.5-5-6-5 0 3 2.5 5 6 5z"
        stroke="#06281A"
        strokeWidth="2.2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
