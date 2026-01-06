"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { DayOfWeek, DAYS_OF_WEEK } from "@/types/course";

const STORAGE_KEY = "vinuni-course-filters";

export interface TimeRange {
  startHour: number | null; // null = any start time
  endHour: number | null; // null = any end time
}

export interface CourseFilters {
  days: Record<DayOfWeek, boolean>;
  timeRange: TimeRange;
  preset: string | null;
  hideConflicts: boolean;
}

export interface TimePreset {
  label: string;
  days?: Partial<Record<DayOfWeek, boolean>>;
  startHour?: number | null;
  endHour?: number | null;
}

export const TIME_PRESETS: Record<string, TimePreset> = {
  morning: {
    label: "Morning Only",
    endHour: 12,
  },
  afternoon: {
    label: "Afternoon Only",
    startHour: 12,
    endHour: 17,
  },
  evening: {
    label: "Evening Only",
    startHour: 17,
  },
  noEarly: {
    label: "No 8AM Classes",
    startHour: 9,
  },
  weekdays: {
    label: "Weekdays Only",
    days: { Saturday: false, Sunday: false },
  },
};

const DEFAULT_DAYS: Record<DayOfWeek, boolean> = {
  Monday: true,
  Tuesday: true,
  Wednesday: true,
  Thursday: true,
  Friday: true,
  Saturday: true,
  Sunday: true,
};

const DEFAULT_FILTERS: CourseFilters = {
  days: { ...DEFAULT_DAYS },
  timeRange: { startHour: null, endHour: null },
  preset: null,
  hideConflicts: false,
};

export function useCourseFilters() {
  const [filters, setFilters] = useState<CourseFilters>(DEFAULT_FILTERS);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as CourseFilters;
        // Ensure all days exist (in case of schema changes)
        const days = { ...DEFAULT_DAYS, ...parsed.days };
        setFilters({ ...parsed, days });
      }
    } catch (error) {
      console.error("Failed to load filters from localStorage:", error);
    }
    setIsLoaded(true);
  }, []);

  // Save to localStorage whenever filters change
  useEffect(() => {
    if (isLoaded) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
      } catch (error) {
        console.error("Failed to save filters to localStorage:", error);
      }
    }
  }, [filters, isLoaded]);

  // Check if any filter is active
  const hasActiveFilters = useMemo(() => {
    const hasDayFilter = Object.values(filters.days).some((v) => !v);
    const hasTimeFilter =
      filters.timeRange.startHour !== null ||
      filters.timeRange.endHour !== null;
    return hasDayFilter || hasTimeFilter || filters.hideConflicts;
  }, [filters]);

  // Get descriptive text for active filters
  const getFilterDescription = useCallback((): string => {
    const parts: string[] = [];

    // Day filters
    const activeDays = DAYS_OF_WEEK.filter((day) => filters.days[day]);
    const inactiveDays = DAYS_OF_WEEK.filter((day) => !filters.days[day]);

    if (inactiveDays.length > 0 && inactiveDays.length <= 3) {
      // Show which days are excluded if only a few
      parts.push(`No ${inactiveDays.map((d) => d.slice(0, 3)).join(", ")}`);
    } else if (activeDays.length > 0 && activeDays.length <= 3) {
      // Show which days are included if only a few
      parts.push(activeDays.map((d) => d.slice(0, 3)).join(", "));
    }

    // Time filters
    if (filters.timeRange.startHour !== null) {
      const hour = filters.timeRange.startHour;
      const period = hour >= 12 ? "PM" : "AM";
      const displayHour = hour % 12 || 12;
      parts.push(`After ${displayHour}${period}`);
    }
    if (filters.timeRange.endHour !== null) {
      const hour = filters.timeRange.endHour;
      const period = hour >= 12 ? "PM" : "AM";
      const displayHour = hour % 12 || 12;
      parts.push(`Before ${displayHour}${period}`);
    }

    return parts.join(", ");
  }, [filters]);

  // Apply a preset
  const applyPreset = useCallback((presetKey: string | null) => {
    if (!presetKey || !TIME_PRESETS[presetKey]) {
      // Clear preset and reset to defaults
      setFilters(DEFAULT_FILTERS);
      return;
    }

    const preset = TIME_PRESETS[presetKey];
    setFilters({
      days: {
        ...DEFAULT_DAYS,
        ...(preset.days || {}),
      },
      timeRange: {
        startHour: preset.startHour ?? null,
        endHour: preset.endHour ?? null,
      },
      preset: presetKey,
      hideConflicts: false,
    });
  }, []);

  // Update days (clears preset)
  const updateDays = useCallback((day: DayOfWeek, enabled: boolean) => {
    setFilters((prev) => ({
      ...prev,
      days: { ...prev.days, [day]: enabled },
      preset: null, // Clear preset on manual change
    }));
  }, []);

  // Update time range (clears preset)
  const updateTimeRange = useCallback(
    (field: "startHour" | "endHour", value: number | null) => {
      setFilters((prev) => ({
        ...prev,
        timeRange: { ...prev.timeRange, [field]: value },
        preset: null, // Clear preset on manual change
      }));
    },
    []
  );

  // Update hide conflicts toggle
  const updateHideConflicts = useCallback((checked: boolean) => {
    setFilters((prev) => ({
      ...prev,
      hideConflicts: checked,
    }));
  }, []);

  // Reset all filters
  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
  }, []);

  return {
    filters,
    hasActiveFilters,
    getFilterDescription,
    applyPreset,
    updateDays,
    updateTimeRange,
    updateHideConflicts,
    resetFilters,
    isLoaded,
  };
}
