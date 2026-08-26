import assert from "node:assert/strict";
import test from "node:test";

import { Course, DayOfWeek } from "@/types/course";
import {
  autoFitSchedule,
  getAutoFitCourseKey,
} from "./auto-fit-algorithm";
import { coursesConflict } from "./schedule-utils";

interface CourseOptions {
  code: string;
  title?: string;
  section?: string;
  day?: DayOfWeek;
  time?: string;
  credits?: string;
  dates?: string;
}

function createCourse({
  code,
  title = code,
  section = `${code}-01`,
  day = "Monday",
  time = "9:00AM to 10:00AM",
  credits = "3.00",
  dates = "9/1/2026 to 12/1/2026",
}: CourseOptions): Course {
  return {
    Course: code,
    "Course Title": title,
    Section: section,
    Dates: dates,
    Credits: credits,
    Instructor: "Test Instructor",
    "Delivery Method": "Classroom",
    Schedule: [{ day, time }],
  };
}

function solve(
  courses: Course[],
  mandatory: Course[],
  optional: Course[],
  overrides: Partial<Parameters<typeof autoFitSchedule>[0]> = {},
) {
  return autoFitSchedule({
    allCourses: courses,
    mandatoryCourseKeys: mandatory.map(getAutoFitCourseKey),
    optionalCourseKeys: optional.map(getAutoFitCourseKey),
    maxCredits: 18,
    numCombinations: 10,
    ...overrides,
  });
}

test("groups identical titles with different course codes independently", () => {
  const undergraduate = createCourse({
    code: "COMP3040",
    title: "Computer Vision",
    day: "Monday",
  });
  const graduate = createCourse({
    code: "COMP5030",
    title: "Computer Vision",
    day: "Tuesday",
  });

  const result = solve(
    [undergraduate, graduate],
    [undergraduate, graduate],
    [],
  );

  assert.equal(result.status, "optimal");
  assert.deepEqual(
    result.combinations[0].map((course) => course.Course).sort(),
    ["COMP3040", "COMP5030"],
  );
});

test("chooses exactly one section for each mandatory identity", () => {
  const first = createCourse({ code: "MATH1000", section: "MATH-A" });
  const second = createCourse({
    code: "MATH1000",
    section: "MATH-B",
    day: "Tuesday",
  });

  const result = solve([first, second], [first], []);

  assert.ok(result.combinations.length > 0);
  assert.ok(result.combinations.every((combination) => combination.length === 1));
});

test("treats overlapping weekly meetings as conflicts regardless of Dates", () => {
  const first = createCourse({
    code: "FIRST",
    dates: "1/1/2026 to 2/1/2026",
  });
  const second = createCourse({
    code: "SECOND",
    dates: "10/1/2026 to 11/1/2026",
  });

  assert.equal(coursesConflict(first, second), true);
  assert.equal(solve([first, second], [first, second], []).status, "infeasible");
});

test("allows adjacent weekly time ranges", () => {
  const first = createCourse({ code: "FIRST", time: "9:00AM to 10:00AM" });
  const second = createCourse({
    code: "SECOND",
    time: "10:00AM to 11:00AM",
  });

  const result = solve([first, second], [first, second], []);
  assert.equal(result.status, "optimal");
  assert.equal(result.combinations[0].length, 2);
});

test("explores mandatory section choices to maximize optional courses", () => {
  const mandatoryBlocked = createCourse({
    code: "MAND",
    section: "MAND-A",
    day: "Monday",
  });
  const mandatoryOpen = createCourse({
    code: "MAND",
    section: "MAND-B",
    day: "Friday",
  });
  const optionalOne = createCourse({ code: "OPT1", day: "Monday" });
  const optionalTwo = createCourse({ code: "OPT2", day: "Tuesday" });

  const result = solve(
    [mandatoryBlocked, mandatoryOpen, optionalOne, optionalTwo],
    [mandatoryBlocked],
    [optionalOne, optionalTwo],
  );

  assert.equal(result.bestOptionalCount, 2);
  assert.ok(
    result.combinations.every((combination) =>
      combination.some((course) => course.Section === "MAND-B"),
    ),
  );
});

