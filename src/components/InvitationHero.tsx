import { motion } from 'framer-motion'
import { CollageContainer } from './collage/CollageContainer'

export function InvitationHero() {
  return (
    <motion.div
      className="min-h-dvh w-full bg-white py-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="mx-auto" style={{ width: 390 }}>
        <CollageContainer />
      </div>
    </motion.div>
  )
}
