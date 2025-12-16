import { SelectedCourse, DayOfWeek } from "@/types/course";
import { parseTimeString } from "./schedule-utils";

/**
 * Map day names to their iCalendar weekday codes
 */
const DAY_TO_RRULE: Record<DayOfWeek, string> = {
  Monday: "MO",
  Tuesday: "TU",
  Wednesday: "WE",
  Thursday: "TH",
  Friday: "FR",
  Saturday: "SA",
  Sunday: "SU",
};

/**
 * Map day names to their weekday offset (0 = Sunday, 1 = Monday, etc.)
 */
const DAY_TO_WEEKDAY: Record<DayOfWeek, number> = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

/**
 * Parse date string like "2/9/2026 to 6/5/2026" to get start and end dates
 */
function parseDateRange(dateStr: string): { start: Date; end: Date } | null {
  const match = dateStr.match(
    /(\d{1,2})\/(\d{1,2})\/(\d{4})\s*to\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/i
  );
  if (!match) return null;

  const [, startMonth, startDay, startYear, endMonth, endDay, endYear] = match;

  return {
    start: new Date(
      parseInt(startYear),
      parseInt(startMonth) - 1,
      parseInt(startDay)
    ),
    end: new Date(parseInt(endYear), parseInt(endMonth) - 1, parseInt(endDay)),
  };
}

/**
 * Format a Date object to iCalendar date-time format (local time)
 * e.g., "20260209T090000"
 */
function formatICSDateTime(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${year}${month}${day}T${hours}${minutes}${seconds}`;
}

/**
 * Format a Date object to iCalendar date format (for UNTIL)
 * e.g., "20260605T235959Z" (UTC)
 */
function formatICSDateUTC(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}T235959Z`;
}

/**
 * Find the first occurrence of a weekday on or after a given date
 */
function findNextWeekday(startDate: Date, targetWeekday: number): Date {
  const result = new Date(startDate);
  const currentWeekday = result.getDay();
  let daysToAdd = targetWeekday - currentWeekday;
  if (daysToAdd < 0) daysToAdd += 7;
  result.setDate(result.getDate() + daysToAdd);
  return result;
}

/**
 * Generate a unique identifier for an event
 */
function generateUID(
  course: SelectedCourse,
  day: string,
  time: string
): string {
  const sanitized = `${course.Section}-${day}-${time}`.replace(
    /[^a-zA-Z0-9-]/g,
    ""
  );
  return `${sanitized}@vinuni-course-planner`;
}

/**
 * Escape special characters in ICS text fields
 */
function escapeICSText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

/**
 * Fold long lines according to RFC 5545 (max 75 octets per line)
 */
function foldLine(line: string): string {
  const maxLength = 75;
  if (line.length <= maxLength) return line;

  const result: string[] = [];
  let remaining = line;

  while (remaining.length > maxLength) {
    result.push(remaining.substring(0, maxLength));
    remaining = " " + remaining.substring(maxLength);
  }
  result.push(remaining);

  return result.join("\r\n");
}

/**
 * Generate ICS content for selected courses
 */
export function generateICS(courses: SelectedCourse[]): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//VinUni Course Planner//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:VinUni Course Schedule",
    "X-WR-TIMEZONE:Asia/Ho_Chi_Minh",
    // Timezone definition for Asia/Ho_Chi_Minh (UTC+7, no DST)
    "BEGIN:VTIMEZONE",
    "TZID:Asia/Ho_Chi_Minh",
    "BEGIN:STANDARD",
    "DTSTART:19700101T000000",
    "TZOFFSETFROM:+0700",
    "TZOFFSETTO:+0700",
    "TZNAME:ICT",
    "END:STANDARD",
    "END:VTIMEZONE",
  ];

  for (const course of courses) {
    const dateRange = parseDateRange(course.Dates);
    if (!dateRange) continue;

    for (const schedule of course.Schedule) {
      const timeInfo = parseTimeString(schedule.time);
      if (!timeInfo) continue;

      const dayCode = DAY_TO_RRULE[schedule.day as DayOfWeek];
      if (!dayCode) continue;

      // Find the first occurrence of this weekday in the semester
      const targetWeekday = DAY_TO_WEEKDAY[schedule.day as DayOfWeek];
      const firstOccurrence = findNextWeekday(dateRange.start, targetWeekday);

      // Create start and end datetime for the first occurrence
      const eventStart = new Date(firstOccurrence);
      eventStart.setHours(timeInfo.startHour, timeInfo.startMinute, 0, 0);

      const eventEnd = new Date(firstOccurrence);
      eventEnd.setHours(timeInfo.endHour, timeInfo.endMinute, 0, 0);

      const uid = generateUID(course, schedule.day, schedule.time);
      const summary = escapeICSText(course["Course Title"]);
      const description = escapeICSText(
        `Section: ${course.Section}\nInstructor: ${course.Instructor}`
      );
      const location = escapeICSText(course["Delivery Method"]);

      // Generate VEVENT
      lines.push("BEGIN:VEVENT");
      lines.push(`UID:${uid}`);
      lines.push(`DTSTAMP:${formatICSDateTime(new Date())}`);
      lines.push(
        `DTSTART;TZID=Asia/Ho_Chi_Minh:${formatICSDateTime(eventStart)}`
      );
      lines.push(`DTEND;TZID=Asia/Ho_Chi_Minh:${formatICSDateTime(eventEnd)}`);
      lines.push(
        `RRULE:FREQ=WEEKLY;BYDAY=${dayCode};UNTIL=${formatICSDateUTC(
          dateRange.end
        )}`
      );
      lines.push(`SUMMARY:${summary}`);
      lines.push(`DESCRIPTION:${description}`);
      lines.push(`LOCATION:${location}`);

      // Add 15-minute reminder (VALARM)
      lines.push("BEGIN:VALARM");
      lines.push("TRIGGER:-PT15M");
      lines.push("ACTION:DISPLAY");
      lines.push("DESCRIPTION:Class starting in 15 minutes");
      lines.push("END:VALARM");

      lines.push("END:VEVENT");
    }
  }

  lines.push("END:VCALENDAR");

  // Fold long lines and join with CRLF
  return lines.map(foldLine).join("\r\n");
}

/**
 * Download ICS content as a file
 */
export function downloadICS(
  courses: SelectedCourse[],
  filename = "vinuni-courses.ics"
): void {
  const icsContent = generateICS(courses);
  const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

/**
 * Check if courses can be exported (no conflicts)
 */
export function canExportCourses(courses: SelectedCourse[]): boolean {
  return courses.length > 0 && !courses.some((c) => c.hasConflict);
}
