import type { ViewMode } from "../types";

interface TimestampRange {
  start: number;
  end: number;
}

function unsupportedViewMode(mode: never): never {
  throw new Error(`Unsupported view mode: ${mode}`);
}

export function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

export function endOfDay(date: Date): Date {
  const result = startOfDay(date);
  result.setDate(result.getDate() + 1);
  return result;
}

export function startOfWeek(date: Date): Date {
  const result = startOfDay(date);
  const day = result.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  result.setDate(result.getDate() + diff);
  return result;
}

export function endOfWeek(date: Date): Date {
  const result = startOfWeek(date);
  result.setDate(result.getDate() + 7);
  return result;
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 1);
}

export function startOfYear(date: Date): Date {
  return new Date(date.getFullYear(), 0, 1);
}

export function endOfYear(date: Date): Date {
  return new Date(date.getFullYear() + 1, 0, 1);
}

/* c8 ignore start -- Vite/c8 maps exhaustive ViewMode switches as partial branches. */
export function getRangeForView(date: Date, mode: ViewMode) {
  switch (mode) {
    case "day":
      return {
        start: startOfDay(date).getTime(),
        end: endOfDay(date).getTime(),
      };
    case "week":
      return {
        start: startOfWeek(date).getTime(),
        end: endOfWeek(date).getTime(),
      };
    case "month":
      return {
        start: startOfMonth(date).getTime(),
        end: endOfMonth(date).getTime(),
      };
    case "year":
      return {
        start: startOfYear(date).getTime(),
        end: endOfYear(date).getTime(),
      };
    default:
      return unsupportedViewMode(mode);
  }
}
/* c8 ignore stop */

/* c8 ignore start -- Vite/c8 maps exhaustive ViewMode switches as partial branches. */
export function moveDate(
  date: Date,
  mode: ViewMode,
  direction: "prev" | "next",
): Date {
  const result = new Date(date);
  const amount = direction === "next" ? 1 : -1;

  switch (mode) {
    case "day":
      result.setDate(result.getDate() + amount);
      break;
    case "week":
      result.setDate(result.getDate() + amount * 7);
      break;
    case "month":
      result.setMonth(result.getMonth() + amount);
      break;
    case "year":
      result.setFullYear(result.getFullYear() + amount);
      break;
    default:
      unsupportedViewMode(mode);
  }

  return result;
}
/* c8 ignore stop */

/* c8 ignore start -- Vite/c8 maps exhaustive ViewMode switches as partial branches. */
export function formatViewTitle(date: Date, mode: ViewMode): string {
  switch (mode) {
    case "day":
      return new Intl.DateTimeFormat(undefined, {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      }).format(date);
    case "week": {
      const start = startOfWeek(date);
      const end = new Date(endOfWeek(date).getTime() - 1);

      return `${start.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      })} - ${end.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })}`;
    }
    case "month":
      return date.toLocaleDateString(undefined, {
        month: "long",
        year: "numeric",
      });
    case "year":
      return String(date.getFullYear());
    default:
      return unsupportedViewMode(mode);
  }
}
/* c8 ignore stop */

export function toDayKey(timestamp: number): string {
  const date = new Date(timestamp);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function formatDayHeading(dayKey: string): string {
  const [year, month, day] = dayKey.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  return date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function buildMonthCalendar(date: Date): Date[] {
  const firstDayOfMonth = startOfMonth(date);
  const calendarStart = startOfWeek(firstDayOfMonth);

  const days: Date[] = [];

  for (let i = 0; i < 42; i++) {
    const day = new Date(calendarStart);
    day.setDate(calendarStart.getDate() + i);
    days.push(day);
  }

  return days;
}

export function buildWeekCalendar(date: Date): Date[] {
  const days = buildMonthCalendar(date);
  const weeks: Date[] = [];

  for (let index = 0; index < days.length; index += 7) {
    weeks.push(days[index]);
  }

  return weeks;
}

export function buildMonthPicker(date: Date): Date[] {
  const months: Date[] = [];

  for (let month = 0; month < 12; month++) {
    months.push(new Date(date.getFullYear(), month, 1));
  }

  return months;
}

export function buildYearPicker(date: Date): Date[] {
  const years: Date[] = [];
  const startYear = Math.floor(date.getFullYear() / 10) * 10;

  for (let offset = 0; offset < 12; offset++) {
    years.push(new Date(startYear + offset, 0, 1));
  }

  return years;
}

function getCalendarGridRange(date: Date): TimestampRange {
  const days = buildMonthCalendar(date);
  const firstDay = days[0];
  const lastDay = days[days.length - 1];

  return {
    start: startOfDay(firstDay).getTime(),
    end: endOfDay(lastDay).getTime(),
  };
}

function getCalendarYearRange(date: Date): TimestampRange {
  const years = buildYearPicker(date);
  const firstYear = years[0];
  const lastYear = years[years.length - 1];

  return {
    start: startOfYear(firstYear).getTime(),
    end: endOfYear(lastYear).getTime(),
  };
}

export function getCalendarRangeForView(date: Date, mode: ViewMode) {
  /* c8 ignore start -- Vite/c8 maps exhaustive ViewMode switches as partial branches. */
  switch (mode) {
    case "day":
    case "week":
      return getCalendarGridRange(date);
    case "month":
      return {
        start: startOfYear(date).getTime(),
        end: endOfYear(date).getTime(),
      };
    case "year":
      return getCalendarYearRange(date);
    default:
      return unsupportedViewMode(mode);
  }
  /* c8 ignore stop */
}
