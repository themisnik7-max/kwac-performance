// ISO week number — single source of truth for "which weekly_submissions row
// is this activity for." Was previously duplicated inline in
// app/submit/page.jsx; now also needed server-side (app/api/sprint/entry)
// so a sprint call logged right at a week boundary lands in the same week
// the /submit form would show it in.
export function getWeekInfo(d: Date): { week: number; year: number } {
  const date = new Date(d.getTime())
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7))
  const week1 = new Date(date.getFullYear(), 0, 4)
  const week = 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7)
  return { week, year: date.getFullYear() }
}
