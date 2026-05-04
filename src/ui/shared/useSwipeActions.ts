import { useState, useRef, useCallback, useEffect } from 'react'

interface UseSwipeActionsOptions {
  actionWidth: number
  threshold?: number
}

export function useSwipeActions({ actionWidth, threshold = 0.4 }: UseSwipeActionsOptions) {
  const [offset, setOffset] = useState(0)
  const [transitioning, setTransitioning] = useState(false)

  const contentRef = useRef<HTMLDivElement>(null)
  const startX = useRef(0)
  const startY = useRef(0)
  const baseOffset = useRef(0)
  const liveOffset = useRef(0)
  const gestureOwned = useRef<boolean | null>(null)
  const openRef = useRef(false)

  const snapTo = useCallback((target: number) => {
    openRef.current = target < 0
    liveOffset.current = target
    setTransitioning(true)
    setOffset(target)
  }, [])

  const close = useCallback(() => snapTo(0), [snapTo])

  useEffect(() => {
    const el = contentRef.current
    if (!el) return

    const onTouchStart = (e: TouchEvent) => {
      startX.current = e.touches[0].clientX
      startY.current = e.touches[0].clientY
      baseOffset.current = openRef.current ? -actionWidth : 0
      liveOffset.current = baseOffset.current
      gestureOwned.current = null
      setTransitioning(false)
    }

    const onTouchMove = (e: TouchEvent) => {
      const dx = e.touches[0].clientX - startX.current
      const dy = e.touches[0].clientY - startY.current

      if (gestureOwned.current === null) {
        if (Math.abs(dx) < 3 && Math.abs(dy) < 3) return
        gestureOwned.current = Math.abs(dx) > Math.abs(dy)
      }

      if (!gestureOwned.current) return
      e.preventDefault()

      const clamped = Math.max(-actionWidth, Math.min(0, baseOffset.current + dx))
      liveOffset.current = clamped
      setOffset(clamped)
    }

    const onTouchEnd = () => {
      if (gestureOwned.current !== true) return
      gestureOwned.current = null
      snapTo(Math.abs(liveOffset.current) >= actionWidth * threshold ? -actionWidth : 0)
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd, { passive: true })

    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
    }
  }, [actionWidth, threshold, snapTo])

  return { offset, transitioning, isOpen: offset === -actionWidth, contentRef, close }
}
