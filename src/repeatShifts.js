import { addDays, parseIsoDate } from "./dateUtils.js";
import { copyDeskCoverage, copyShift } from "./scheduleState.js";

export const MAX_REPEAT_OCCURRENCES = 100;

export function getRepeatOccurrenceDates({
  frequency,
  maxOccurrences = MAX_REPEAT_OCCURRENCES,
  startDate,
  untilDate,
  weekdays = [],
}) {
  if (!frequency || frequency === "none") {
    return {
      dates: [startDate],
      exceedsLimit: false,
    };
  }

  const selectedWeekdays = weekdays.length > 0
    ? weekdays.map(Number)
    : [parseIsoDate(startDate).getDay()];
  const dates = [];
  let currentDate = startDate;
  let exceedsLimit = false;

  while (currentDate <= untilDate) {
    const currentWeekday = parseIsoDate(currentDate).getDay();
    const shouldInclude =
      frequency === "daily" ||
      (frequency === "weekly" && selectedWeekdays.includes(currentWeekday));

    if (shouldInclude) {
      dates.push(currentDate);

      if (dates.length > maxOccurrences || dates.length > MAX_REPEAT_OCCURRENCES) {
        exceedsLimit = true;
        break;
      }
    }

    currentDate = addDays(currentDate, 1);
  }

  return {
    dates,
    exceedsLimit,
  };
}

export function buildRepeatedShiftCopies(schedule, baseShift, repeatOptions) {
  if (!repeatOptions || repeatOptions.frequency === "none") {
    return [];
  }

  const { dates } = getRepeatOccurrenceDates({
    frequency: repeatOptions.frequency,
    maxOccurrences: repeatOptions.maxOccurrences,
    startDate: baseShift.date,
    untilDate: repeatOptions.untilDate,
    weekdays: repeatOptions.weekdays,
  });

  return dates
    .filter((date) => date !== baseShift.date)
    .map((date) => copyShift(schedule, baseShift, { date }));
}

export function buildRepeatedDeskCoverageCopies(schedule, baseCoverage, repeatOptions) {
  if (!repeatOptions || repeatOptions.frequency === "none") {
    return [];
  }

  const { dates } = getRepeatOccurrenceDates({
    frequency: repeatOptions.frequency,
    maxOccurrences: repeatOptions.maxOccurrences,
    startDate: baseCoverage.date,
    untilDate: repeatOptions.untilDate,
    weekdays: repeatOptions.weekdays,
  });

  return dates
    .filter((date) => date !== baseCoverage.date)
    .map((date) => copyDeskCoverage(schedule, baseCoverage, { date }));
}
