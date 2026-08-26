import {
  Course,
  DAYS_OF_WEEK,
  DayOfWeek,
  ParsedTimeSlot,
  SelectedCourse,
} from "@/types/course";
import { APP_CONFIG } from "@/config";

const {
  startHour: CALENDAR_START_HOUR,
  endHour: CALENDAR_END_HOUR,
} = APP_CONFIG.calendar;

const WEEKDAY_COUNT = 5;

const COURSE_COLOR_CLASSES = [
  "bg-blue-500",
  "bg-purple-500",
  "bg-pink-500",
  "bg-indigo-500",
  "bg-cyan-500",
  "bg-teal-500",
  "bg-amber-500",
  "bg-orange-500",
  "bg-lime-500",
  "bg-emerald-500",
  "bg-rose-500",
  "bg-violet-500",
  "bg-fuchsia-500",
  "bg-sky-500",
  "bg-green-500",
  "bg-yellow-500",
  "bg-blue-600",
  "bg-purple-600",
  "bg-teal-600",
  "bg-orange-600",
  "bg-emerald-600",
  "bg-indigo-600",
  "bg-pink-600",
  "bg-cyan-600",
] as const;

export interface CalendarTimeRange {
  startHour: number;
  endHour: number;
}

export interface CalendarBlockPosition {
  top: number;
  height: number;
}

/**
 * Get the days that should be displayed in the weekly calendar.
 * Weekend columns are shown together when any selected course meets on a weekend.
 */
export function getVisibleCalendarDays(courses: Course[]): DayOfWeek[] {
  const hasWeekendCourse = courses.some((course) =>
    course.Schedule.some(
      ({ day }) => day === "Saturday" || day === "Sunday"
    )
  );

  return hasWeekendCourse
    ? [...DAYS_OF_WEEK]
    : DAYS_OF_WEEK.slice(0, WEEKDAY_COUNT);
}

/**
 * Parse time string to extract hours and minutes
 * Handles formats like "9:00AM- 12:00PM", "9:00AM to 10:15AM", "1:30PM - 3:00PM"
 */
export function parseTimeString(timeStr: string): {
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
} | null {
  // Normalize separators: replace "to", "-", "–" with a standard separator
  const normalizedTime = timeStr
    .replace(/\s*to\s*/gi, " - ")
    .replace(/\s*-\s*/g, " - ")
    .replace(/\s*–\s*/g, " - ");

  // Match pattern: "HH:MMAM/PM - HH:MMAM/PM"
  const timeRegex =
    /(\d{1,2}):(\d{2})\s*(AM|PM)\s*-\s*(\d{1,2}):(\d{2})\s*(AM|PM)/i;
  const match = normalizedTime.match(timeRegex);

  if (!match) {
    return null;
  }

  const [
    ,
    startHourStr,
    startMinStr,
    startPeriod,
    endHourStr,
    endMinStr,
    endPeriod,
  ] = match;

  let startHour = parseInt(startHourStr, 10);
  const startMinute = parseInt(startMinStr, 10);
  let endHour = parseInt(endHourStr, 10);
  const endMinute = parseInt(endMinStr, 10);

  // Convert to 24-hour format
  if (startPeriod.toUpperCase() === "PM" && startHour !== 12) {
    startHour += 12;
  } else if (startPeriod.toUpperCase() === "AM" && startHour === 12) {
    startHour = 0;
  }

  if (endPeriod.toUpperCase() === "PM" && endHour !== 12) {
    endHour += 12;
  } else if (endPeriod.toUpperCase() === "AM" && endHour === 12) {
    endHour = 0;
  }

  return { startHour, startMinute, endHour, endMinute };
}

/**
 * Parse a course schedule into time slots
 */
export function parseSchedule(course: Course): ParsedTimeSlot[] {
  const slots: ParsedTimeSlot[] = [];

  for (const schedule of course.Schedule) {
    const parsed = parseTimeString(schedule.time);
    if (parsed) {
      slots.push({
        day: schedule.day,
        ...parsed,
      });
    }
  }

  return slots;
}

/**
 * Generate a consistent Tailwind background color for a course code.
 */
export function getCourseColor(courseCode: string): string {
  let hash = 0;
  for (let index = 0; index < courseCode.length; index++) {
    hash = courseCode.charCodeAt(index) + ((hash << 5) - hash);
  }

  return COURSE_COLOR_CLASSES[Math.abs(hash) % COURSE_COLOR_CLASSES.length];
}

/**
 * Determine the displayed calendar range, expanding the configured bounds when
 * a course begins earlier or ends later.
 */
export function getCalendarTimeRange(courses: Course[]): CalendarTimeRange {
  const slots = courses.flatMap(parseSchedule);

  if (slots.length === 0) {
    return {
      startHour: CALENDAR_START_HOUR,
      endHour: CALENDAR_END_HOUR,
    };
  }

  const earliestStartHour = Math.min(...slots.map((slot) => slot.startHour));
  const latestEndHour = Math.max(
    ...slots.map((slot) =>
      slot.endMinute > 0 ? slot.endHour + 1 : slot.endHour
    )
  );

  return {
    startHour: Math.min(CALENDAR_START_HOUR, earliestStartHour),
    endHour: Math.max(CALENDAR_END_HOUR, latestEndHour),
  };
}

/**
 * Calculate a slot's percentage-based position inside a calendar range.
 */
