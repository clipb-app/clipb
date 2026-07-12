import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildMonthCalendar,
  buildMonthPicker,
  buildWeekCalendar,
  buildYearPicker,
  endOfDay,
  endOfMonth,
  endOfWeek,
  endOfYear,
  formatDayHeading,
  formatTime,
  formatViewTitle,
  getCalendarRangeForView,
  getRangeForView,
  moveDate,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
  toDayKey,
} from "../src/lib/dates";
import type { ViewMode } from "../src/types";

test("date helpers create day, week, month, and year boundaries", () => {
  const date = new Date(2026, 6, 5, 14, 30, 20, 10);
  const midweekDate = new Date(2026, 6, 8, 14, 30, 20, 10);

  assert.equal(startOfDay(date).getTime(), new Date(2026, 6, 5).getTime());
  assert.equal(endOfDay(date).getTime(), new Date(2026, 6, 6).getTime());
  assert.equal(startOfWeek(date).getTime(), new Date(2026, 5, 29).getTime());
  assert.equal(
    startOfWeek(midweekDate).getTime(),
    new Date(2026, 6, 6).getTime(),
  );
  assert.equal(endOfWeek(date).getTime(), new Date(2026, 6, 6).getTime());
  assert.equal(startOfMonth(date).getTime(), new Date(2026, 6, 1).getTime());
  assert.equal(endOfMonth(date).getTime(), new Date(2026, 7, 1).getTime());
  assert.equal(startOfYear(date).getTime(), new Date(2026, 0, 1).getTime());
  assert.equal(endOfYear(date).getTime(), new Date(2027, 0, 1).getTime());
});

test("date helpers build ranges for every timeline view", () => {
  const date = new Date(2026, 6, 5, 14);

  assert.deepEqual(getRangeForView(date, "day"), {
    start: new Date(2026, 6, 5).getTime(),
    end: new Date(2026, 6, 6).getTime(),
  });
  assert.deepEqual(getRangeForView(date, "week"), {
    start: new Date(2026, 5, 29).getTime(),
    end: new Date(2026, 6, 6).getTime(),
  });
  assert.deepEqual(getRangeForView(date, "month"), {
    start: new Date(2026, 6, 1).getTime(),
    end: new Date(2026, 7, 1).getTime(),
  });
  assert.deepEqual(getRangeForView(date, "year"), {
    start: new Date(2026, 0, 1).getTime(),
    end: new Date(2027, 0, 1).getTime(),
  });
});

test("date helpers move dates by the active view size", () => {
  const date = new Date(2026, 6, 5);

  assert.equal(toDayKey(moveDate(date, "day", "prev").getTime()), "2026-07-04");
  assert.equal(toDayKey(moveDate(date, "day", "next").getTime()), "2026-07-06");
  assert.equal(toDayKey(moveDate(date, "week", "prev").getTime()), "2026-06-28");
  assert.equal(toDayKey(moveDate(date, "week", "next").getTime()), "2026-07-12");
  assert.equal(toDayKey(moveDate(date, "month", "prev").getTime()), "2026-06-05");
  assert.equal(toDayKey(moveDate(date, "month", "next").getTime()), "2026-08-05");
  assert.equal(toDayKey(moveDate(date, "year", "prev").getTime()), "2025-07-05");
  assert.equal(toDayKey(moveDate(date, "year", "next").getTime()), "2027-07-05");
});

test("date helpers format timeline titles and labels", () => {
  const date = new Date(2026, 6, 5, 9, 8);

  assert.match(formatViewTitle(date, "day"), /2026/);
  assert.match(formatViewTitle(date, "week"), /2026/);
  assert.match(formatViewTitle(date, "month"), /2026/);
  assert.equal(formatViewTitle(date, "year"), "2026");
  assert.equal(toDayKey(date.getTime()), "2026-07-05");
  assert.match(formatDayHeading("2026-07-05"), /2026/);
  assert.match(formatTime(date.getTime()), /09|9/);
});

test("date helpers build calendar picker collections", () => {
  const date = new Date(2026, 6, 5);
  const days = buildMonthCalendar(date);
  const weeks = buildWeekCalendar(date);
  const months = buildMonthPicker(date);
  const years = buildYearPicker(date);

  assert.equal(days.length, 42);
  assert.equal(toDayKey(days[0].getTime()), "2026-06-29");
  assert.equal(weeks.length, 6);
  assert.equal(toDayKey(weeks[0].getTime()), "2026-06-29");
  assert.equal(months.length, 12);
  assert.equal(toDayKey(months[0].getTime()), "2026-01-01");
  assert.equal(toDayKey(months[11].getTime()), "2026-12-01");
  assert.equal(years.length, 12);
  assert.equal(years[0].getFullYear(), 2020);
  assert.equal(years[11].getFullYear(), 2031);
});

test("date helpers build sidebar count ranges for calendar views", () => {
  const date = new Date(2026, 6, 5);

  assert.deepEqual(getCalendarRangeForView(date, "day"), {
    start: new Date(2026, 5, 29).getTime(),
    end: new Date(2026, 7, 10).getTime(),
  });
  assert.deepEqual(getCalendarRangeForView(date, "week"), {
    start: new Date(2026, 5, 29).getTime(),
    end: new Date(2026, 7, 10).getTime(),
  });
  assert.deepEqual(getCalendarRangeForView(date, "month"), {
    start: new Date(2026, 0, 1).getTime(),
    end: new Date(2027, 0, 1).getTime(),
  });
  assert.deepEqual(getCalendarRangeForView(date, "year"), {
    start: new Date(2020, 0, 1).getTime(),
    end: new Date(2032, 0, 1).getTime(),
  });
});

test("date helpers reject unsupported view modes at runtime", () => {
  const date = new Date(2026, 6, 5);
  const invalidMode = "quarter" as unknown as ViewMode;

  assert.throws(() => getRangeForView(date, invalidMode), /Unsupported/);
  assert.throws(() => moveDate(date, invalidMode, "next"), /Unsupported/);
  assert.throws(() => formatViewTitle(date, invalidMode), /Unsupported/);
  assert.throws(() => getCalendarRangeForView(date, invalidMode), /Unsupported/);
});
