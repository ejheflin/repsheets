import { describe, it, expect } from 'vitest'
import { parseCsvRecords, parseHevyCsv, parseStrongCsv } from '../ui/logs/importCsv'

describe('parseCsvRecords', () => {
  it('splits simple rows and fields', () => {
    expect(parseCsvRecords('a,b,c\nd,e,f')).toEqual([['a', 'b', 'c'], ['d', 'e', 'f']])
  })

  it('handles quoted fields containing commas', () => {
    expect(parseCsvRecords('"Squat, paused",5')).toEqual([['Squat, paused', '5']])
  })

  it('handles quoted fields containing newlines', () => {
    expect(parseCsvRecords('"line one\nline two",5\nnext,6')).toEqual([
      ['line one\nline two', '5'],
      ['next', '6'],
    ])
  })

  it('handles escaped quotes without corrupting following fields', () => {
    expect(parseCsvRecords('"Bench 3""",100,5')).toEqual([['Bench 3"', '100', '5']])
  })

  it('handles CRLF line endings and skips blank lines', () => {
    expect(parseCsvRecords('a,b\r\n\r\nc,d\r\n')).toEqual([['a', 'b'], ['c', 'd']])
  })
})

const HEVY_HEADER =
  'title,start_time,end_time,description,exercise_title,superset_id,exercise_notes,set_index,set_type,weight_lbs,reps,distance_miles,duration_seconds,rpe'

describe('parseHevyCsv', () => {
  it('parses rows via header positions', () => {
    const csv = `${HEVY_HEADER}\n"Day A","7 Apr 2026, 05:12","7 Apr 2026, 06:00","","Squat","","",0,normal,225,5,,,`
    const result = parseHevyCsv(csv)
    expect(result.unit).toBe('lbs')
    expect(result.rows).toEqual([
      { title: 'Day A', startTime: '7 Apr 2026, 05:12', exerciseTitle: 'Squat', setIndex: 0, weight: 225, reps: 5 },
    ])
  })

  it('survives multiline workout descriptions', () => {
    const csv = `${HEVY_HEADER}\n"Day A","7 Apr 2026, 05:12","","felt great\ntough session","Squat","","",0,normal,225,5,,,\n"Day A","7 Apr 2026, 05:12","","felt great\ntough session","Squat","","",1,normal,225,5,,,`
    const result = parseHevyCsv(csv)
    expect(result.rows.length).toBe(2)
    expect(result.rows[1].setIndex).toBe(1)
  })

  it('detects kg exports from the header', () => {
    const csv = `${HEVY_HEADER.replace('weight_lbs', 'weight_kg')}\n"Day A","7 Apr 2026, 05:12","","","Squat","","",0,normal,100,5,,,`
    const result = parseHevyCsv(csv)
    expect(result.unit).toBe('kg')
    expect(result.rows[0].weight).toBe(100)
  })

  it('rejects CSVs that are not Hevy exports', () => {
    expect(() => parseHevyCsv('name,email,phone\na,b,c')).toThrow(/missing columns/)
  })
})

const STRONG_HEADER =
  'Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Reps,Distance,Seconds,Notes,Workout Notes,RPE'

describe('parseStrongCsv', () => {
  it('parses rows via header positions and strips time from dates', () => {
    const csv = `${STRONG_HEADER}\n2026-04-07 22:38:33,"Day A",1h,"Squat",1,225,5,,,,,"note"`
    const result = parseStrongCsv(csv)
    expect(result.unit).toBeNull()
    expect(result.rows).toEqual([
      { date: '2026-04-07', workoutName: 'Day A', exerciseName: 'Squat', setOrder: 1, weight: 225, reps: 5 },
    ])
  })

  it('reads the Weight Unit column when present', () => {
    const csv = `Date,Workout Name,Exercise Name,Set Order,Weight,Weight Unit,Reps\n2026-04-07,"Day A","Squat",1,100,kg,5`
    const result = parseStrongCsv(csv)
    expect(result.unit).toBe('kg')
  })

  it('survives multiline notes fields', () => {
    const csv = `${STRONG_HEADER}\n2026-04-07 10:00:00,"Day A",1h,"Squat",1,225,5,,,"first line\nsecond line","",\n2026-04-07 10:00:00,"Day A",1h,"Squat",2,225,5,,,,,`
    const result = parseStrongCsv(csv)
    expect(result.rows.length).toBe(2)
    expect(result.rows[1].setOrder).toBe(2)
  })

  it('rejects CSVs that are not Strong exports', () => {
    expect(() => parseStrongCsv('name,email,phone\na,b,c')).toThrow(/missing columns/)
  })
})
