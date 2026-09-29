export const SHAPES = [
  { id: 'line', label: 'Line' },
  { id: 'arrow', label: 'Arrow' },
  { id: 'rect', label: 'Square' },
  { id: 'circle', label: 'Circle' },
  { id: 'triangle', label: 'Triangle' },
  { id: 'diamond', label: 'Diamond' },
  { id: 'star', label: 'Star' },
  { id: 'heart', label: 'Heart' },
]
export const OPEN_SHAPES = new Set(['line', 'arrow'])

export function shapePath(ctx, shape, x0, y0, x1, y1, size) {
  const x = Math.min(x0, x1)
  const y = Math.min(y0, y1)
  const w = Math.abs(x1 - x0)
  const h = Math.abs(y1 - y0)
  const cx = x + w / 2
  const cy = y + h / 2
  ctx.beginPath()
  switch (shape) {
    case 'line':
      ctx.moveTo(x0, y0)
      ctx.lineTo(x1, y1)
      break
    case 'arrow': {
      const len = Math.hypot(x1 - x0, y1 - y0)
      const head = Math.min(len * 0.5, Math.max(size * 2.5, len * 0.25))
      const a = Math.atan2(y1 - y0, x1 - x0)
      ctx.moveTo(x0, y0)
      ctx.lineTo(x1, y1)
      ctx.moveTo(x1 - head * Math.cos(a - 0.5), y1 - head * Math.sin(a - 0.5))
      ctx.lineTo(x1, y1)
      ctx.lineTo(x1 - head * Math.cos(a + 0.5), y1 - head * Math.sin(a + 0.5))
      break
    }
    case 'rect':
      ctx.rect(x, y, w, h)
      break
    case 'circle':
      ctx.ellipse(cx, cy, w / 2, h / 2, 0, 0, Math.PI * 2)
      break
    case 'triangle':
      ctx.moveTo(cx, y)
      ctx.lineTo(x + w, y + h)
      ctx.lineTo(x, y + h)
      ctx.closePath()
      break
    case 'diamond':
      ctx.moveTo(cx, y)
      ctx.lineTo(x + w, cy)
      ctx.lineTo(cx, y + h)
      ctx.lineTo(x, cy)
      ctx.closePath()
      break
    case 'star':
      for (let i = 0; i < 10; i++) {
        const r = i % 2 ? 0.4 : 1
        const a = -Math.PI / 2 + (i * Math.PI) / 5
        const px = cx + Math.cos(a) * r * (w / 2)
        const py = cy + Math.sin(a) * r * (h / 2)
        if (i) ctx.lineTo(px, py)
        else ctx.moveTo(px, py)
      }
      ctx.closePath()
      break
    case 'heart':
      ctx.moveTo(cx, y + h)
      ctx.bezierCurveTo(x - w * 0.15, y + h * 0.55, x + w * 0.05, y - h * 0.05, cx, y + h * 0.28)
      ctx.bezierCurveTo(x + w * 0.95, y - h * 0.05, x + w * 1.15, y + h * 0.55, cx, y + h)
      ctx.closePath()
      break
    default:
  }
}