test("avoids the greedy trap where one optional blocks two compatible options", () => {
  const blocking = createCourse({
    code: "BLOCK",
    time: "9:00AM to 11:00AM",
  });
  const early = createCourse({ code: "EARLY", time: "9:00AM to 10:00AM" });
  const late = createCourse({ code: "LATE", time: "10:00AM to 11:00AM" });

  const result = solve(
    [blocking, early, late],
    [],
    [blocking, early, late],
  );

  assert.equal(result.bestOptionalCount, 2);
  assert.deepEqual(
    result.combinations[0].map((course) => course.Course).sort(),
    ["EARLY", "LATE"],
  );
});

test("maximizes optional count rather than credits", () => {
  const highCredit = createCourse({
    code: "HIGH",
    credits: "6.00",
    day: "Monday",
  });
  const lowOne = createCourse({ code: "LOW1", day: "Tuesday" });
  const lowTwo = createCourse({ code: "LOW2", day: "Wednesday" });

  const result = solve(
    [highCredit, lowOne, lowTwo],
    [],
    [highCredit, lowOne, lowTwo],
    { maxCredits: 6 },
  );

  assert.equal(result.bestOptionalCount, 2);
  assert.deepEqual(
    result.combinations[0].map((course) => course.Course).sort(),
    ["LOW1", "LOW2"],
  );
});

test("enforces the credit cap and excludes zero-credit sections", () => {
  const required = createCourse({ code: "REQ", credits: "4.00" });
  const tooMuch = createCourse({
    code: "TOO",
    credits: "3.00",
    day: "Tuesday",
  });
  const zero = createCourse({
    code: "ZERO",
    credits: "0.00",
    day: "Wednesday",
  });

  const result = solve(
    [required, tooMuch, zero],
    [required],
    [tooMuch, zero],
    { maxCredits: 6 },
  );
  assert.equal(result.bestOptionalCount, 0);
  assert.deepEqual(result.combinations[0].map((course) => course.Course), ["REQ"]);

  const zeroMandatory = solve([zero], [zero], []);
  assert.equal(zeroMandatory.status, "infeasible");
});

test("forward checking rejects assignments that empty a mandatory domain", () => {
  const firstOpen = createCourse({ code: "FIRST", section: "FIRST-A" });
  const firstBlocked = createCourse({
    code: "FIRST",
    section: "FIRST-B",
    day: "Tuesday",
  });
  const second = createCourse({ code: "SECOND", day: "Tuesday" });

  const result = solve(
    [firstOpen, firstBlocked, second],
    [firstOpen, second],
    [],
  );
  assert.equal(result.status, "optimal");
  assert.ok(
    result.combinations.every((combination) =>
      combination.some((course) => course.Section === "FIRST-A"),
    ),
  );
});

test("returns infeasible only after exhaustive failure", () => {
  const first = createCourse({ code: "FIRST" });
  const second = createCourse({ code: "SECOND" });

  const exhaustive = solve([first, second], [first, second], []);
  assert.equal(exhaustive.status, "infeasible");

  const interrupted = solve([first], [first], [], {
    maxSearchNodes: 1,
  });
  assert.equal(interrupted.status, "limit-reached");
  assert.equal(interrupted.bestOptionalCount, null);
});

