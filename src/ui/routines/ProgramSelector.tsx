interface ProgramSelectorProps {
  programs: string[]
  selected: string
  onSelect: (program: string) => void
}

export function ProgramSelector({ programs, selected, onSelect }: ProgramSelectorProps) {
  return (
    <div className="mb-3">
      <select
        value={selected}
        onChange={(e) => onSelect(e.target.value)}
        className="bg-transparent text-gray-400 text-[11px] border-none outline-none cursor-pointer"
      >
        {programs.map((p) => (
          <option key={p} value={p} className="bg-[#1a1a2e]">{p}</option>
        ))}
      </select>
      <span className="text-gray-400 text-[11px] ml-1">▾</span>
    </div>
  )
}
