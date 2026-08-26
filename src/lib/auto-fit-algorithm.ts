import { Course } from "@/types/course";
import { coursesConflict, parseSchedule } from "@/lib/schedule-utils";

export type AutoFitCourseKey = string;

export const DEFAULT_AUTO_FIT_SEARCH_NODES = 250_000;

const DEFAULT_COMBINATION_COUNT = 5;
const MIN_COMBINATION_COUNT = 1;
const MAX_COMBINATION_COUNT = 50;

export function getAutoFitCourseKey(course: Course): AutoFitCourseKey {
  return `${course["Course Title"]} (${course.Course})`;
}

export function getAutoFitCourseKeys(courses: Course[]): AutoFitCourseKey[] {
  return [
    ...new Set(
      courses
        .filter((course) => getCredits(course) > 0)
        .map(getAutoFitCourseKey),
    ),
  ].sort((left, right) => left.localeCompare(right));
}

export interface AutoFitInput {
  allCourses: Course[];
  mandatoryCourseKeys: AutoFitCourseKey[];
  optionalCourseKeys: AutoFitCourseKey[];
  maxCredits: number;
  numCombinations?: number;
  maxSearchNodes?: number;
}

export type AutoFitStatus = "optimal" | "infeasible" | "limit-reached";

export interface AutoFitResult {
  combinations: Course[][];
  status: AutoFitStatus;
  bestOptionalCount: number | null;
  exploredNodes: number;
  message?: string;
}

export interface AutoFitWorkerRequest {
  requestId: number;
  input: AutoFitInput;
}

export interface AutoFitWorkerSuccess {
  requestId: number;
  result: AutoFitResult;
}

export interface AutoFitWorkerFailure {
  requestId: number;
  error: string;
}

export type AutoFitWorkerResponse =
  | AutoFitWorkerSuccess
  | AutoFitWorkerFailure;

interface Candidate {
  course: Course;
  courseKey: AutoFitCourseKey;
  credits: number;
}

interface Variable {
  courseKey: AutoFitCourseKey;
  mandatory: boolean;
  domain: number[];
}

function getCredits(course: Course): number {
  const credits = Number.parseFloat(course.Credits);
  return Number.isFinite(credits) ? Math.round(credits * 100) : 0;
}

function hasFullyParsableSchedule(course: Course): boolean {
  const parsed = parseSchedule(course);
  return course.Schedule.length > 0 && parsed.length === course.Schedule.length;
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.length > 0))].sort(
    (left, right) => left.localeCompare(right),
  );
}

function clampInteger(
  value: number | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(maximum, Math.max(minimum, Math.trunc(value!)));
}

function combinationKey(courses: Course[]): string {
  return courses
    .map((course) => `${getAutoFitCourseKey(course)}:${course.Section}`)
    .sort((left, right) => left.localeCompare(right))
    .join("|");
}

function minimumDomainCredits(
  variable: Variable,
  candidates: Candidate[],
): number {
  return Math.min(...variable.domain.map((index) => candidates[index].credits));
}

/**
 * Generate deterministic, conflict-free schedules. Mandatory courses are hard
 * constraints; the sole optimization objective is the number of optional
 * course identities included.
 */
