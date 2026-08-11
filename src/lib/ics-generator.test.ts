import assert from "node:assert/strict";
import test from "node:test";

import type { SelectedCourse } from "@/types/course";

import { generateICS } from "./ics-generator";

const unicodeTitle =
  "Kỹ thuật xử lý dữ liệu tiếng Việt nâng cao cho sinh viên quốc tế 🚀 và ứng dụng thực tiễn";

const course: SelectedCourse = {
  Course: "COMP1010",
  "Course Title": unicodeTitle,
  Section: "COMP1010-01",
  Dates: "2/9/2026 to 6/5/2026",
  Credits: "3.00",
  Instructor: "Nguyễn Văn An",
  "Delivery Method": "Classroom",
  Schedule: [{ day: "Monday", time: "9:00AM to 10:15AM" }],
  id: "COMP1010-01",
  hasConflict: false,
  conflictsWith: [],
};

test("generateICS folds Unicode content lines at 75 UTF-8 octets", () => {
  const ics = generateICS([course]);
  const physicalLines = ics.split("\r\n");
  const encoder = new TextEncoder();

  for (const line of physicalLines) {
    assert.ok(
      encoder.encode(line).length <= 75,
      `Physical line exceeds 75 octets: ${line}`
    );
  }

  const summaryIndex = physicalLines.findIndex((line) =>
    line.startsWith("SUMMARY:")
  );
  assert.notEqual(summaryIndex, -1);
  assert.ok(physicalLines[summaryIndex + 1].startsWith(" "));

  const unfolded = ics.replace(/\r\n[ \t]/g, "");
  assert.ok(unfolded.includes(`SUMMARY:${unicodeTitle}\r\n`));
});

test("generateICS emits DTSTAMP as the current UTC date-time", () => {
  const beforeGeneration = Date.now();
  const ics = generateICS([course]);
  const afterGeneration = Date.now();
  const match = ics.match(/DTSTAMP:(\d{8}T\d{6}Z)\r\n/);

  assert.ok(match);

  const value = match[1];
  const timestamp = Date.parse(
    `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}` +
      `T${value.slice(9, 11)}:${value.slice(11, 13)}:${value.slice(13, 15)}Z`
  );

  assert.ok(timestamp >= beforeGeneration - 1000);
  assert.ok(timestamp <= afterGeneration);
});

test("generateICS terminates the calendar with a single CRLF", () => {
  const ics = generateICS([course]);

  assert.ok(ics.endsWith("END:VCALENDAR\r\n"));
  assert.ok(!ics.endsWith("\r\n\r\n"));
});
