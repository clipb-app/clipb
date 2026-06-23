import { CalendarDays, Search } from "lucide-react";
import type { DailyCount, ViewMode } from "../types";
import { buildMonthCalendar, toDayKey } from "../lib/dates";

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

  const countMap = new Map(dailyCounts.map((item) => [item.day, item.count]));

  const selectedDayKey = toDayKey(selectedDate.getTime());
  const currentMonth = selectedDate.getMonth();

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand__icon">
          <CalendarDays size={20} />
        </div>

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
        />
      </label>

      <div className="view-switcher">
        {viewModes.map((mode) => (
          <button
            key={mode}
            className={mode === viewMode ? "active" : ""}
            onClick={() => onViewModeChange(mode)}
          >
            {mode}
          </button>
        ))}
      </div>

      <section className="mini-calendar">
        <div className="mini-calendar__header">
          <strong>
            {selectedDate.toLocaleDateString(undefined, {
              month: "long",
              year: "numeric",
            })}
          </strong>
        </div>

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
            const count = countMap.get(dayKey) ?? 0;
            const isSelected = dayKey === selectedDayKey;
            const isMuted = day.getMonth() !== currentMonth;

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
              >
                <span>{day.getDate()}</span>
                {count > 0 ? <small>{count}</small> : null}
              </button>
            );
          })}
        </div>
      </section>
    </aside>
  );
}
