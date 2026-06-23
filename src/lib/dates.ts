import type { ViewMode } from "../types";

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

export function getRangeForView(date: Date, mode: ViewMode) {
  if (mode === "day") {
    return {
      start: startOfDay(date).getTime(),
      end: endOfDay(date).getTime(),
    };
  }

  if (mode === "week") {
    return {
      start: startOfWeek(date).getTime(),
      end: endOfWeek(date).getTime(),
    };
  }

  if (mode === "month") {
    return {
      start: startOfMonth(date).getTime(),
      end: endOfMonth(date).getTime(),
    };
  }

  return {
    start: startOfYear(date).getTime(),
    end: endOfYear(date).getTime(),
  };
}

export function moveDate(
  date: Date,
  mode: ViewMode,
  direction: "prev" | "next",
): Date {
  const result = new Date(date);
  const amount = direction === "next" ? 1 : -1;

  if (mode === "day") result.setDate(result.getDate() + amount);
  if (mode === "week") result.setDate(result.getDate() + amount * 7);
  if (mode === "month") result.setMonth(result.getMonth() + amount);
  if (mode === "year") result.setFullYear(result.getFullYear() + amount);

  return result;
}

export function formatViewTitle(date: Date, mode: ViewMode): string {
  const formatter = new Intl.DateTimeFormat(undefined, {
    weekday: mode === "day" ? "long" : undefined,
    year: "numeric",
    month: "long",
    day: mode === "day" ? "numeric" : undefined,
  });

  if (mode === "day") return formatter.format(date);

  if (mode === "week") {
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

  if (mode === "month") {
    return date.toLocaleDateString(undefined, {
      month: "long",
      year: "numeric",
    });
  }

  return String(date.getFullYear());
}

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
