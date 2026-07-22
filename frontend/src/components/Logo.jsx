import { useId } from "react";

export default function Logo({ size = 30 }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="4" y1="24" x2="28" y2="8" gradientUnits="userSpaceOnUse">
          <stop stopColor="#34e5c4" />
          <stop offset=".55" stopColor="#8b5cf6" />
          <stop offset="1" stopColor="#10b981" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="#0b0e14" />
      <path d="M5 22c4-9 18-9 22 0" stroke={`url(#${id})`} strokeWidth="2.6" strokeLinecap="round" opacity=".55" />
      <path d="M7 19c3.6-7 14.4-7 18 0" stroke={`url(#${id})`} strokeWidth="2.6" strokeLinecap="round" opacity=".8" />
      <path d="M9.5 16c2.7-5 10.3-5 13 0" stroke={`url(#${id})`} strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="16" cy="25" r="1.4" fill="#e8ecf4" />
    </svg>
  );
}
