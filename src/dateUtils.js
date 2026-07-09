const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

const monthFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
});

const dayNameFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
});

export const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export function toIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addDays(isoDate, amount) {
  const date = parseIsoDate(isoDate);
  date.setDate(date.getDate() + amount);
  return toIsoDate(date);
}

export function parseIsoDate(isoDate) {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function buildWeekDates(weekStartDate) {
  return Array.from({ length: 7 }, (_, index) => {
    const isoDate = addDays(weekStartDate, index);
    const date = parseIsoDate(isoDate);

    return {
      dayName: dayNameFormatter.format(date),
      isoDate,
      displayDate: dateFormatter.format(date),
    };
  });
}

export function formatWeekRange(weekStartDate) {
  const start = parseIsoDate(weekStartDate);
  const end = parseIsoDate(addDays(weekStartDate, 6));

  if (start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth()) {
    return `${monthFormatter.format(start)} ${start.getDate()}-${end.getDate()}, ${start.getFullYear()}`;
  }

  if (start.getFullYear() === end.getFullYear()) {
    return `${monthFormatter.format(start)} ${start.getDate()}-${monthFormatter.format(end)} ${end.getDate()}, ${start.getFullYear()}`;
  }

  return `${monthFormatter.format(start)} ${start.getDate()}, ${start.getFullYear()}-${monthFormatter.format(end)} ${end.getDate()}, ${end.getFullYear()}`;
}

export function getWeekStartDate(isoDate, weekStartsOn = 6) {
  const date = parseIsoDate(isoDate);
  const diff = (date.getDay() - Number(weekStartsOn) + 7) % 7;
  date.setDate(date.getDate() - diff);
  return toIsoDate(date);
}

export function getTodayIsoDate() {
  return toIsoDate(new Date());
}

export function formatTimeForDisplay(time) {
  const [rawHour, rawMinute] = time.split(":").map(Number);
  const hour = rawHour % 24;
  const suffix = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${String(rawMinute).padStart(2, "0")} ${suffix}`;
}
