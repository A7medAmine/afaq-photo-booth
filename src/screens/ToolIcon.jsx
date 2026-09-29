const PATHS = {
  pen: 'M4 20l1-4L16 5l3 3L8 19zM14 7l3 3',
  fill: 'M5 12l7-7 7 7-7 7zM5 12h14M20 16c1 1.4 1.5 2.3 1.5 3a1.5 1.5 0 0 1-3 0c0-.7.5-1.6 1.5-3z',
  erase: 'M9 20l-5-5a2 2 0 0 1 0-3l9-9a2 2 0 0 1 3 0l4 4a2 2 0 0 1 0 3l-8 10zM9 20h11M8 9l7 7',
  pan: 'M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3',
  line: 'M5 19L19 5',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  rect: 'M5 6h14v12H5z',
  circle: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16z',
  triangle: 'M12 4l9 16H3z',
  diamond: 'M12 3l9 9-9 9-9-9z',
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z',
  heart: 'M12 20s-8-5-8-10.5C4 6.7 6 5 8.2 5c1.6 0 3 .9 3.8 2.2C12.8 5.9 14.2 5 15.8 5 18 5 20 6.7 20 9.5 20 15 12 20 12 20z',
}

export default function ToolIcon({ name, size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  )
}
