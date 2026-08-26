import assert from "node:assert/strict";
import test from "node:test";

import type { Course, DayOfWeek, ParsedTimeSlot } from "@/types/course";
import { DAYS_OF_WEEK } from "@/types/course";

import {
  getCalendarBlockPosition,
  getCalendarTimeRange,
  getCourseColor,
  getVisibleCalendarDays,
} from "./schedule-utils";

const weekdays = DAYS_OF_WEEK.slice(0, 5);

function createCourse(
  days: DayOfWeek[],
  time = "9:00AM to 10:15AM"
): Course {
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
      time,
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

test("getCourseColor is stable for the same course code", () => {
  assert.equal(getCourseColor("MATH2030"), getCourseColor("MATH2030"));
});

test("getCourseColor returns palette colors for representative courses", () => {
  const mathColor = getCourseColor("MATH2030");
  const physicsColor = getCourseColor("PHYS2020");

  assert.match(mathColor, /^bg-[a-z]+-(500|600)$/);
  assert.match(physicsColor, /^bg-[a-z]+-(500|600)$/);
  assert.notEqual(mathColor, physicsColor);
});

test("getCalendarTimeRange uses configured bounds for ordinary schedules", () => {
  assert.deepEqual(getCalendarTimeRange([createCourse(["Monday"])]), {
    startHour: 7,
    endHour: 22,
  });
});

test("getCalendarTimeRange expands for early and late schedules", () => {
  assert.deepEqual(
    getCalendarTimeRange([
      createCourse(["Monday"], "6:30AM to 7:45AM"),
      createCourse(["Friday"], "9:30PM to 10:30PM"),
    ]),
    {
      startHour: 6,
      endHour: 23,
    }
  );
});

test("getCalendarBlockPosition returns percentage position and duration", () => {
  const slot: ParsedTimeSlot = {
    day: "Monday",
    startHour: 10,
    startMinute: 0,
    endHour: 11,
    endMinute: 30,
  };

  assert.deepEqual(
    getCalendarBlockPosition(slot, { startHour: 7, endHour: 22 }),
    {
      top: 20,
      height: 10,
    }
  );
});
