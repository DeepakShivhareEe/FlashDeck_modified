import { useMemo, useRef } from 'react'

export function useSwipeGesture({ onSwipeLeft, onSwipeRight, threshold = 45 }) {
  const startRef = useRef({ x: 0, y: 0, active: false })

  const handlers = useMemo(() => ({
    onTouchStart: (event) => {
      const touch = event.changedTouches?.[0]
      if (!touch) return
      startRef.current = { x: touch.clientX, y: touch.clientY, active: true }
    },
    onTouchEnd: (event) => {
      const touch = event.changedTouches?.[0]
      if (!touch || !startRef.current.active) return

      const deltaX = touch.clientX - startRef.current.x
      const deltaY = touch.clientY - startRef.current.y

      if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > threshold) {
        if (deltaX > 0) onSwipeRight?.()
        else onSwipeLeft?.()
      }

      startRef.current.active = false
    },
  }), [onSwipeLeft, onSwipeRight, threshold])

  return handlers
}
