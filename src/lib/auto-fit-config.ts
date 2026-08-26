import { Course } from "@/types/course";
import {
  AutoFitCourseKey,
  getAutoFitCourseKey,
} from "@/lib/auto-fit-algorithm";

export const DEFAULT_AUTO_FIT_CONFIG: StoredAutoFitConfigV2 = {
  version: 2,
  mandatoryCourseKeys: [],
  optionalCourseKeys: [],
  maxCredits: 18,
  numCombinations: 5,
};

export interface StoredAutoFitConfigV2 {
  version: 2;
  mandatoryCourseKeys: AutoFitCourseKey[];
  optionalCourseKeys: AutoFitCourseKey[];
  maxCredits: number;
  numCombinations: number;
}

interface LegacyAutoFitConfig {
  mandatoryTitles?: unknown;
  optionalElectiveTitles?: unknown;
  maxCredits?: unknown;
  numCombinations?: unknown;
}

export interface NormalizedAutoFitConfig {
  config: StoredAutoFitConfigV2;
  droppedEntries: number;
  migrated: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function clampSetting(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(maximum, Math.max(minimum, Math.trunc(value)));
}

function positiveCreditCourses(courses: Course[]): Course[] {
  return courses.filter((course) => {
    const credits = Number.parseFloat(course.Credits);
    return Number.isFinite(credits) && credits > 0;
  });
}

function normalizeKeys(
  values: string[],
  validKeys: Set<string>,
  blockedKeys: Set<string> = new Set(),
): { keys: string[]; dropped: number } {
  const keys: string[] = [];
  const seen = new Set<string>();
  let dropped = 0;

  for (const value of values) {
    if (!validKeys.has(value) || blockedKeys.has(value) || seen.has(value)) {
      dropped++;
      continue;
    }
    seen.add(value);
    keys.push(value);
  }

  return { keys, dropped };
}

export function normalizeAutoFitConfig(
  stored: unknown,
  allCourses: Course[],
): NormalizedAutoFitConfig {
  const courses = positiveCreditCourses(allCourses);
  const validKeys = new Set(courses.map(getAutoFitCourseKey));
  const record = isRecord(stored) ? stored : {};
  const isVersionTwo = record.version === 2;
  let droppedEntries = 0;
  let mandatoryValues: string[];
  let optionalValues: string[];

  if (isVersionTwo) {
    mandatoryValues = stringArray(record.mandatoryCourseKeys);
    optionalValues = stringArray(record.optionalCourseKeys);
  } else {
    const legacy = record as LegacyAutoFitConfig;
    const keysByTitle = new Map<string, Set<string>>();
    for (const course of courses) {
      const titleKeys = keysByTitle.get(course["Course Title"]) ?? new Set();
      titleKeys.add(getAutoFitCourseKey(course));
      keysByTitle.set(course["Course Title"], titleKeys);
    }

    const migrateTitles = (value: unknown): string[] => {
      const migratedKeys: string[] = [];
      for (const title of stringArray(value)) {
        const matches = [...(keysByTitle.get(title) ?? [])];
        if (matches.length === 1) {
          migratedKeys.push(matches[0]);
        } else {
          droppedEntries++;
        }
      }
      return migratedKeys;
    };

    mandatoryValues = migrateTitles(legacy.mandatoryTitles);
    optionalValues = migrateTitles(legacy.optionalElectiveTitles);
  }

  const mandatory = normalizeKeys(mandatoryValues, validKeys);
  droppedEntries += mandatory.dropped;
  const optional = normalizeKeys(
    optionalValues,
    validKeys,
    new Set(mandatory.keys),
  );
  droppedEntries += optional.dropped;

  return {
    config: {
      version: 2,
      mandatoryCourseKeys: mandatory.keys,
      optionalCourseKeys: optional.keys,
      maxCredits: clampSetting(
        record.maxCredits,
        DEFAULT_AUTO_FIT_CONFIG.maxCredits,
        1,
        30,
      ),
      numCombinations: clampSetting(
        record.numCombinations,
        DEFAULT_AUTO_FIT_CONFIG.numCombinations,
        1,
        50,
      ),
    },
    droppedEntries,
    migrated: !isVersionTwo,
  };
}