test("returns applicable best-so-far schedules when the node cap is reached", () => {
  const firstA = createCourse({ code: "FIRST", section: "FIRST-A" });
  const firstB = createCourse({
    code: "FIRST",
    section: "FIRST-B",
    day: "Tuesday",
  });
  const second = createCourse({ code: "SECOND", day: "Wednesday" });

  let limited = solve(
    [firstA, firstB, second],
    [],
    [firstA, second],
    { maxSearchNodes: 1 },
  );
  for (let cap = 2; cap < 20 && limited.combinations.length === 0; cap++) {
    limited = solve(
      [firstA, firstB, second],
      [],
      [firstA, second],
      { maxSearchNodes: cap },
    );
  }

  assert.equal(limited.status, "limit-reached");
  assert.ok(limited.combinations.length > 0);
  assert.ok(
    limited.combinations.every((combination) =>
      combination.every(
        (course, index) =>
          !combination
            .slice(index + 1)
            .some((other) => coursesConflict(course, other)),
      ),
    ),
  );
});

test("returns only unique optimal combinations and respects the result count", () => {
  const firstA = createCourse({ code: "FIRST", section: "FIRST-A" });
  const firstB = createCourse({
    code: "FIRST",
    section: "FIRST-B",
    day: "Tuesday",
  });
  const secondA = createCourse({
    code: "SECOND",
    section: "SECOND-A",
    day: "Wednesday",
  });
  const secondB = createCourse({
    code: "SECOND",
    section: "SECOND-B",
    day: "Thursday",
  });

  const result = solve(
    [firstA, firstB, secondA, secondB],
    [],
    [firstA, secondA],
    { numCombinations: 3 },
  );

  assert.equal(result.status, "optimal");
  assert.equal(result.bestOptionalCount, 2);
  assert.equal(result.combinations.length, 3);
  assert.ok(result.combinations.every((combination) => combination.length === 2));
  assert.equal(
    new Set(
      result.combinations.map((combination) =>
        combination.map((course) => course.Section).sort().join("|"),
      ),
    ).size,
    3,
  );
});

test("produces identical ordered output across repeated runs", () => {
  const courses = [
    createCourse({ code: "FIRST", section: "FIRST-A" }),
    createCourse({ code: "FIRST", section: "FIRST-B", day: "Tuesday" }),
    createCourse({ code: "SECOND", day: "Wednesday" }),
  ];
  const input = {
    allCourses: courses,
    mandatoryCourseKeys: [],
    optionalCourseKeys: [
      getAutoFitCourseKey(courses[0]),
      getAutoFitCourseKey(courses[2]),
    ],
    maxCredits: 18,
    numCombinations: 5,
  };

  assert.deepEqual(autoFitSchedule(input), autoFitSchedule(input));
});

test("handles mandatory-only and optional-only requests", () => {
  const mandatory = createCourse({ code: "MAND" });
  const optional = createCourse({ code: "OPT", day: "Tuesday" });

  assert.equal(solve([mandatory], [mandatory], []).bestOptionalCount, 0);
  assert.equal(solve([optional], [], [optional]).bestOptionalCount, 1);
});

test("reports when no optional course fits without returning an empty schedule", () => {
  const optional = createCourse({ code: "OPT", credits: "3.00" });
  const result = solve([optional], [], [optional], { maxCredits: 1 });

  assert.equal(result.status, "optimal");
  assert.equal(result.bestOptionalCount, 0);
  assert.deepEqual(result.combinations, []);
  assert.match(result.message ?? "", /No requested optional course/);
});

test("normalizes duplicate keys, list overlap, result count, and invalid credits", () => {
  const course = createCourse({ code: "COURSE" });
  const key = getAutoFitCourseKey(course);
  const result = autoFitSchedule({
    allCourses: [course],
    mandatoryCourseKeys: [key, key],
    optionalCourseKeys: [key, key],
    maxCredits: 3,
    numCombinations: 500,
  });

  assert.equal(result.status, "optimal");
  assert.equal(result.bestOptionalCount, 0);
  assert.equal(result.combinations[0].length, 1);

  const invalid = autoFitSchedule({
    allCourses: [course],
    mandatoryCourseKeys: [key],
    optionalCourseKeys: [],
    maxCredits: Number.NaN,
  });
  assert.equal(invalid.status, "infeasible");
});
