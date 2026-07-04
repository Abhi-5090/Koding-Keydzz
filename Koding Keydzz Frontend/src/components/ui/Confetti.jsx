import { useMemo } from 'react'

const COLORS = ['#FF602F', '#FF6A3D', '#FF8A4D', '#2DD4BF', '#5BC0BE', '#ffffff']

// Lightweight CSS confetti burst. Render conditionally with a key to replay.
// Pass `tint` (a world accent) to theme the burst in that world's colour while
// keeping a couple of light flecks for sparkle; omit it for the Ember default.
export default function Confetti({ pieces = 60, tint }) {
  const palette = tint ? [tint, tint, `${tint}AA`, '#FFFFFF'] : COLORS
  const items = useMemo(
    () =>
      Array.from({ length: pieces }).map((_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 0.4,
        duration: 1.6 + Math.random() * 1.4,
        color: palette[Math.floor(Math.random() * palette.length)],
        size: 6 + Math.random() * 8,
        rounded: Math.random() > 0.5,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pieces, tint]
  )

  return (
    <div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden">
      {items.map((c) => (
        <span
          key={c.id}
          className="animate-confetti absolute top-0 block"
          style={{
            left: `${c.left}%`,
            width: c.size,
            height: c.size,
            background: c.color,
            borderRadius: c.rounded ? '50%' : '2px',
            animationDelay: `${c.delay}s`,
            animationDuration: `${c.duration}s`,
          }}
        />
      ))}
    </div>
  )
}
