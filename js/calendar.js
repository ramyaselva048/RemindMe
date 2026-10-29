/* ==========================================
   RemindMe - Premium Calendar Module
   File: js/calendar.js
========================================== */

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const STORAGE_KEY = "remindme_reminders";

let displayedYear;
let displayedMonth;
let selectedDate = getDateKey(new Date());
let calendarInitialized = false;
let reminderProvider = () => getLocalReminders();

function padNumber(value) {
  return String(value).padStart(2, "0");
}

export function getDateKey(date) {
  return `${date.getFullYear()}-${padNumber(date.getMonth() + 1)}-${padNumber(date.getDate())}`;
}

function parseDateKey(dateKey) {
  if (typeof dateKey !== "string") return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);

  return date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day ? date : null;
}

function formatDisplayDate(dateKey) {
  const date = parseDateKey(dateKey);
  return date
    ? date.toLocaleDateString(undefined, {
        weekday: "long", day: "numeric", month: "long", year: "numeric"
      })
    : dateKey || "";
}

function getLocalReminders() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(value) ? value : [];
  } catch (error) {
    console.error("Unable to read guest reminders for calendar:", error);
    return [];
  }
}

function getReminderDate(reminder) {
  const raw = reminder?.date ?? reminder?.reminderDate ?? reminder?.dueDate;
  if (typeof raw !== "string") return null;
  const key = raw.slice(0, 10);
  return parseDateKey(key) ? key : null;
}

function isCompleted(reminder) {
  return Boolean(reminder?.completed ?? reminder?.isCompleted ?? reminder?.done ?? false);
}

function remindersForDate(dateKey) {
  try {
    const list = reminderProvider();
    return Array.isArray(list)
      ? list.filter((item) => getReminderDate(item) === dateKey)
      : [];
  } catch (error) {
    console.error("Unable to get reminders for calendar:", error);
    return [];
  }
}

function getDotClass(reminder) {
  if (isCompleted(reminder)) return "green";
  const category = String(reminder?.category || "general").toLowerCase();

  if (category === "important" || category === "health") return "coral";
  if (category === "study" || category === "work") return "blue";
  if (category === "birthday") return "pink";
  return "gold";
}

function dispatchDateSelected(dateKey) {
  document.dispatchEvent(new CustomEvent("remindme:date-selected", {
    detail: { date: dateKey, formattedDate: formatDisplayDate(dateKey) }
  }));
}

export function initCalendar(options = {}) {
  if (typeof options.getReminders === "function") {
    reminderProvider = options.getReminders;
  }

  if (calendarInitialized) {
    renderCalendar();
    return;
  }

  calendarInitialized = true;
  const today = new Date();
  displayedYear = today.getFullYear();
  displayedMonth = today.getMonth();

  document.getElementById("prevMonth")?.addEventListener("click", showPreviousMonth);
  document.getElementById("nextMonth")?.addEventListener("click", showNextMonth);
  document.getElementById("todayButton")?.addEventListener("click", goToToday);

  renderWeekdayHeaders();
  renderCalendar();
}

export function showPreviousMonth() {
  displayedMonth -= 1;
  if (displayedMonth < 0) {
    displayedMonth = 11;
    displayedYear -= 1;
  }
  renderCalendar();
}

export function showNextMonth() {
  displayedMonth += 1;
  if (displayedMonth > 11) {
    displayedMonth = 0;
    displayedYear += 1;
  }
  renderCalendar();
}

export function goToToday() {
  const today = new Date();
  selectedDate = getDateKey(today);
  displayedYear = today.getFullYear();
  displayedMonth = today.getMonth();
  renderCalendar();
  dispatchDateSelected(selectedDate);
}

export function selectCalendarDate(dateKey) {
  const date = parseDateKey(dateKey);
  if (!date) return;

  selectedDate = dateKey;
  displayedYear = date.getFullYear();
  displayedMonth = date.getMonth();
  renderCalendar();
  dispatchDateSelected(dateKey);
}

export function getSelectedDate() {
  return selectedDate;
}

export function getDisplayedMonth() {
  return { year: displayedYear, month: displayedMonth };
}

