"use client";

import { useState, useEffect, useCallback } from "react";
import { Course, SelectedCourse } from "@/types/course";
import { updateCoursesWithConflicts } from "@/lib/schedule-utils";
import coursesData from "@/data/courses.json";

const STORAGE_KEY = "vinuni-selected-courses";

// Master course data from courses.json
const masterCourses = coursesData as Course[];

/**
 * Validates stored courses against the master course data from courses.json.
 * Courses are identified by Course (code) and Section (section code).
 * If a course's data doesn't match the master data, it will be filtered out.
 */
function validateStoredCourses(storedCourses: Course[]): Course[] {
  return storedCourses.filter((storedCourse) => {
    // Find the corresponding course in master data by Course code and Section code
    const masterCourse = masterCourses.find(
      (mc) =>
        mc.Course === storedCourse.Course && mc.Section === storedCourse.Section
    );

    // If course doesn't exist in master data, remove it
    if (!masterCourse) {
      console.warn(
        `Course ${storedCourse.Course} section ${storedCourse.Section} not found in master data. Removing from saved courses.`
      );
      return false;
    }

    // Compare all relevant fields to check if data matches
    const dataMatches =
      masterCourse["Course Title"] === storedCourse["Course Title"] &&
      masterCourse.Dates === storedCourse.Dates &&
      masterCourse.Credits === storedCourse.Credits &&
      masterCourse.Instructor === storedCourse.Instructor &&
      masterCourse["Delivery Method"] === storedCourse["Delivery Method"] &&
      JSON.stringify(masterCourse.Schedule) ===
        JSON.stringify(storedCourse.Schedule);

    if (!dataMatches) {
      console.warn(
        `Course ${storedCourse.Course} section ${storedCourse.Section} data has changed. Removing from saved courses.`
      );
      return false;
    }

    return true;
  });
}

export function useSelectedCourses() {
  const [selectedCourses, setSelectedCourses] = useState<SelectedCourse[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Course[];
        // Validate stored courses against master data
        const validatedCourses = validateStoredCourses(parsed);

        // If any courses were removed, update localStorage
        if (validatedCourses.length !== parsed.length) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(validatedCourses));
          console.info(
            `Removed ${
              parsed.length - validatedCourses.length
            } outdated course(s) from saved selection.`
          );
        }

        // Recalculate conflicts on load
        setSelectedCourses(updateCoursesWithConflicts(validatedCourses));
      }
    } catch (error) {
      console.error("Failed to load courses from localStorage:", error);
    }
    setIsLoaded(true);
  }, []);

  // Save to localStorage whenever selectedCourses changes
  useEffect(() => {
    if (isLoaded) {
      try {
        // Store without conflict info (will be recalculated on load)
        const toStore = selectedCourses.map(
          ({ id, hasConflict, conflictsWith, ...course }) => course
        );
        localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
      } catch (error) {
        console.error("Failed to save courses to localStorage:", error);
      }
    }
  }, [selectedCourses, isLoaded]);

  const addCourse = useCallback((course: Course) => {
    setSelectedCourses((prev) => {
      // Check if already selected (by Section)
      if (prev.some((c) => c.Section === course.Section)) {
        return prev;
      }
      // Add course and recalculate conflicts
      const newCourses = [...prev, course];
      return updateCoursesWithConflicts(newCourses);
    });
  }, []);

  const removeCourse = useCallback((sectionId: string) => {
    setSelectedCourses((prev) => {
      const filtered = prev.filter((c) => c.Section !== sectionId);
      // Recalculate conflicts after removal
      return updateCoursesWithConflicts(filtered);
    });
  }, []);

  const clearAllCourses = useCallback(() => {
    setSelectedCourses([]);
  }, []);

  const isCourseSelected = useCallback(
    (sectionId: string) => {
      return selectedCourses.some((c) => c.Section === sectionId);
    },
    [selectedCourses]
  );

  return {
    selectedCourses,
    addCourse,
    removeCourse,
    clearAllCourses,
    isCourseSelected,
    isLoaded,
  };
}
