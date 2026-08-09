export const TERM_NAME = "Summer 2026 Semester";

export const APP_CONFIG = {
  site: {
    name: "VinUni Course Planner",
    description: "Plan your semester schedule at VinUniversity",
    footerText: "VinUni Course Planning Tool • Plan your semester schedule",
  },
  analytics: {
    googleMeasurementId: "G-S00YVDJTZX",
  },
  countdown: {
    targetDateTime: "2026-06-30T14:00:00+07:00",
    timeZone: "Asia/Bangkok",
    locale: "en-US",
    heading: "Course Registration Opens In",
    loadingMessage: "Loading...",
    expiredMessage: `Course Registration for ${TERM_NAME} is Open!`,
  },
  calendar: {
    startHour: 7,
    endHour: 22,
  },
  storageKeys: {
    selectedCourses: "vinuni-selected-courses",
    courseFilters: "vinuni-course-filters",
  },
} as const;
