"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowRight,
  Check,
  ChevronsUpDown,
  Clock,
  ListPlus,
  Sparkles,
  Star,
  TriangleAlert,
  User,
  Wand2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MiniWeeklyCalendar } from "@/components/mini-weekly-calendar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { APP_CONFIG } from "@/config";
import {
  AutoFitResult,
  AutoFitWorkerResponse,
  getAutoFitCourseKeys,
} from "@/lib/auto-fit-algorithm";
import {
  DEFAULT_AUTO_FIT_CONFIG,
  normalizeAutoFitConfig,
} from "@/lib/auto-fit-config";
import { getInstructorDisplayName } from "@/lib/course-utils";
import { calculateTotalCredits } from "@/lib/schedule-utils";
import { cn } from "@/lib/utils";
import { Course } from "@/types/course";

interface AutoFitSectionProps {
  allCourses: Course[];
  onApply: (courses: Course[]) => void;
}

interface CourseKeySelectProps {
  label: string;
  icon: React.ElementType;
  placeholder: string;
  options: string[];
  selectedKeys: string[];
  onToggle: (courseKey: string) => void;
  variant: "optional" | "mandatory";
  disabled: boolean;
}

function CourseKeySelect({
  label,
  icon: Icon,
  placeholder,
  options,
  selectedKeys,
  onToggle,
  variant,
  disabled,
}: CourseKeySelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selectedSet = useMemo(() => new Set(selectedKeys), [selectedKeys]);
  const filteredOptions = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return normalizedSearch
      ? options.filter((option) =>
          option.toLowerCase().includes(normalizedSearch),
        )
      : options;
  }, [options, search]);

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">
        <Icon className="h-4 w-4" />
        {label}
      </Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="h-auto min-h-10 w-full justify-between py-2"
            disabled={disabled}
          >
            <span className="truncate text-sm text-muted-foreground">
              {selectedKeys.length === 0
                ? placeholder
                : `${selectedKeys.length} course${selectedKeys.length === 1 ? "" : "s"} selected`}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[var(--radix-popover-trigger-width)] p-0"
          align="start"
        >
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search by title or course code..."
              value={search}
              onValueChange={setSearch}
              disabled={disabled}
            />
            <CommandList className="max-h-[250px]">
              <CommandEmpty>No courses found.</CommandEmpty>
              <CommandGroup>
                {filteredOptions.map((courseKey) => {
                  const isSelected = selectedSet.has(courseKey);
                  return (
                    <CommandItem
                      key={courseKey}
                      value={courseKey}
                      onSelect={() => {
                        if (!disabled) {
                          onToggle(courseKey);
                        }
                      }}
                      disabled={disabled}
                      className="cursor-pointer py-2.5"
                    >
                      <div
                        className={cn(
                          "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border",
                          isSelected && variant === "optional"
                            ? "border-blue-500 bg-blue-500 text-white"
                            : isSelected
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-muted-foreground/30",
                        )}
                      >
                        {isSelected && <Check className="h-3 w-3" />}
                      </div>
                      <span className="text-sm">{courseKey}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {selectedKeys.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedKeys.map((courseKey) => (
            <Badge
              key={courseKey}
              variant={variant === "optional" ? "secondary" : "default"}
              className="gap-1 pr-1 text-xs"
            >
              <span className="max-w-[240px] truncate">{courseKey}</span>
              <button
                type="button"
                onClick={() => onToggle(courseKey)}
                className="ml-0.5 rounded-full p-0.5 hover:bg-white/20"
                disabled={disabled}
                aria-label={`Remove ${courseKey}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

function CombinationCourseItem({ course }: { course: Course }) {
  return (
    <div className="flex items-start gap-2 py-1.5 text-sm">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge
            variant="secondary"
            className="px-1.5 py-0 font-mono text-[10px]"
          >
            {course.Course}
          </Badge>
          <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
            {course.Section}
          </Badge>
          <span className="text-[10px] text-muted-foreground">
            {course.Credits} cr
          </span>
        </div>
        <p className="mt-0.5 line-clamp-1 text-xs font-medium">
          {course["Course Title"]}
        </p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-0.5">
            <User className="h-2.5 w-2.5" />
            {getInstructorDisplayName(course.Instructor)}
          </span>
          <span className="flex items-center gap-0.5">
            <Clock className="h-2.5 w-2.5" />
            {course.Schedule.map(
              (schedule) =>
                `${schedule.day.slice(0, 3)} ${schedule.time}`,
            ).join(", ")}
          </span>
        </div>
      </div>
    </div>
  );
}

export function AutoFitSection({ allCourses, onApply }: AutoFitSectionProps) {
  const [mandatoryCourseKeys, setMandatoryCourseKeys] = useState<string[]>([]);
  const [optionalCourseKeys, setOptionalCourseKeys] = useState<string[]>([]);
  const [maxCredits, setMaxCredits] = useState(
    DEFAULT_AUTO_FIT_CONFIG.maxCredits,
  );
  const [numCombinations, setNumCombinations] = useState(
    DEFAULT_AUTO_FIT_CONFIG.numCombinations,
  );
  const [result, setResult] = useState<AutoFitResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [appliedIndex, setAppliedIndex] = useState<number | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const activeRequestIdRef = useRef(0);
  const allCourseKeys = useMemo(
    () => getAutoFitCourseKeys(allCourses),
    [allCourses],
  );

  useEffect(() => {
    try {
      const stored = localStorage.getItem(APP_CONFIG.storageKeys.autoFit);
      const normalized = normalizeAutoFitConfig(
        stored ? JSON.parse(stored) : DEFAULT_AUTO_FIT_CONFIG,
        allCourses,
      );
      setMandatoryCourseKeys(normalized.config.mandatoryCourseKeys);
      setOptionalCourseKeys(normalized.config.optionalCourseKeys);
      setMaxCredits(normalized.config.maxCredits);
      setNumCombinations(normalized.config.numCombinations);
      localStorage.setItem(
        APP_CONFIG.storageKeys.autoFit,
        JSON.stringify(normalized.config),
      );

      if (normalized.droppedEntries > 0) {
        window.setTimeout(() => {
          toast.warning("Review saved Auto Fit courses", {
            id: "autofit-migration-warning",
            description: `${normalized.droppedEntries} saved course ${normalized.droppedEntries === 1 ? "entry was" : "entries were"} removed because it was missing, ambiguous, duplicated, or no longer eligible.`,
            duration: 8000,
            closeButton: true,
          });
        }, 0);
      }
    } catch (error) {
      console.error("Failed to load Auto Fit configuration:", error);
    } finally {
      setIsLoaded(true);
    }
  }, [allCourses]);

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    try {
      localStorage.setItem(
        APP_CONFIG.storageKeys.autoFit,
        JSON.stringify({
          version: 2,
          mandatoryCourseKeys,
          optionalCourseKeys,
          maxCredits,
          numCombinations,
        }),
      );
    } catch (error) {
      console.error("Failed to save Auto Fit configuration:", error);
    }
  }, [
    isLoaded,
    mandatoryCourseKeys,
    optionalCourseKeys,
    maxCredits,
    numCombinations,
  ]);

  useEffect(
    () => () => {
      workerRef.current?.terminate();
    },
    [],
  );

  const resetGeneratedState = useCallback(() => {
    setResult(null);
    setErrorMessage(null);
    setAppliedIndex(null);
  }, []);

  const mandatorySet = useMemo(
    () => new Set(mandatoryCourseKeys),
    [mandatoryCourseKeys],
  );
  const optionalSet = useMemo(
    () => new Set(optionalCourseKeys),
    [optionalCourseKeys],
  );
  const mandatoryOptions = useMemo(
    () => allCourseKeys.filter((courseKey) => !optionalSet.has(courseKey)),
    [allCourseKeys, optionalSet],
  );
  const optionalOptions = useMemo(
    () => allCourseKeys.filter((courseKey) => !mandatorySet.has(courseKey)),
    [allCourseKeys, mandatorySet],
  );

  const toggleMandatory = useCallback(
    (courseKey: string) => {
      setMandatoryCourseKeys((current) =>
        current.includes(courseKey)
          ? current.filter((key) => key !== courseKey)
          : [...current, courseKey],
      );
      setOptionalCourseKeys((current) =>
        current.filter((key) => key !== courseKey),
      );
      resetGeneratedState();
    },
    [resetGeneratedState],
  );

  const toggleOptional = useCallback(
    (courseKey: string) => {
      setOptionalCourseKeys((current) =>
        current.includes(courseKey)
          ? current.filter((key) => key !== courseKey)
          : [...current, courseKey],
      );
      resetGeneratedState();
    },
    [resetGeneratedState],
  );

  const getWorker = useCallback((): Worker => {
    if (workerRef.current) {
      return workerRef.current;
    }

    const worker = new Worker(
      new URL("../workers/auto-fit.worker.ts", import.meta.url),
      { type: "module" },
    );
    worker.onmessage = (event: MessageEvent<AutoFitWorkerResponse>) => {
      if (event.data.requestId !== activeRequestIdRef.current) {
        return;
      }

      setIsRunning(false);
      if ("error" in event.data) {
        setErrorMessage(event.data.error);
        setResult(null);
        return;
      }
      setResult(event.data.result);
    };
    worker.onerror = (event) => {
      event.preventDefault();
      setIsRunning(false);
      setResult(null);
      setErrorMessage("The Auto Fit worker failed. Please try again.");
      worker.terminate();
      workerRef.current = null;
    };
    workerRef.current = worker;
    return worker;
  }, []);

  const handleAutoFit = useCallback(() => {
    const requestId = activeRequestIdRef.current + 1;
    activeRequestIdRef.current = requestId;
    setIsRunning(true);
    setResult(null);
    setErrorMessage(null);
    setAppliedIndex(null);
    getWorker().postMessage({
      requestId,
      input: {
        allCourses,
        mandatoryCourseKeys,
        optionalCourseKeys,
        maxCredits,
        numCombinations,
      },
    });
  }, [
    allCourses,
    getWorker,
    mandatoryCourseKeys,
    maxCredits,
    numCombinations,
    optionalCourseKeys,
  ]);

  const handleApply = useCallback(
    (index: number) => {
      const combination = result?.combinations[index];
      if (!combination) {
        return;
      }
      onApply(combination);
      setAppliedIndex(index);
    },
    [onApply, result],
  );

  const isLimitReached = result?.status === "limit-reached";

  return (
    <section className="mt-8">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-primary" />
            <CardTitle className="text-xl">Auto Fit Schedule</CardTitle>
          </div>
          <CardDescription>
            Choose required and optional courses, then generate deterministic,
            conflict-free weekly schedules that fit the most optional courses.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-start gap-3 rounded-lg border border-yellow-500/40 bg-yellow-50 px-4 py-3 text-sm text-yellow-800 dark:border-yellow-500/30 dark:bg-yellow-950/40 dark:text-yellow-200">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-yellow-600 dark:text-yellow-400" />
            <p>
              Don&apos;t trust this tool 100%. Double-check the generated
              schedule and verify that its sections match your desired learning
              pathway.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <CourseKeySelect
              label="Mandatory Courses"
              icon={Star}
              placeholder="Select mandatory courses..."
              options={mandatoryOptions}
              selectedKeys={mandatoryCourseKeys}
              onToggle={toggleMandatory}
              variant="mandatory"
              disabled={isRunning || !isLoaded}
            />
            <CourseKeySelect
              label="Optional Elective Courses"
              icon={ListPlus}
              placeholder="Select optional elective courses..."
              options={optionalOptions}
              selectedKeys={optionalCourseKeys}
              onToggle={toggleOptional}
              variant="optional"
              disabled={isRunning || !isLoaded}
            />
          </div>

          <div className="flex flex-col items-stretch gap-4 sm:flex-row sm:items-end">
            <div className="space-y-2 sm:w-48">
              <Label htmlFor="auto-fit-max-credits">Max Total Credits</Label>
              <Input
                id="auto-fit-max-credits"
                type="number"
                min={1}
                max={30}
                value={maxCredits}
                disabled={isRunning || !isLoaded}
                onChange={(event) => {
                  const value = Number.parseInt(event.target.value, 10);
                  if (Number.isFinite(value) && value >= 1 && value <= 30) {
                    setMaxCredits(value);
                    resetGeneratedState();
                  }
                }}
              />
            </div>
            <div className="space-y-2 sm:w-48">
              <Label htmlFor="auto-fit-num-combinations">
                Number of Combinations
              </Label>
              <Input
                id="auto-fit-num-combinations"
                type="number"
                min={1}
                max={50}
                value={numCombinations}
                disabled={isRunning || !isLoaded}
                onChange={(event) => {
                  const value = Number.parseInt(event.target.value, 10);
                  if (Number.isFinite(value) && value >= 1 && value <= 50) {
                    setNumCombinations(value);
                    resetGeneratedState();
                  }
                }}
              />
            </div>
            <Button
              onClick={handleAutoFit}
              disabled={
                isRunning ||
                !isLoaded ||
                mandatoryCourseKeys.length + optionalCourseKeys.length === 0
              }
              size="lg"
              className="gap-2"
            >
              {isRunning ? (
                <>
                  <Spinner className="h-4 w-4" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Auto Fit
                </>
              )}
            </Button>
          </div>

          {errorMessage && (
            <div className="rounded-lg border border-red-500/30 bg-red-50 p-4 dark:bg-red-950/20">
              <p className="text-sm text-red-700 dark:text-red-400">
                {errorMessage}
              </p>
            </div>
          )}

          {result?.message && (
            <div
              className={cn(
                "rounded-lg border p-4",
                isLimitReached
                  ? "border-amber-500/40 bg-amber-50 dark:bg-amber-950/20"
                  : "border-yellow-500/30 bg-yellow-50 dark:bg-yellow-950/20",
              )}
            >
              <p
                className={cn(
                  "text-sm",
                  isLimitReached
                    ? "text-amber-800 dark:text-amber-300"
                    : "text-yellow-700 dark:text-yellow-400",
                )}
              >
                {result.message} Explored {result.exploredNodes.toLocaleString()} search nodes.
              </p>
            </div>
          )}

          {result && result.combinations.length > 0 && (
            <div className="space-y-4">
              <Separator />
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="flex items-center gap-2 text-lg font-semibold">
                  <Sparkles className="h-4 w-4 text-primary" />
                  {result.combinations.length} Schedule Option
                  {result.combinations.length === 1 ? "" : "s"}
                </h3>
                <Badge variant={isLimitReached ? "secondary" : "default"}>
                  {isLimitReached ? "Best found" : "Optimal"}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {result.bestOptionalCount ?? 0} optional course
                  {result.bestOptionalCount === 1 ? "" : "s"} included
                </span>
              </div>

              <div className="grid gap-4">
                {result.combinations.map((combination, index) => {
                  const isApplied = appliedIndex === index;
                  const totalCredits = calculateTotalCredits(combination);
                  return (
                    <div
                      key={combination
                        .map((course) => course.Section)
                        .sort()
                        .join("|")}
                      className={cn(
                        "rounded-lg border p-4 transition-colors",
                        isApplied
                          ? "border-green-500 bg-green-50 dark:bg-green-950/20"
                          : "border-border hover:border-primary/30",
                      )}
                    >
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <Badge variant={isApplied ? "default" : "secondary"}>
                            Option {index + 1}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {combination.length} course
                            {combination.length === 1 ? "" : "s"} •{" "}
                            {totalCredits} credits
                          </span>
                        </div>
                        <Button
                          size="sm"
                          variant={isApplied ? "outline" : "default"}
                          className="gap-1.5"
                          onClick={() => handleApply(index)}
                          disabled={isApplied}
                        >
                          {isApplied ? (
                            <>
                              <Check className="h-3.5 w-3.5" /> Applied
                            </>
                          ) : (
                            <>
                              <ArrowRight className="h-3.5 w-3.5" /> Apply
                              Schedule
                            </>
                          )}
                        </Button>
                      </div>
                      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(280px,420px)] md:items-start">
                        <div className="min-w-0 divide-y divide-border/50">
                          {combination.map((course) => (
                            <CombinationCourseItem
                              key={course.Section}
                              course={course}
                            />
                          ))}
                        </div>
                        <MiniWeeklyCalendar courses={combination} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
