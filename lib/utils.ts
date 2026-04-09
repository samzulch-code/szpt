import { format, subDays, parseISO } from 'date-fns'
import { DailyLog, WeekSummary } from '@/types'

export function today(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

export function daysAgo(n: number): string {
  return format(subDays(new Date(), n), 'yyyy-MM-dd')
}

export function last7Days(): string[] {
  return Array.from({ length: 7 }, (_, i) => daysAgo(6 - i))
}

export function last28Days(): string[] {
  return Array.from({ length: 28 }, (_, i) => daysAgo(27 - i))
}

export function last30Days(): string[] {
  return Array.from({ length: 30 }, (_, i) => daysAgo(29 - i))
}

export function last56Days(): string[] {
  return Array.from({ length: 56 }, (_, i) => daysAgo(55 - i))
}

export function formatDate(dateStr: string): string {
  return format(parseISO(dateStr), 'd MMM')
}

export function formatDateLong(dateStr: string): string {
  return format(parseISO(dateStr), 'd MMMM yyyy')
}

export function avg(arr: number[]): number | null {
  if (!arr.length) return null
  return arr.reduce((a, b) => a + b, 0) / arr.length
}

export function calcBMR(
  weight: number,
  heightCm: number,
  age: number,
  gender: string
): number {
  if (gender === 'Male') {
    return Math.round(88.362 + 13.397 * weight + 4.799 * heightCm - 5.677 * age)
  } else if (gender === 'Female') {
    return Math.round(447.593 + 9.247 * weight + 3.098 * heightCm - 4.330 * age)
  }
  const m = Math.round(88.362 + 13.397 * weight + 4.799 * heightCm - 5.677 * age)
  const f = Math.round(447.593 + 9.247 * weight + 3.098 * heightCm - 4.330 * age)
  return Math.round((m + f) / 2)
}

export function calcTDEE(bmr: number, activityLevel: number): number {
  return Math.round(bmr * activityLevel)
}

export function getLatestWeight(logs: DailyLog[]): number | null {
  const withWeight = logs
    .filter(l => l.weight !== null)
    .sort((a, b) => b.date.localeCompare(a.date))
  return withWeight.length ? withWeight[0].weight : null
}

export function buildWeekSummaries(
  logs: DailyLog[],
  planStartDate: string,
  maxWeeks = 20
): WeekSummary[] {
  const logMap = Object.fromEntries(logs.map(l => [l.date, l]))
  const start = parseISO(planStartDate)
  const summaries: WeekSummary[] = []

  for (let w = 0; w < maxWeeks; w++) {
    const days: string[] = []
    for (let d = 0; d < 7; d++) {
      const date = new Date(start)
      date.setDate(start.getDate() + w * 7 + d)
      days.push(format(date, 'yyyy-MM-dd'))
    }
    const valid = days.filter(d => logMap[d])
    if (!valid.length) continue

    const cals = valid.filter(d => logMap[d].calories != null).map(d => logMap[d].calories!)
    const prots = valid.filter(d => logMap[d].protein != null).map(d => logMap[d].protein!)
    const steps = valid.filter(d => logMap[d].steps != null).map(d => logMap[d].steps!)
    const wts = days.filter(d => logMap[d]?.weight != null).map(d => logMap[d].weight!)
    const creatineDays = valid.filter(d => logMap[d].creatine === true).length

    const avgWt = wts.length ? parseFloat((wts.reduce((a,b)=>a+b,0)/wts.length).toFixed(2)) : null
    summaries.push({
      weekNum: w + 1,
      startDate: days[0],
      avgCal: avg(cals),
      avgProt: avg(prots),
      avgSteps: avg(steps),
      startWeight: wts[0] ?? null,
      endWeight: wts[wts.length - 1] ?? null,
      avgWeight: avgWt,
      change: wts.length > 1 ? wts[wts.length - 1] - wts[0] : null,
      creatineDays,
      loggedDays: valid.length,
    })
  }
  return summaries
}

export function parseCSVImport(raw: string): Partial<DailyLog>[] {
  const lines = raw.trim().split('\n').filter(Boolean)
  if (!lines.length) return []

  // Detect header row
  const firstLine = lines[0].toLowerCase()
  const hasHeader = firstLine.includes('date') || firstLine.includes('cal') || firstLine.includes('weight')
  const dataLines = hasHeader ? lines.slice(1) : lines

  return dataLines.map(line => {
    const cols = line.split(/[,\t]/).map(c => c.trim().replace(/"/g, ''))
    // Expected columns: date, calories, protein, steps, weight, creatine
    const [dateRaw, calRaw, protRaw, stepsRaw, weightRaw, creatineRaw] = cols

    // Try to parse date — handle DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD
    let date = ''
    if (dateRaw) {
      const parts = dateRaw.split(/[-/]/)
      if (parts.length === 3) {
        if (parts[0].length === 4) {
          date = dateRaw.replace(/\//g, '-') // already YYYY-MM-DD
        } else if (parseInt(parts[1]) > 12) {
          // DD/MM/YYYY
          date = `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`
        } else {
          // MM/DD/YYYY
          date = `${parts[2]}-${parts[0].padStart(2,'0')}-${parts[1].padStart(2,'0')}`
        }
      }
    }

    return {
      date,
      calories: calRaw ? parseInt(calRaw) || null : null,
      protein: protRaw ? parseInt(protRaw) || null : null,
      steps: stepsRaw ? parseInt(stepsRaw) || null : null,
      weight: weightRaw ? parseFloat(weightRaw) || null : null,
      creatine: creatineRaw ? creatineRaw.toLowerCase() === 'yes' || creatineRaw === '1' || creatineRaw.toLowerCase() === 'true' : null,
    }
  }).filter(row => row.date)
}

export const ACTIVITY_LEVELS = [
  { value: 1.2,   label: 'Sedentary', desc: 'Desk job, little or no exercise' },
  { value: 1.375, label: 'Lightly Active', desc: 'Light exercise 1–3 days/week' },
  { value: 1.55,  label: 'Moderately Active', desc: 'Moderate exercise 3–5 days/week' },
  { value: 1.725, label: 'Very Active', desc: 'Heavy exercise 6–7 days/week' },
  { value: 1.9,   label: 'Extremely Active', desc: 'Physical job + training twice/day' },
]

export const PHASE_LABELS: Record<string, string> = {
  cut: 'Cut',
  gain: 'Gain',
  reverse: 'Reverse Diet',
  maintain: 'Maintenance',
}