export function renderCalendar() {
  const title = document.getElementById("monthTitle");
  const grid = document.getElementById("calendarDays");
  if (!title || !grid) {
    console.warn("Calendar elements not found (#monthTitle or #calendarDays).");
    return;
  }

  if (!Number.isInteger(displayedYear) || !Number.isInteger(displayedMonth)) {
    const today = new Date();
    displayedYear = today.getFullYear();
    displayedMonth = today.getMonth();
  }

  const firstDay = new Date(displayedYear, displayedMonth, 1).getDay();
  const daysInMonth = new Date(displayedYear, displayedMonth + 1, 0).getDate();
  const todayKey = getDateKey(new Date());

  title.textContent = `${MONTH_NAMES[displayedMonth]} ${displayedYear}`;
  grid.replaceChildren();
  grid.setAttribute("aria-label", `${MONTH_NAMES[displayedMonth]} ${displayedYear}`);
  grid.style.setProperty("--calendar-leading-blanks", String(firstDay));

  // Blank slots align day 1 with its weekday; only dates from this month are rendered.
  for (let blankIndex = 0; blankIndex < firstDay; blankIndex += 1) {
    const blank = document.createElement("span");
    blank.className = "calendar-day calendar-day-blank";
    blank.setAttribute("aria-hidden", "true");
    grid.appendChild(blank);
  }

  for (let dayNumber = 1; dayNumber <= daysInMonth; dayNumber += 1) {
    const date = new Date(displayedYear, displayedMonth, dayNumber);
    const dateKey = getDateKey(date);
    const items = remindersForDate(dateKey);
    const completedCount = items.filter(isCompleted).length;
    const pendingCount = items.length - completedCount;

    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "calendar-day";
    cell.dataset.date = dateKey;
    cell.setAttribute("aria-pressed", String(dateKey === selectedDate));
    cell.setAttribute(
      "aria-label",
      `${formatDisplayDate(dateKey)}${items.length ? `, ${items.length} reminder${items.length === 1 ? "" : "s"}, ${pendingCount} pending, ${completedCount} completed` : ", no reminders"}`
    );

    if (dateKey === todayKey) cell.classList.add("today");
    if (dateKey === selectedDate) cell.classList.add("selected");
    if (items.length) cell.classList.add("has-reminders");

    const number = document.createElement("span");
    number.className = "calendar-day-number";
    number.textContent = String(dayNumber);
    cell.appendChild(number);

    if (items.length) {
      const count = document.createElement("span");
      count.className = "calendar-reminder-count";
      count.textContent = `${items.length} reminder${items.length === 1 ? "" : "s"}`;
      cell.appendChild(count);

      const dots = document.createElement("span");
      dots.className = "calendar-reminder-dots";
      dots.setAttribute("aria-hidden", "true");
      items.map(getDotClass).slice(0, 4).forEach((dotClass) => {
        const dot = document.createElement("span");
        dot.className = `calendar-reminder-dot ${dotClass}`;
        dots.appendChild(dot);
      });
      if (items.length > 4) {
        const more = document.createElement("span");
        more.className = "calendar-reminder-extra";
        more.textContent = `+${items.length - 4}`;
        dots.appendChild(more);
      }
      cell.appendChild(dots);
    } else {
      const spacer = document.createElement("span");
      spacer.className = "calendar-reminder-count is-empty";
      spacer.setAttribute("aria-hidden", "true");
      spacer.textContent = "\u00a0";
      cell.appendChild(spacer);
    }

    cell.addEventListener("click", () => selectCalendarDate(dateKey));
    grid.appendChild(cell);
  }

  document.dispatchEvent(new CustomEvent("remindme:calendar-rendered", {
    detail: { year: displayedYear, month: displayedMonth, selectedDate }
  }));
}

export function refreshCalendar() {
  if (calendarInitialized) renderCalendar();
}

export function renderWeekdayHeaders() {
  const container = document.querySelector(".calendar-weekdays");
  if (!container) return;

  container.replaceChildren();
  WEEKDAY_NAMES.forEach((weekday) => {
    const element = document.createElement("span");
    element.className = "weekday";
    element.textContent = weekday;
    container.appendChild(element);
  });
}

document.addEventListener("remindme:reminders-updated", () => {
  if (calendarInitialized) renderCalendar();
});
