import assert from "node:assert/strict";
import test from "node:test";

import type { Course, DayOfWeek } from "@/types/course";
import { DAYS_OF_WEEK } from "@/types/course";

import { getVisibleCalendarDays } from "./schedule-utils";

const weekdays = DAYS_OF_WEEK.slice(0, 5);

function createCourse(days: DayOfWeek[]): Course {
  return {
    Course: "TEST1010",
    "Course Title": "Test Course",
    Section: "TEST1010-01",
    Dates: "2/9/2026 to 6/5/2026",
    Credits: "3.00",
    Instructor: "Test Instructor",
    "Delivery Method": "Classroom",
    Schedule: days.map((day) => ({
      day,
      time: "9:00AM to 10:15AM",
    })),
  };
}

test("getVisibleCalendarDays defaults to weekdays with no courses", () => {
  assert.deepEqual(getVisibleCalendarDays([]), weekdays);
});

test("getVisibleCalendarDays keeps weekday-only courses on weekdays", () => {
  assert.deepEqual(
    getVisibleCalendarDays([createCourse(["Monday", "Friday"])]),
    weekdays
  );
});

test("getVisibleCalendarDays includes both weekend days for Saturday courses", () => {
  assert.deepEqual(
    getVisibleCalendarDays([createCourse(["Saturday"])]),
    DAYS_OF_WEEK
  );
});

test("getVisibleCalendarDays includes both weekend days for Sunday courses", () => {
  assert.deepEqual(
    getVisibleCalendarDays([createCourse(["Sunday"])]),
    DAYS_OF_WEEK
  );
});

test("getVisibleCalendarDays preserves canonical order for mixed schedules", () => {
  assert.deepEqual(
    getVisibleCalendarDays([
      createCourse(["Wednesday"]),
      createCourse(["Sunday", "Monday"]),
    ]),
    [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ]
  );
});
