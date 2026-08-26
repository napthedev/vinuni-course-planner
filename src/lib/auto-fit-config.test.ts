import assert from "node:assert/strict";
import test from "node:test";

import { Course } from "@/types/course";
import { getAutoFitCourseKey } from "./auto-fit-algorithm";
import { normalizeAutoFitConfig } from "./auto-fit-config";

function createCourse(
  code: string,
  title: string,
  credits = "3.00",
): Course {
  return {
    Course: code,
    "Course Title": title,
    Section: `${code}-01`,
    Dates: "9/1/2026 to 12/1/2026",
    Credits: credits,
    Instructor: "Test Instructor",
    "Delivery Method": "Classroom",
    Schedule: [{ day: "Monday", time: "9:00AM to 10:00AM" }],
  };
}

test("loads and validates a version-two configuration", () => {
  const course = createCourse("COMP1000", "Computing");
  const key = getAutoFitCourseKey(course);
  const normalized = normalizeAutoFitConfig(
    {
      version: 2,
      mandatoryCourseKeys: [key, "Missing (NONE)"],
      optionalCourseKeys: [],
      maxCredits: 20,
      numCombinations: 8,
    },
    [course],
  );

  assert.deepEqual(normalized.config.mandatoryCourseKeys, [key]);
  assert.equal(normalized.droppedEntries, 1);
  assert.equal(normalized.migrated, false);
});

test("migrates uniquely identifiable legacy titles", () => {
  const mandatory = createCourse("COMP1000", "Computing");
  const optional = createCourse("MATH1000", "Mathematics");
  const normalized = normalizeAutoFitConfig(
    {
      mandatoryTitles: ["Computing"],
      optionalElectiveTitles: ["Mathematics"],
      maxCredits: 18,
      numCombinations: 5,
    },
    [mandatory, optional],
  );

  assert.deepEqual(normalized.config.mandatoryCourseKeys, [
    getAutoFitCourseKey(mandatory),
  ]);
  assert.deepEqual(normalized.config.optionalCourseKeys, [
    getAutoFitCourseKey(optional),
  ]);
  assert.equal(normalized.migrated, true);
});

test("drops ambiguous legacy titles and zero-credit entries", () => {
  const first = createCourse("COMP3040", "Computer Vision");
  const second = createCourse("COMP5030", "Computer Vision");
  const zero = createCourse("ZERO1000", "Zero Credit", "0.00");
  const normalized = normalizeAutoFitConfig(
    {
      mandatoryTitles: ["Computer Vision", "Zero Credit"],
      optionalElectiveTitles: [],
    },
    [first, second, zero],
  );

  assert.deepEqual(normalized.config.mandatoryCourseKeys, []);
  assert.equal(normalized.droppedEntries, 2);
});

test("keeps mandatory keys exclusive and removes duplicate entries", () => {
  const course = createCourse("COMP1000", "Computing");
  const key = getAutoFitCourseKey(course);
  const normalized = normalizeAutoFitConfig(
    {
      version: 2,
      mandatoryCourseKeys: [key, key],
      optionalCourseKeys: [key],
      maxCredits: 18,
      numCombinations: 5,
    },
    [course],
  );

  assert.deepEqual(normalized.config.mandatoryCourseKeys, [key]);
  assert.deepEqual(normalized.config.optionalCourseKeys, []);
  assert.equal(normalized.droppedEntries, 2);
});

test("clamps stored credit and combination settings", () => {
  const normalized = normalizeAutoFitConfig(
    {
      version: 2,
      mandatoryCourseKeys: [],
      optionalCourseKeys: [],
      maxCredits: 100,
      numCombinations: -4,
    },
    [],
  );

  assert.equal(normalized.config.maxCredits, 30);
  assert.equal(normalized.config.numCombinations, 1);
});
