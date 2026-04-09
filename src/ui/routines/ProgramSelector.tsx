interface ProgramSelectorProps {
  programs: string[]
  selected: string
  onSelect: (program: string) => void
}

export function ProgramSelector({ programs, selected, onSelect }: ProgramSelectorProps) {
  return (
    <div className="relative flex-1">
      <select
        value={selected}
        onChange={(e) => onSelect(e.target.value)}
        className="w-full bg-[#2a2a4a] text-white text-sm font-semibold pl-4 pr-10 py-3 rounded-[10px] border border-[#3a3a5a] outline-none appearance-none cursor-pointer focus:border-[#6c63ff]"
      >
        {programs.map((p) => (
          <option key={p} value={p} className="bg-[#1a1a2e]">{p}</option>
        ))}
      </select>
      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#6c63ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="2 4 6 8 10 4" />
        </svg>
      </div>
    </div>
  )
}
