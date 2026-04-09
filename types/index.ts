export type Phase = 'cut' | 'gain' | 'reverse' | 'maintain'

export interface Profile {
  id: string
  name: string | null
  age: number | null
  gender: string | null
  height_cm: number | null
  job: string | null
  activity_level: number | null
  start_weight: number | null
  goal_weight: number | null
  bmr: number | null
  maintenance_cals: number | null
  allergies: string | null
  supplements: string | null
  notes: string | null
  why: string | null
  hevy_api_key: string | null
}

export interface Plan {
  id: string
  user_id: string
  phase: Phase
  name: string | null
  start_date: string | null
  cal_target: number | null
  prot_target: number | null
  steps_target: number | null
  start_weight: number | null
  goal_weight: number | null
  maintenance_cals: number | null
  cpr_target: number | null
  notes: string | null
  is_active: boolean
}

export interface DailyLog {
  id: string
  user_id: string
  date: string
  calories: number | null
  protein: number | null
  steps: number | null
  weight: number | null
  creatine: boolean | null
  excuse: string | null
  excuse_wi: string | null
  excuse_log: string | null
  excuse_supp: boolean | null
}

export interface ProgressPhoto {
  id: string
  user_id: string
  date: string
  label: string | null
  note: string | null
  storage_path: string
  weight_on_day: number | null
  url?: string
}

export interface WeekSummary {
  weekNum: number
  startDate: string
  avgCal: number | null
  avgProt: number | null
  avgSteps: number | null
  startWeight: number | null
  endWeight: number | null
  avgWeight: number | null
  change: number | null
  creatineDays: number
  loggedDays: number
}