export function getCalendarBlockPosition(
  slot: ParsedTimeSlot,
  range: CalendarTimeRange
): CalendarBlockPosition {
  const totalMinutes = (range.endHour - range.startHour) * 60;
  if (totalMinutes <= 0) {
    return { top: 0, height: 0 };
  }

  const startOffset =
    (slot.startHour - range.startHour) * 60 + slot.startMinute;
  const endOffset = (slot.endHour - range.startHour) * 60 + slot.endMinute;

  return {
    top: (startOffset / totalMinutes) * 100,
    height: ((endOffset - startOffset) / totalMinutes) * 100,
  };
}

/**
 * Check if two time ranges overlap
 */
function timeRangesOverlap(
  start1: number,
  end1: number,
  start2: number,
  end2: number
): boolean {
  // Convert to minutes for comparison
  return start1 < end2 && start2 < end1;
}

/**
 * Convert hours and minutes to total minutes since midnight
 */
function toMinutes(hour: number, minute: number): number {
  return hour * 60 + minute;
}

/**
 * Check if two courses have conflicting schedules
 */
export function coursesConflict(course1: Course, course2: Course): boolean {
  const slots1 = parseSchedule(course1);
  const slots2 = parseSchedule(course2);

  for (const slot1 of slots1) {
    for (const slot2 of slots2) {
      // Check same day
      if (slot1.day === slot2.day) {
        const start1 = toMinutes(slot1.startHour, slot1.startMinute);
        const end1 = toMinutes(slot1.endHour, slot1.endMinute);
        const start2 = toMinutes(slot2.startHour, slot2.startMinute);
        const end2 = toMinutes(slot2.endHour, slot2.endMinute);

        if (timeRangesOverlap(start1, end1, start2, end2)) {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * Get all conflicts for a list of selected courses
 * Returns a map of Section -> array of conflicting Sections
 */
export function getConflicts(courses: Course[]): Map<string, string[]> {
  const conflicts = new Map<string, string[]>();

  // Initialize all courses with empty conflict arrays
  for (const course of courses) {
    conflicts.set(course.Section, []);
  }

  // Check each pair of courses
  for (let i = 0; i < courses.length; i++) {
    for (let j = i + 1; j < courses.length; j++) {
      if (coursesConflict(courses[i], courses[j])) {
        conflicts.get(courses[i].Section)?.push(courses[j].Section);
        conflicts.get(courses[j].Section)?.push(courses[i].Section);
      }
    }
  }

  return conflicts;
}

/**
 * Update selected courses with conflict information
 */
export function updateCoursesWithConflicts(
  courses: Course[]
): SelectedCourse[] {
  const conflicts = getConflicts(courses);

  return courses.map((course) => ({
    ...course,
    id: course.Section,
    hasConflict: (conflicts.get(course.Section)?.length ?? 0) > 0,
    conflictsWith: conflicts.get(course.Section) ?? [],
  }));
}

/**
 * Get calendar position for a time slot
 * Returns the row start and row span for CSS grid
 */
export function getCalendarPosition(slot: ParsedTimeSlot): {
  rowStart: number;
  rowSpan: number;
} {
  // Calculate row start (1-indexed for CSS grid)
  // Each hour is one row, starting from CALENDAR_START_HOUR
  const startRow = slot.startHour - CALENDAR_START_HOUR + 1;

  // Calculate duration in hours (round up to nearest hour for display)
  const startMinutes = toMinutes(slot.startHour, slot.startMinute);
  const endMinutes = toMinutes(slot.endHour, slot.endMinute);
  const durationHours = Math.ceil((endMinutes - startMinutes) / 60);

  return {
    rowStart: Math.max(1, startRow),
    rowSpan: Math.max(1, durationHours),
  };
}

/**
 * Format time for display (e.g., "9:00 AM")
 */
export function formatTime(hour: number, minute: number = 0): string {
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  const displayMinute = minute.toString().padStart(2, "0");
  return `${displayHour}:${displayMinute} ${period}`;
}

/**
 * Generate time labels for calendar.
 */
export function generateTimeLabels(
  startHour: number = CALENDAR_START_HOUR,
  endHour: number = CALENDAR_END_HOUR
): string[] {
  const labels: string[] = [];
  for (let hour = startHour; hour < endHour; hour++) {
    labels.push(formatTime(hour));
  }
  return labels;
}

/**
 * Calculate total credits from selected courses
 */
export function calculateTotalCredits(courses: Course[]): number {
  return courses.reduce((total, course) => {
    const credits = parseFloat(course.Credits) || 0;
    return total + credits;
  }, 0);
}

/**
 * Filter interface for time-based course filtering
 */
export interface TimeFilterOptions {
  days: Record<string, boolean>;
  timeRange: {
    startHour: number | null;
    endHour: number | null;
  };
  hasActiveFilters: boolean;
}

/**
 * Check if a course matches the time filter criteria
 * - Returns false if any schedule slot fails the day/time criteria
 */
export function courseMatchesTimeFilter(
  course: Course,
  options: TimeFilterOptions
): boolean {
  // If no filters are active, all courses pass
  if (!options.hasActiveFilters) {
    return true;
  }

  const slots = parseSchedule(course);

  // Course must have at least one slot that matches all criteria
  // Using .every() to ensure ALL time slots pass the filter
  // (course should only show if it fits entirely within the filter)
  return slots.every((slot) => {
    // Check day filter
    if (options.days[slot.day] === false) {
      return false;
    }

    // Check start time filter (course must start at or after this hour)
    if (
      options.timeRange.startHour !== null &&
      slot.startHour < options.timeRange.startHour
    ) {
      return false;
    }

    // Check end time filter (course must end at or before this hour)
    if (
      options.timeRange.endHour !== null &&
      slot.endHour > options.timeRange.endHour
    ) {
      return false;
    }

    return true;
  });
}
