interface LogoMarkProps {
  size?: number;
}

// Hexagonal mark with an eye/vision element — GFT Vision brand icon
export function GFTMark({ size = 40 }: LogoMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="gft-grad" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#3730a3" />
        </linearGradient>
      </defs>

      {/* Hexagon background */}
      <path
        d="M20 1 L35.6 10 L35.6 30 L20 39 L4.4 30 L4.4 10 Z"
        fill="url(#gft-grad)"
      />

      {/* Lens / eye shape */}
      <path
        d="M8 20 Q20 10.5 32 20 Q20 29.5 8 20 Z"
        fill="white"
        fillOpacity="0.18"
      />

      {/* Iris ring */}
      <circle cx="20" cy="20" r="6" fill="white" fillOpacity="0.95" />

      {/* Pupil */}
      <circle cx="20" cy="20" r="3.2" fill="#3730a3" />

      {/* Specular highlight */}
      <circle cx="21.8" cy="18.2" r="1.1" fill="white" fillOpacity="0.75" />
    </svg>
  );
}

// Full horizontal lockup: mark + wordmark
export function GFTLogo({
  theme = "dark",
}: {
  theme?: "dark" | "light";
}) {
  const nameColor = theme === "dark" ? "#ffffff" : "#0f172a";
  const subColor = theme === "dark" ? "#818cf8" : "#4f46e5";

  return (
    <div className="flex items-center gap-3">
      <GFTMark size={36} />
      <div className="leading-none">
        <p
          className="text-[15px] font-extrabold tracking-tight"
          style={{ color: nameColor }}
        >
          GFT
          <span style={{ color: subColor }}> Vision</span>
        </p>
        <p
          className="text-[10px] font-medium tracking-widest uppercase mt-0.5"
          style={{ color: theme === "dark" ? "#64748b" : "#94a3b8" }}
        >
          Staffing Platform
        </p>
      </div>
    </div>
  );
}
