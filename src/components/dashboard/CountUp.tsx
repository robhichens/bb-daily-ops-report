import { useEffect, useState } from 'react'
import { animate } from 'framer-motion'

interface Props {
  value: number
  decimals?: number
  suffix?: string
  className?: string
}

/** Animated number tick-in for KPI cards. */
export function CountUp({ value, decimals = 0, suffix = '', className }: Props) {
  const [display, setDisplay] = useState(0)
  useEffect(() => {
    const controls = animate(0, value, {
      duration: 0.8,
      ease: 'easeOut',
      onUpdate: (v) => setDisplay(v),
    })
    return () => controls.stop()
  }, [value])
  return (
    <span className={className}>
      {display.toFixed(decimals)}
      {suffix}
    </span>
  )
}
