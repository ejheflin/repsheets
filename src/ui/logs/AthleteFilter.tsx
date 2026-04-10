interface AthleteFilterProps {
  athletes: string[]
  selected: string | null  // null = me, '__all__' = everyone
  onSelect: (athlete: string | null) => void
}

export function AthleteFilter({ athletes, selected, onSelect }: AthleteFilterProps) {
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-2 -mx-3 px-3 scrollbar-hide">
      <button onClick={() => onSelect(null)}
        className={`flex-shrink-0 px-3 py-1 rounded-full text-[11px] font-medium transition ${
          selected === null ? 'bg-[#6c63ff] text-white' : 'bg-[#1a1a2e] text-gray-400'
        }`}>
        Me
      </button>
      <button onClick={() => onSelect('__all__')}
        className={`flex-shrink-0 px-3 py-1 rounded-full text-[11px] font-medium transition ${
          selected === '__all__' ? 'bg-[#6c63ff] text-white' : 'bg-[#1a1a2e] text-gray-400'
        }`}>
        Everyone
      </button>
      {athletes.map((a) => (
        <button key={a} onClick={() => onSelect(a)}
          className={`flex-shrink-0 px-3 py-1 rounded-full text-[11px] font-medium transition ${
            selected === a ? 'bg-[#6c63ff] text-white' : 'bg-[#1a1a2e] text-gray-400'
          }`}>
          {a}
        </button>
      ))}
    </div>
  )
}
