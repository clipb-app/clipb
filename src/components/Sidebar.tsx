import { Search } from "lucide-react";
import type { DailyCount, ViewMode } from "../types";
import {
  buildMonthCalendar,
  buildMonthPicker,
  buildWeekCalendar,
  buildYearPicker,
  endOfWeek,
  toDayKey,
} from "../lib/dates";

interface SidebarProps {
  selectedDate: Date;
  viewMode: ViewMode;
  query: string;
  dailyCounts: DailyCount[];
  onSelectDate: (date: Date) => void;
  onViewModeChange: (mode: ViewMode) => void;
  onQueryChange: (query: string) => void;
}

const viewModes: ViewMode[] = ["day", "week", "month", "year"];

function formatClipCount(count: number): string {
  if (count < 1000) return String(count);

  if (count < 1_000_000) {
    const value = count / 1000;
    return `${Number.isInteger(value) ? value : value.toFixed(1)}k`;
  }

  const value = count / 1_000_000;
  return `${Number.isInteger(value) ? value : value.toFixed(1)}m`;
}

function formatFullClipCount(count: number): string {
  return new Intl.NumberFormat().format(count);
}

function formatCalendarCount(count: number): string {
  return count === 1 ? "1 clip" : `${formatFullClipCount(count)} clips`;
}

function formatMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    "0",
  )}`;
}

export function Sidebar({
  selectedDate,
  viewMode,
  query,
  dailyCounts,
  onSelectDate,
  onViewModeChange,
  onQueryChange,
}: SidebarProps) {
  const days = buildMonthCalendar(selectedDate);
  const weeks = buildWeekCalendar(selectedDate);
  const months = buildMonthPicker(selectedDate);
  const years = buildYearPicker(selectedDate);

  const countMap = new Map(dailyCounts.map((item) => [item.day, item.count]));

  const selectedDayKey = toDayKey(selectedDate.getTime());
  const currentMonth = selectedDate.getMonth();
  const selectedWeekStart = toDayKey(
    weeks
      .find((week) => {
        const weekEnd = endOfWeek(week);

        return selectedDate >= week && selectedDate < weekEnd;
      })
      ?.getTime() ?? selectedDate.getTime(),
  );

  function getDayCount(date: Date): number {
    return countMap.get(toDayKey(date.getTime())) ?? 0;
  }

  function getCountByPrefix(prefix: string): number {
    return dailyCounts.reduce((total, item) => {
      return item.day.startsWith(prefix) ? total + item.count : total;
    }, 0);
  }

  function getWeekCount(startDate: Date): number {
    let total = 0;

    for (let offset = 0; offset < 7; offset++) {
      const day = new Date(startDate);
      day.setDate(startDate.getDate() + offset);
      total += getDayCount(day);
    }

    return total;
  }

  function renderDayCalendar() {
    return (
      <>
        <div className="mini-calendar__weekdays">
          <span>Mon</span>
          <span>Tue</span>
          <span>Wed</span>
          <span>Thu</span>
          <span>Fri</span>
          <span>Sat</span>
          <span>Sun</span>
        </div>

        <div className="mini-calendar__grid">
          {days.map((day) => {
            const dayKey = toDayKey(day.getTime());
            const count = getDayCount(day);
            const formattedCount = formatClipCount(count);
            const fullCount = formatFullClipCount(count);

            const isSelected = dayKey === selectedDayKey;
            const isMuted = day.getMonth() !== currentMonth;

            const dateLabel = day.toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
              year: "numeric",
            });

            return (
              <button
                key={dayKey}
                className={[
                  "calendar-day",
                  isSelected ? "selected" : "",
                  isMuted ? "muted" : "",
                  count > 0 ? "has-clips" : "",
                ].join(" ")}
                onClick={() => onSelectDate(day)}
                title={
                  count > 0
                    ? `${dateLabel} - ${fullCount} clips`
                    : `${dateLabel} - no clips`
                }
                aria-label={
                  count > 0
                    ? `Select ${dateLabel}, ${fullCount} clips`
                    : `Select ${dateLabel}, no clips`
                }
              >
                <span>{day.getDate()}</span>
                {count > 0 ? <small>{formattedCount}</small> : null}
              </button>
            );
          })}
        </div>
      </>
    );
  }

  function renderWeekCalendar() {
    return (
      <div className="mini-calendar__weeks">
        {weeks.map((week) => {
          const weekKey = toDayKey(week.getTime());
          const weekEnd = new Date(endOfWeek(week).getTime() - 1);
          const count = getWeekCount(week);
          const isSelected = weekKey === selectedWeekStart;
          const label = `${week.toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          })} - ${weekEnd.toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          })}`;

          return (
            <button
              key={weekKey}
              className={[
                "calendar-period",
                "calendar-week",
                isSelected ? "selected" : "",
                count > 0 ? "has-clips" : "",
              ].join(" ")}
              onClick={() => onSelectDate(week)}
              title={`Select ${label}, ${formatCalendarCount(count)}`}
              aria-label={`Select week ${label}, ${formatCalendarCount(
                count,
              )}`}
            >
              <span>{label}</span>
              <small>{count > 0 ? formatClipCount(count) : "0"}</small>
            </button>
          );
        })}
      </div>
    );
  }

  function renderMonthCalendar() {
    return (
      <div className="mini-calendar__grid mini-calendar__grid--periods">
        {months.map((month) => {
          const count = getCountByPrefix(formatMonthKey(month));
          const isSelected =
            month.getMonth() === selectedDate.getMonth() &&
            month.getFullYear() === selectedDate.getFullYear();
          const label = month.toLocaleDateString(undefined, {
            month: "long",
            year: "numeric",
          });

          return (
            <button
              key={formatMonthKey(month)}
              className={[
                "calendar-period",
                isSelected ? "selected" : "",
                count > 0 ? "has-clips" : "",
              ].join(" ")}
              onClick={() => onSelectDate(month)}
              title={`Select ${label}, ${formatCalendarCount(count)}`}
              aria-label={`Select ${label}, ${formatCalendarCount(count)}`}
            >
              <span>
                {month.toLocaleDateString(undefined, { month: "short" })}
              </span>
              <small>{count > 0 ? formatClipCount(count) : "0"}</small>
            </button>
          );
        })}
      </div>
    );
  }

  function renderYearCalendar() {
    return (
      <div className="mini-calendar__grid mini-calendar__grid--periods">
        {years.map((yearDate) => {
          const year = yearDate.getFullYear();
          const count = getCountByPrefix(`${year}-`);
          const isSelected = year === selectedDate.getFullYear();

          return (
            <button
              key={year}
              className={[
                "calendar-period",
                isSelected ? "selected" : "",
                count > 0 ? "has-clips" : "",
              ].join(" ")}
              onClick={() => onSelectDate(yearDate)}
              title={`Select ${year}, ${formatCalendarCount(count)}`}
              aria-label={`Select ${year}, ${formatCalendarCount(count)}`}
            >
              <span>{year}</span>
              <small>{count > 0 ? formatClipCount(count) : "0"}</small>
            </button>
          );
        })}
      </div>
    );
  }

  const calendarTitle =
    viewMode === "year"
      ? `${years[0].getFullYear()} - ${years[years.length - 1].getFullYear()}`
      : selectedDate.toLocaleDateString(undefined, {
          month: viewMode === "month" ? undefined : "long",
          year: "numeric",
        });

  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand__icon" aria-hidden="true" />

        <div>
          <h1>ClipB</h1>
          <p>Clipboard timeline</p>
        </div>
      </div>

      <label className="search-box">
        <Search size={16} />
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search clips..."
          title="Search clips"
          aria-label="Search clips"
        />
      </label>

      <div className="view-switcher">
        {viewModes.map((mode) => (
          <button
            key={mode}
            className={mode === viewMode ? "active" : ""}
            onClick={() => onViewModeChange(mode)}
            title={`Switch to ${mode} view`}
            aria-label={`Switch to ${mode} view`}
          >
            {mode}
          </button>
        ))}
      </div>

      <section className="mini-calendar">
        <div className="mini-calendar__header">
          <strong>{calendarTitle}</strong>
        </div>

        {viewMode === "day" ? renderDayCalendar() : null}
        {viewMode === "week" ? renderWeekCalendar() : null}
        {viewMode === "month" ? renderMonthCalendar() : null}
        {viewMode === "year" ? renderYearCalendar() : null}
      </section>
    </aside>
  );
}
