import { AnimatePresence, motion } from 'framer-motion'

interface Props {
  show: boolean
  message?: string
  onDone: () => void
}

// Confetti-ish: a burst of brand birds + dots floating up. Tasteful, not noisy.
const CONFETTI = Array.from({ length: 14 }, (_, i) => i)
const COLORS = ['var(--color-coral)', 'var(--color-yellow)', 'var(--color-sky)']

export function CelebrationOverlay({ show, message = 'Report submitted!', onDone }: Props) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-0 z-50 grid place-items-center bg-[var(--color-charcoal)]/20 backdrop-blur-[2px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onDone}
        >
          {/* confetti */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            {CONFETTI.map((i) => {
              const left = (i * 97) % 100
              return (
                <motion.span
                  key={i}
                  className="absolute block size-2.5 rounded-full"
                  style={{ left: `${left}%`, top: '60%', background: COLORS[i % COLORS.length] }}
                  initial={{ y: 0, opacity: 0, scale: 0.5 }}
                  animate={{ y: -380 - (i % 5) * 60, opacity: [0, 1, 1, 0], scale: 1, rotate: i * 40 }}
                  transition={{ duration: 1.6 + (i % 4) * 0.25, ease: 'easeOut' }}
                />
              )
            })}
          </div>

          <motion.div
            className="relative flex flex-col items-center gap-3 rounded-[20px] bg-white px-10 py-8 text-center shadow-xl"
            initial={{ scale: 0.7, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 20 }}
          >
            <motion.img
              src="/brand/bird-coral.png"
              alt=""
              className="size-16 object-contain"
              animate={{ rotate: [0, -10, 10, -6, 0], y: [0, -6, 0] }}
              transition={{ duration: 0.9, ease: 'easeInOut' }}
            />
            <h2 className="text-xl font-extrabold text-[var(--color-charcoal)]">{message}</h2>
            <p className="text-sm text-[var(--color-dk-gray)]">Nice work — see you tomorrow. 🐤</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