export function autoFitSchedule(input: AutoFitInput): AutoFitResult {
  if (!Number.isFinite(input.maxCredits) || input.maxCredits <= 0) {
    return {
      combinations: [],
      status: "infeasible",
      bestOptionalCount: null,
      exploredNodes: 0,
      message: "Maximum credits must be a positive number.",
    };
  }

  const maxCredits = Math.round(input.maxCredits * 100);
  const numCombinations = clampInteger(
    input.numCombinations,
    DEFAULT_COMBINATION_COUNT,
    MIN_COMBINATION_COUNT,
    MAX_COMBINATION_COUNT,
  );
  const maxSearchNodes = clampInteger(
    input.maxSearchNodes,
    DEFAULT_AUTO_FIT_SEARCH_NODES,
    1,
    Number.MAX_SAFE_INTEGER,
  );
  const mandatoryCourseKeys = uniqueSorted(input.mandatoryCourseKeys);
  const mandatorySet = new Set(mandatoryCourseKeys);
  const optionalCourseKeys = uniqueSorted(input.optionalCourseKeys).filter(
    (courseKey) => !mandatorySet.has(courseKey),
  );
  const requestedSet = new Set([
    ...mandatoryCourseKeys,
    ...optionalCourseKeys,
  ]);

  const groupedCourses = new Map<AutoFitCourseKey, Course[]>();
  for (const course of input.allCourses) {
    const courseKey = getAutoFitCourseKey(course);
    if (
      !requestedSet.has(courseKey) ||
      getCredits(course) <= 0 ||
      !hasFullyParsableSchedule(course)
    ) {
      continue;
    }

    const group = groupedCourses.get(courseKey) ?? [];
    group.push(course);
    groupedCourses.set(courseKey, group);
  }

  for (const group of groupedCourses.values()) {
    group.sort((left, right) => left.Section.localeCompare(right.Section));
  }

  const missingMandatory = mandatoryCourseKeys.filter(
    (courseKey) => !groupedCourses.has(courseKey),
  );
  if (missingMandatory.length > 0) {
    return {
      combinations: [],
      status: "infeasible",
      bestOptionalCount: null,
      exploredNodes: 0,
      message: `Could not find schedulable positive-credit sections for: ${missingMandatory.join(", ")}.`,
    };
  }

  const candidates: Candidate[] = [];
  const variables: Variable[] = [];
  for (const courseKey of [...mandatoryCourseKeys, ...optionalCourseKeys]) {
    const courses = groupedCourses.get(courseKey);
    if (!courses) {
      continue;
    }

    const domain = courses.map((course) => {
      const index = candidates.length;
      candidates.push({
        course,
        courseKey,
        credits: getCredits(course),
      });
      return index;
    });
    variables.push({
      courseKey,
      mandatory: mandatorySet.has(courseKey),
      domain,
    });
  }

  const conflicts = candidates.map(() => new Set<number>());
  for (let left = 0; left < candidates.length; left++) {
    for (let right = left + 1; right < candidates.length; right++) {
      if (
        candidates[left].courseKey !== candidates[right].courseKey &&
        coursesConflict(candidates[left].course, candidates[right].course)
      ) {
        conflicts[left].add(right);
        conflicts[right].add(left);
      }
    }
  }

  let exploredNodes = 0;
  let limitReached = false;
  let bestOptionalCount = -1;
  let bestCombinations: Course[][] = [];
  let bestCombinationKeys = new Set<string>();

  const minimumMandatoryCredits = (remaining: Variable[]): number => {
    let total = 0;
    for (const variable of remaining) {
      if (!variable.mandatory) {
        continue;
      }
      if (variable.domain.length === 0) {
        return Number.POSITIVE_INFINITY;
      }
      total += minimumDomainCredits(variable, candidates);
    }
    return total;
  };

  const optionalUpperBound = (
    remaining: Variable[],
    currentCredits: number,
    currentOptionalCount: number,
  ): number => {
    const mandatoryCredits = minimumMandatoryCredits(remaining);
    if (currentCredits + mandatoryCredits > maxCredits) {
      return Number.NEGATIVE_INFINITY;
    }

    let availableCredits = maxCredits - currentCredits - mandatoryCredits;
    const optionalMinimums = remaining
      .filter((variable) => !variable.mandatory && variable.domain.length > 0)
      .map((variable) => minimumDomainCredits(variable, candidates))
      .sort((left, right) => left - right);
    let additionalOptionalCount = 0;
    for (const credits of optionalMinimums) {
      if (credits > availableCredits) {
        break;
      }
      availableCredits -= credits;
      additionalOptionalCount++;
    }
    return currentOptionalCount + additionalOptionalCount;
  };

  const variableConflictDegree = (
    variable: Variable,
    remaining: Variable[],
  ): number => {
    const otherCandidates = new Set(
      remaining
        .filter((other) => other !== variable)
        .flatMap((other) => other.domain),
    );
    let degree = 0;
    for (const index of variable.domain) {
      for (const conflict of conflicts[index]) {
        if (otherCandidates.has(conflict)) {
          degree++;
        }
      }
    }
    return degree;
  };

  const chooseVariableIndex = (remaining: Variable[]): number => {
    let bestIndex = 0;
    let bestDomainSize = Number.POSITIVE_INFINITY;
    let bestDegree = Number.NEGATIVE_INFINITY;

    for (let index = 0; index < remaining.length; index++) {
      const variable = remaining[index];
      const effectiveDomainSize =
        variable.domain.length + (variable.mandatory ? 0 : 1);
      const degree = variableConflictDegree(variable, remaining);
      const bestVariable = remaining[bestIndex];
      const shouldReplace =
        effectiveDomainSize < bestDomainSize ||
        (effectiveDomainSize === bestDomainSize &&
          variable.mandatory &&
          !bestVariable.mandatory) ||
        (effectiveDomainSize === bestDomainSize &&
          variable.mandatory === bestVariable.mandatory &&
          degree > bestDegree) ||
        (effectiveDomainSize === bestDomainSize &&
          variable.mandatory === bestVariable.mandatory &&
          degree === bestDegree &&
          variable.courseKey.localeCompare(bestVariable.courseKey) < 0);

      if (shouldReplace) {
        bestIndex = index;
        bestDomainSize = effectiveDomainSize;
        bestDegree = degree;
      }
    }

    return bestIndex;
  };

  const orderedDomain = (
    variable: Variable,
    remaining: Variable[],
  ): number[] => {
    const otherDomains = remaining
      .filter((other) => other !== variable)
      .flatMap((other) => other.domain);
    return [...variable.domain].sort((left, right) => {
      const leftConflicts = otherDomains.filter((index) =>
        conflicts[left].has(index),
      ).length;
      const rightConflicts = otherDomains.filter((index) =>
        conflicts[right].has(index),
      ).length;
      return (
        leftConflicts - rightConflicts ||
        candidates[left].course.Section.localeCompare(
          candidates[right].course.Section,
        )
      );
    });
  };

  const recordCombination = (
    chosen: number[],
    optionalCount: number,
  ): void => {
    if (optionalCount < bestOptionalCount) {
      return;
    }

    if (optionalCount > bestOptionalCount) {
      bestOptionalCount = optionalCount;
      bestCombinations = [];
      bestCombinationKeys = new Set<string>();
    }

    const combination = chosen
      .map((index) => candidates[index])
      .sort((left, right) => {
        const mandatoryDifference =
          Number(!mandatorySet.has(left.courseKey)) -
          Number(!mandatorySet.has(right.courseKey));
        return (
          mandatoryDifference ||
          left.courseKey.localeCompare(right.courseKey) ||
          left.course.Section.localeCompare(right.course.Section)
        );
      })
      .map(({ course }) => course);
    const key = combinationKey(combination);
    if (
      !bestCombinationKeys.has(key) &&
      bestCombinations.length < numCombinations
    ) {
      bestCombinationKeys.add(key);
      bestCombinations.push(combination);
    }
  };

  const search = (
    remaining: Variable[],
    chosen: number[],
    currentCredits: number,
    currentOptionalCount: number,
  ): void => {
    if (limitReached) {
      return;
    }
    if (exploredNodes >= maxSearchNodes) {
      limitReached = true;
      return;
    }
    exploredNodes++;

    const upperBound = optionalUpperBound(
      remaining,
      currentCredits,
      currentOptionalCount,
    );
    if (
      upperBound < bestOptionalCount ||
      (bestCombinations.length >= numCombinations &&
        upperBound === bestOptionalCount)
    ) {
      return;
    }

    if (remaining.length === 0) {
      recordCombination(chosen, currentOptionalCount);
      return;
    }

    const selectedVariableIndex = chooseVariableIndex(remaining);
    const selectedVariable = remaining[selectedVariableIndex];
    const unassigned = remaining.filter(
      (_, index) => index !== selectedVariableIndex,
    );

    for (const candidateIndex of orderedDomain(selectedVariable, remaining)) {
      const candidate = candidates[candidateIndex];
      const nextCredits = currentCredits + candidate.credits;
      if (nextCredits > maxCredits) {
        continue;
      }

      let valid = true;
      const forwarded = unassigned.map((variable) => {
        const domain = variable.domain.filter(
          (index) =>
            !conflicts[candidateIndex].has(index) &&
            nextCredits + candidates[index].credits <= maxCredits,
        );
        if (variable.mandatory && domain.length === 0) {
          valid = false;
        }
        return { ...variable, domain };
      });
      if (
        !valid ||
        nextCredits + minimumMandatoryCredits(forwarded) > maxCredits
      ) {
        continue;
      }

      search(
        forwarded,
        [...chosen, candidateIndex],
        nextCredits,
        currentOptionalCount + (selectedVariable.mandatory ? 0 : 1),
      );
      if (limitReached) {
        return;
      }
    }

    if (!selectedVariable.mandatory) {
      search(unassigned, chosen, currentCredits, currentOptionalCount);
    }
  };

  search(variables, [], 0, 0);

  bestCombinations.sort((left, right) =>
    combinationKey(left).localeCompare(combinationKey(right)),
  );

  if (limitReached) {
    return {
      combinations: bestCombinations.filter((combination) => combination.length > 0),
      status: "limit-reached",
      bestOptionalCount:
        bestOptionalCount >= 0 ? bestOptionalCount : null,
      exploredNodes,
      message:
        bestOptionalCount >= 0
          ? "The search limit was reached. These schedules are valid best-so-far results, but optimality was not proven."
          : "The search limit was reached before a feasible schedule was found. Infeasibility was not proven.",
    };
  }

  if (bestOptionalCount < 0) {
    return {
      combinations: [],
      status: "infeasible",
      bestOptionalCount: null,
      exploredNodes,
      message:
        "The mandatory courses cannot be placed within the timetable and credit constraints.",
    };
  }

  if (mandatoryCourseKeys.length === 0 && bestOptionalCount === 0) {
    return {
      combinations: [],
      status: "optimal",
      bestOptionalCount: 0,
      exploredNodes,
      message:
        "No requested optional course fits within the timetable and credit constraints.",
    };
  }

  return {
    combinations: bestCombinations.filter((combination) => combination.length > 0),
    status: "optimal",
    bestOptionalCount,
    exploredNodes,
  };
}
