import { buildWeekDates, formatWeekRange } from "./dateUtils.js";
import { formatHours } from "./hourCalculations.js";
import { getWeeklyHourWarning } from "./validation.js";

export function renderWeekSummary(container, schedule, dailyTotals, weeklyTotals) {
  const weekDates = buildWeekDates(schedule.weekStartDate);
  container.replaceChildren();

  const wrapper = document.createElement("div");
  wrapper.className = "week-summary-card";

  const title = document.createElement("div");
  title.className = "summary-title";
  title.textContent = formatWeekRange(schedule.weekStartDate);
  wrapper.append(title);

  const table = document.createElement("table");
  table.className = "totals-table";

  const head = document.createElement("thead");
  const headerRow = document.createElement("tr");
  headerRow.append(createCell("th", "Worker"));

  for (const date of weekDates) {
    headerRow.append(createCell("th", date.dayName.slice(0, 3)));
  }

  headerRow.append(createCell("th", "Week"));
  head.append(headerRow);
  table.append(head);

  const body = document.createElement("tbody");

  for (const worker of schedule.workers) {
    const row = document.createElement("tr");
    const weeklyHours = weeklyTotals[worker.id] ?? 0;
    const warning = getWeeklyHourWarning(weeklyHours);

    row.append(createCell("th", worker.name));

    for (const date of weekDates) {
      row.append(createCell("td", formatHours(dailyTotals[date.isoDate]?.[worker.id] ?? 0)));
    }

    const weekCell = createCell("td", formatHours(weeklyHours));
    weekCell.classList.add("week-total-cell");

    if (warning) {
      weekCell.classList.add("is-warning");
      weekCell.title = warning;
    }

    row.append(weekCell);
    body.append(row);
  }

  table.append(body);
  wrapper.append(table);
  container.append(wrapper);
}

export function renderDayTotals(container, workers, date, dailyTotals) {
  container.replaceChildren();

  for (const worker of workers) {
    const pill = document.createElement("span");
    pill.className = "daily-total-pill";
    pill.textContent = `${worker.name}: ${formatHours(dailyTotals[date]?.[worker.id] ?? 0)}`;
    container.append(pill);
  }
}

function createCell(tagName, text) {
  const cell = document.createElement(tagName);
  cell.textContent = text;
  return cell;
}
