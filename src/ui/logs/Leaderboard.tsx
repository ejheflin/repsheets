import type { AthleteStats } from '../../data/useLogs'

interface LeaderboardEntry {
  exercise: string
  rankings: { athlete: string; maxWeight: number }[]
}

interface LeaderboardProps {
  leaderboard: LeaderboardEntry[]
  athleteStats: AthleteStats[]
}

const MEDAL = ['', '', '']

export function Leaderboard({ leaderboard, athleteStats }: LeaderboardProps) {
  if (leaderboard.length === 0 && athleteStats.length === 0) return null

  return (
    <div className="bg-[#2a2a4a] rounded-[10px] p-3">
      <span className="text-sm font-semibold block mb-3">Leaderboard</span>

      {/* Athlete stats */}
      {athleteStats.length > 0 && (
        <div className="mb-3">
          <span className="text-[10px] text-gray-500 uppercase tracking-wider block mb-2">Attendance</span>
          <div className="space-y-1.5">
            {athleteStats.map((s, i) => (
              <div key={s.name} className="flex items-center gap-2 bg-[#1a1a2e] rounded-md px-2.5 py-1.5">
                <span className="text-xs w-5">{i < 3 ? MEDAL[i] : `${i + 1}.`}</span>
                <span className="text-xs font-semibold flex-1">{s.name}</span>
                <span className="text-[10px] text-gray-400">{s.workoutsPerWeek}/wk</span>
                <span className="text-[10px] text-gray-500">{s.totalWorkouts} total</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Per-exercise rankings */}
      {leaderboard.length > 0 && (
        <div>
          <span className="text-[10px] text-gray-500 uppercase tracking-wider block mb-2">Max Weight</span>
          <div className="space-y-2">
            {leaderboard.slice(0, 8).map((entry) => (
              <div key={entry.exercise}>
                <p className="text-[11px] text-gray-400 mb-1">{entry.exercise}</p>
                <div className="space-y-0.5">
                  {entry.rankings.map((r, i) => (
                    <div key={r.athlete} className="flex items-center gap-2 bg-[#1a1a2e] rounded px-2 py-1">
                      <span className="text-[10px] w-4">{i < 3 ? MEDAL[i] : `${i + 1}.`}</span>
                      <span className="text-[11px] flex-1">{r.athlete}</span>
                      <span className="text-[11px] font-bold text-[#6c63ff]">{r.maxWeight}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
