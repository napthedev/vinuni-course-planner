export interface Schedule {
  day:
    | "Monday"
    | "Tuesday"
    | "Wednesday"
    | "Thursday"
    | "Friday"
    | "Saturday"
    | "Sunday";
  time: string; // e.g., "9:00AM- 12:00PM" or "9:00AM to 10:15AM"
}

export interface Course {
  Course: string; // Course code, e.g., "MANA1011"
  "Course Title": string; // Course title
  Section: string; // Section code, e.g., "IMSSP261"
  Dates: string; // Date range, e.g., "2/9/2026 to 6/5/2026"
  Credits: string; // Credits as string, e.g., "3.00"
  Instructor: string; // Instructor name
  "Delivery Method": string; // e.g., "Classroom", "Hybrid"
  Schedule: Schedule[];
}

export interface SelectedCourse extends Course {
  id: string; // Unique identifier (Section code)
  hasConflict: boolean;
  conflictsWith: string[]; // Array of Section codes that conflict
}

export interface ParsedTimeSlot {
  day: string;
  startHour: number; // 0-23
  startMinute: number; // 0-59
  endHour: number; // 0-23
  endMinute: number; // 0-59
}

export type DayOfWeek =
  | "Monday"
  | "Tuesday"
  | "Wednesday"
  | "Thursday"
  | "Friday"
  | "Saturday"
  | "Sunday";

export const DAYS_OF_WEEK: DayOfWeek[] = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export const CALENDAR_START_HOUR = 7; // 7 AM
export const CALENDAR_END_HOUR = 22; // 10 PM
