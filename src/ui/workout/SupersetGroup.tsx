import type { ReactNode } from 'react'

export function SupersetGroup({ children }: { children: ReactNode }) {
  return (
    <div className="flex mb-1.5">
      <div className="w-[3px] bg-[#6c63ff] rounded-sm mr-2 flex-shrink-0" />
      <div className="flex-1">{children}</div>
    </div>
  )
}
