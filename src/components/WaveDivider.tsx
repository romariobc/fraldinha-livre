// src/components/WaveDivider.tsx
interface WaveDividerProps {
  bgTop: string
  bgBottom: string
  path?: string
  height?: number
}

export default function WaveDivider({
  bgTop,
  bgBottom,
  path = 'M0,35 C360,70 1080,0 1440,35 L1440,70 L0,70 Z',
  height = 70,
}: WaveDividerProps) {
  return (
    <div
      className="w-full overflow-hidden leading-none -mt-px"
      style={{ background: bgTop }}
      aria-hidden="true"
    >
      <svg
        viewBox={`0 0 1440 ${height}`}
        preserveAspectRatio="none"
        className="block w-full"
        style={{ height }}
      >
        <path d={path} fill={bgBottom} />
      </svg>
    </div>
  )
}
