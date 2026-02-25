export function monthStart(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function monthEndExclusive(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 1);
}

function dateKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isWeekend(d: Date) {
  const wd = d.getDay();
  return wd === 0 || wd === 6;
}

function addDays(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function prevBusinessDay(d: Date, holidaySet: Set<string>) {
  let cur = new Date(d);
  while (isWeekend(cur) || holidaySet.has(dateKey(cur))) {
    cur = addDays(cur, -1);
  }
  return cur;
}

/*
    Minimal US federal holiday set.
    This is not perfect for all edge cases, but it is good enough to start.
    You can expand later or replace with a holiday list from your sheet.
  */
function observedDate(d: Date) {
  const wd = d.getDay();
  if (wd === 6) return addDays(d, -1);
  if (wd === 0) return addDays(d, 1);
  return d;
}

function nthWeekdayOfMonth(
  year: number,
  monthIndex: number,
  weekday: number,
  nth: number
) {
  const first = new Date(year, monthIndex, 1);
  const firstWd = first.getDay();
  const offset = (weekday - firstWd + 7) % 7;
  const day = 1 + offset + (nth - 1) * 7;
  return new Date(year, monthIndex, day);
}

function lastWeekdayOfMonth(year: number, monthIndex: number, weekday: number) {
  const last = new Date(year, monthIndex + 1, 0);
  const lastWd = last.getDay();
  const offset = (lastWd - weekday + 7) % 7;
  return new Date(year, monthIndex, last.getDate() - offset);
}

export function buildHolidaySet(years: number[]) {
  const set = new Set<string>();

  for (const y of years) {
    const fixed = [
      new Date(y, 0, 1),
      new Date(y, 5, 19),
      new Date(y, 6, 4),
      new Date(y, 10, 11),
      new Date(y, 11, 25),
    ];

    for (const d of fixed) set.add(dateKey(observedDate(d)));

    set.add(dateKey(nthWeekdayOfMonth(y, 0, 1, 3)));
    set.add(dateKey(nthWeekdayOfMonth(y, 1, 1, 3)));
    set.add(dateKey(lastWeekdayOfMonth(y, 4, 1)));
    set.add(dateKey(nthWeekdayOfMonth(y, 8, 1, 1)));
    set.add(dateKey(nthWeekdayOfMonth(y, 9, 1, 2)));
    set.add(dateKey(nthWeekdayOfMonth(y, 10, 4, 4)));
  }

  return set;
}

export function countAustinPaychecksInMonth(
  month: Date,
  holidaySet: Set<string>
) {
  const start = monthStart(month);
  const end = monthEndExclusive(month);

  let count = 0;

  const firstDay = new Date(start);
  const startWd = firstDay.getDay();
  const thursday = 4;
  const offset = (thursday - startWd + 7) % 7;
  let pay = addDays(firstDay, offset);

  while (pay < end) {
    const adjusted = holidaySet.has(dateKey(pay))
      ? prevBusinessDay(pay, holidaySet)
      : pay;
    if (adjusted >= start && adjusted < end) count += 1;
    pay = addDays(pay, 7);
  }

  return count;
}

export function countJennaPaychecksInMonth(
  month: Date,
  holidaySet: Set<string>,
  firstPayDate: Date
) {
  const start = monthStart(month);
  const end = monthEndExclusive(month);

  let count = 0;
  let pay = new Date(firstPayDate);

  while (pay < end) {
    const adjusted = holidaySet.has(dateKey(pay))
      ? prevBusinessDay(pay, holidaySet)
      : pay;
    if (adjusted >= start && adjusted < end) count += 1;
    pay = addDays(pay, 14);
  }

  return count;
}
