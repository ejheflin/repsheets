const GHOST_KEY = 'repsheets_ghost'
export const isGhostActive  = () => localStorage.getItem(GHOST_KEY) === '1'
export const activateGhost  = () => localStorage.setItem(GHOST_KEY, '1')
export const deactivateGhost = () => localStorage.removeItem(GHOST_KEY)
