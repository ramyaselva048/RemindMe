/* ==========================================
   RemindMe - Reminder Management
   Guest: localStorage
   Signed-in users: Firebase Realtime Database
   File: js/reminders.js
========================================== */

import {
    loadReminders as loadStoredReminders,
    saveReminder as saveStoredReminder,
    removeReminder as removeStoredReminder,
    migrateGuestRemindersToCloud
} from "./storage.js";

/* ---------- Configuration ---------- */

const STORAGE_KEY = "remindme_reminders";

const CATEGORY_LABELS = {
    general: "General",
    important: "Important",
    personal: "Personal",
    work: "Work",
    study: "Study",
    health: "Health",
    birthday: "Birthday",
    other: "Other"
};

const FILTERS = ["upcoming", "today", "completed"];

let reminders = [];
let activeFilter = "upcoming";
let searchQuery = "";
let initialized = false;
let editingReminderId = null;
let selectedDateFilter = null;
let loadingReminders = false;

/* ---------- DOM Helpers ---------- */

function getElement(id) {
    return document.getElementById(id);
}

function createElement(tag, className = "", text = "") {
    const element = document.createElement(tag);

    if (className) element.className = className;
    if (text !== undefined && text !== null) {
        element.textContent = String(text);
    }

    return element;
}

function createButton(text, className, label, onClick) {
    const button = createElement("button", className, text);

    button.type = "button";
    button.setAttribute("aria-label", label);
    button.addEventListener("click", onClick);

    return button;
}

/* ---------- Date Helpers ---------- */

function pad(value) {
    return String(value).padStart(2, "0");
}

function todayKey() {
    const today = new Date();

    return [
        today.getFullYear(),
        pad(today.getMonth() + 1),
        pad(today.getDate())
    ].join("-");
}

function isValidDateKey(value) {
    if (typeof value !== "string") return false;

    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

    if (!match) return false;

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(year, month - 1, day);

    return (
        date.getFullYear() === year &&
        date.getMonth() === month - 1 &&
        date.getDate() === day
    );
}

function formatDate(dateKey) {
    if (!isValidDateKey(dateKey)) return dateKey || "";

    const [year, month, day] = dateKey.split("-").map(Number);

    return new Date(year, month - 1, day).toLocaleDateString(
        undefined,
        {
            day: "numeric",
            month: "short",
            year: "numeric"
        }
    );
}

function formatTime(time) {
    if (!time || !/^\d{2}:\d{2}$/.test(time)) return "";

    const [hours, minutes] = time.split(":").map(Number);
    const date = new Date();

    date.setHours(hours, minutes, 0, 0);

    return date.toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit"
    });
}

/* ---------- ID Generation ---------- */

function generateId() {
    if (
        typeof crypto !== "undefined" &&
        typeof crypto.randomUUID === "function"
    ) {
        return crypto.randomUUID();
    }

    return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/* ---------- Toast Messages ---------- */

function showToast(message, type = "success") {
    const toast = getElement("toast");

    if (!toast) {
        console.info(`[RemindMe] ${message}`);
        return;
    }

    toast.textContent = message;
    toast.className = `toast show ${type}`;
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");

    if (showToast.timeoutId) {
        clearTimeout(showToast.timeoutId);
    }

    showToast.timeoutId = setTimeout(() => {
        toast.classList.remove("show");
    }, 3500);
}

/* ---------- Reminder Events ---------- */

function notifyReminderChange(action, reminder = null) {
    document.dispatchEvent(
        new CustomEvent("remindme:reminders-updated", {
            detail: {
                action,
                reminder: reminder ? { ...reminder } : null,
                reminders: getReminders()
            }
        })
    );
}

/* ---------- Load and Save ---------- */

export function getReminders() {
    return reminders.map((reminder) => ({ ...reminder }));
}

export function getReminderById(id) {
    const reminder = reminders.find((item) => item.id === id);

    return reminder ? { ...reminder } : null;
}

async function loadRemindersFromStorage() {
    if (loadingReminders) return;

    loadingReminders = true;

    try {
        const result = await loadStoredReminders();

        reminders = Array.isArray(result) ? result : [];

        renderReminders();
        updateStatistics();
    } catch (error) {
        console.error("Unable to load reminders:", error);

        showToast(
            error.message || "Unable to load reminders.",
            "error"
        );
    } finally {
        loadingReminders = false;
    }
}

async function persistReminder(reminder) {
    try {
        await saveStoredReminder(reminder);
        return true;
    } catch (error) {
        console.error("Unable to save reminder:", error);

        showToast(
            error.message || "Unable to save reminder.",
            "error"
        );

        return false;
    }
}

/* ---------- Modal Handling ---------- */

function openReminderModal(reminder = null, date = null) {
    const modal = getElement("reminderModal");
    const form = getElement("reminderForm");

    if (!modal || !form) {
        showToast("Reminder form was not found in index.html.", "error");
        return;
    }

    form.reset();

    editingReminderId = reminder?.id ?? null;

    const idInput = getElement("reminderId");
    const titleInput = getElement("reminderTitle");
    const descriptionInput = getElement("reminderDescription");
    const dateInput = getElement("reminderDate");
    const timeInput = getElement("reminderTime");
    const categoryInput = getElement("reminderCategory");
    const repeatInput = getElement("reminderRepeat");
    const soundInput = getElement("reminderSound");
    const formError = getElement("formError");

    if (idInput) idInput.value = reminder?.id ?? "";
    if (titleInput) titleInput.value = reminder?.title ?? "";
    if (descriptionInput) {
        descriptionInput.value = reminder?.description ?? "";
    }

    if (dateInput) {
        dateInput.value =
            reminder?.date ??
            date ??
            selectedDateFilter ??
            todayKey();

        dateInput.min = todayKey();
    }

    if (timeInput) {
        const storedTime = reminder?.time ?? "09:00";
        const [storedHour, storedMinute] = storedTime.split(":").map(Number);
        const period = storedHour >= 12 ? "PM" : "AM";
        const hour12 = storedHour % 12 || 12;
        timeInput.value = `${String(hour12).padStart(2, "0")}:${String(storedMinute ?? 0).padStart(2, "0")}`;
        const periodInput = getElement("reminderAmPm");
        if (periodInput) periodInput.value = period;
    }

    if (categoryInput) {
        categoryInput.value = reminder?.category ?? "general";
    }

    if (repeatInput) repeatInput.value = reminder?.repeat ?? "none";
    if (soundInput) soundInput.checked = reminder?.sound ?? false;

    if (formError) {
        formError.textContent = "";
        formError.hidden = true;
    }

    const modalTitle = modal.querySelector(
        ".modal-title, .modal-header h2, h2"
    );

    if (modalTitle) {
        modalTitle.textContent = reminder
            ? "Edit Reminder"
            : "Add New Reminder";
    }

    const saveButton = getElement("saveReminderButton");

    if (saveButton) {
        saveButton.textContent = reminder
            ? "Save Changes"
            : "Save Reminder";
    }

    modal.hidden = false;
    modal.classList.add("show", "active");
    modal.setAttribute("aria-hidden", "false");

    document.body.classList.add("modal-open");

    titleInput?.focus();
}

function closeReminderModal() {
    const modal = getElement("reminderModal");

    if (!modal) return;

    modal.classList.remove("show", "active");
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");

    document.body.classList.remove("modal-open");

    editingReminderId = null;
}

function showFormError(message) {
    const formError = getElement("formError");

    if (formError) {
        formError.textContent = message;
        formError.hidden = false;
    } else {
        showToast(message, "error");
    }
}

/* ---------- Form Validation ---------- */

function getFormData() {
    const title = getElement("reminderTitle")?.value.trim() ?? "";
    const description =
        getElement("reminderDescription")?.value.trim() ?? "";
    const date = getElement("reminderDate")?.value ?? "";
    const rawTime = getElement("reminderTime")?.value ?? "09:00";
    const period = getElement("reminderAmPm")?.value ?? "AM";
    const category =
        getElement("reminderCategory")?.value ?? "general";
    const repeat = getElement("reminderRepeat")?.value ?? "none";
    const sound = getElement("reminderSound")?.checked ?? false;

    if (!title) {
        throw new Error("Please enter a reminder title.");
    }

    if (title.length > 150) {
        throw new Error("Reminder title must be 150 characters or fewer.");
    }

    if (description.length > 2000) {
        throw new Error("Description must be 2000 characters or fewer.");
    }

    if (!isValidDateKey(date)) {
        throw new Error("Please select a valid reminder date.");
    }

    if (!/^\d{2}:[0-5]\d$/.test(rawTime)) {
        throw new Error("Please select a valid reminder time.");
    }

    if (!["AM", "PM"].includes(period)) {
        throw new Error("Please select AM or PM.");
    }

    const [inputHour, inputMinute] = rawTime.split(":").map(Number);
    // The browser time input exposes a 24-hour value; the separate AM/PM
    // selector is the user's chosen period. Keep the clock hour in 12-hour form.
    let hour24 = inputHour % 12;
    if (period === "PM") hour24 += 12;
    const time = `${String(hour24).padStart(2, "0")}:${String(inputMinute).padStart(2, "0")}`;

    if (!Object.hasOwn(CATEGORY_LABELS, category)) {
        throw new Error("Please select a valid reminder category.");
    }

    if (!["none", "daily", "weekly", "monthly", "yearly"].includes(repeat)) {
        throw new Error("Please select a valid repeat option.");
    }

    return {
        title,
        description,
        date,
        time,
        category,
        repeat,
        sound
    };
}

/* ---------- Add or Update Reminder ---------- */

async function handleReminderSubmit(event) {
    event.preventDefault();

    let data;

    try {
        data = getFormData();
    } catch (error) {
        showFormError(error.message);
        return;
    }

    const existingReminder = editingReminderId
        ? reminders.find((item) => item.id === editingReminderId)
        : null;

    const reminder = {
        id: existingReminder?.id ?? generateId(),
        ...data,
        completed: existingReminder?.completed ?? false,
        createdAt: existingReminder?.createdAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    const saveButton = getElement("saveReminderButton");

    if (saveButton) {
        saveButton.disabled = true;
    }

    const success = await persistReminder(reminder);

    if (saveButton) {
        saveButton.disabled = false;
    }

    if (!success) return;

    if (existingReminder) {
        reminders = reminders.map((item) =>
            item.id === reminder.id ? reminder : item
        );
    } else {
        reminders = [...reminders, reminder];
    }

    closeReminderModal();
    renderReminders();
    updateStatistics();

    notifyReminderChange(
        existingReminder ? "updated" : "created",
        reminder
    );

    showToast(
        existingReminder
            ? "Reminder updated successfully!"
            : "Reminder added successfully!",
        "success"
    );
}

/* ---------- Edit Reminder ---------- */

function editReminder(id) {
    const reminder = reminders.find((item) => item.id === id);

    if (!reminder) {
        showToast("Reminder not found.", "error");
        return;
    }

    openReminderModal(reminder);
}

/* ---------- Delete Reminder ---------- */

async function deleteReminder(id) {
    const reminder = reminders.find((item) => item.id === id);

    if (!reminder) return;

    const confirmed = window.confirm(
        `Delete "${reminder.title}"? This action cannot be undone.`
    );

    if (!confirmed) return;

    try {
        await removeStoredReminder(id);

        reminders = reminders.filter((item) => item.id !== id);

        renderReminders();
        updateStatistics();
        notifyReminderChange("deleted", reminder);

        showToast("Reminder deleted.", "success");
    } catch (error) {
        console.error("Unable to delete reminder:", error);

        showToast(
            error.message || "Unable to delete reminder.",
            "error"
        );
    }
}

/* ---------- Complete / Reopen Reminder ---------- */

async function toggleReminderCompleted(id) {
    const existing = reminders.find((item) => item.id === id);

    if (!existing) return;

    const updated = {
        ...existing,
        completed: !existing.completed,
        updatedAt: new Date().toISOString()
    };

    const success = await persistReminder(updated);

    if (!success) return;

    reminders = reminders.map((item) =>
        item.id === id ? updated : item
    );

    renderReminders();
    updateStatistics();

    notifyReminderChange(
        updated.completed ? "completed" : "reopened",
        updated
    );

    showToast(
        updated.completed
            ? "Reminder marked as completed!"
            : "Reminder marked as incomplete.",
        "success"
    );
}

/* ---------- Filtering ---------- */

function getFilteredReminders() {
    const today = todayKey();
    const query = searchQuery.toLowerCase();

    return reminders
        .filter((reminder) => {
            if (activeFilter === "completed") {
                return reminder.completed;
            }

            if (activeFilter === "today") {
                return reminder.date === today && !reminder.completed;
            }

            return reminder.date >= today && !reminder.completed;
        })
        .filter((reminder) => {
            if (
                selectedDateFilter &&
                activeFilter !== "completed" &&
                reminder.date !== selectedDateFilter
            ) {
                return false;
            }

            return true;
        })
        .filter((reminder) => {
            if (!query) return true;

            return [
                reminder.title,
                reminder.description,
                reminder.category
            ].some((value) =>
                String(value ?? "").toLowerCase().includes(query)
            );
        })
        .sort((a, b) => {
            const dateA = `${a.date}T${a.time || "23:59"}`;
            const dateB = `${b.date}T${b.time || "23:59"}`;

            return dateA.localeCompare(dateB);
        });
}

function setActiveFilter(filter) {
    if (!FILTERS.includes(filter)) return;

    activeFilter = filter;
    selectedDateFilter = null;

    const heading = getElement("remindersHeading");
    const subtitle = getElement("remindersSubtitle");

    if (heading) {
        heading.textContent = {
            upcoming: "Upcoming Reminders",
            today: "Today's Reminders",
            completed: "Completed Reminders"
        }[filter];
    }

    if (subtitle) {
        subtitle.textContent = {
            upcoming: "Stay on top of what's coming next.",
            today: "Your reminders scheduled for today.",
            completed: "Look back at what you've accomplished."
        }[filter];
    }

    getElement("reminderFilters")
        ?.querySelectorAll("button")
        .forEach((button) => {
            const active = button.dataset.filter === filter;

            button.classList.toggle("active", active);
            button.setAttribute("aria-pressed", String(active));
        });

    renderReminders();
}

/* ---------- Reminder Card ---------- */

function renderReminderCard(reminder) {
    const card = createElement("article", "reminder-item");

    card.dataset.id = reminder.id;

    if (reminder.completed) {
        card.classList.add("completed");
    } else if (reminder.date < todayKey()) {
        card.classList.add("overdue");
    } else if (reminder.date === todayKey()) {
        card.classList.add("due-today");
    } else {
        card.classList.add("upcoming");
    }

    const completeButton = createButton(
        reminder.completed ? "✓" : "",
        `reminder-complete${reminder.completed ? " checked" : ""}`,
        reminder.completed
            ? `Mark ${reminder.title} incomplete`
            : `Mark ${reminder.title} complete`,
        () => toggleReminderCompleted(reminder.id)
    );

    completeButton.setAttribute(
        "aria-pressed",
        String(Boolean(reminder.completed))
    );

    card.appendChild(completeButton);

    const content = createElement("div", "reminder-content");

    content.appendChild(
        createElement("h3", "reminder-title", reminder.title)
    );

    if (reminder.description) {
        content.appendChild(
            createElement(
                "p",
                "reminder-description",
                reminder.description
            )
        );
    }

    const category = Object.hasOwn(CATEGORY_LABELS, reminder.category)
        ? reminder.category
        : "other";

    content.appendChild(
        createElement(
            "span",
            `reminder-category ${category}`,
            CATEGORY_LABELS[category]
        )
    );

    const meta = createElement("div", "reminder-meta");

    meta.appendChild(
        createElement(
            "span",
            "reminder-date",
            `📅 ${formatDate(reminder.date)}`
        )
    );

    if (reminder.time) {
        meta.appendChild(
            createElement(
                "span",
                "reminder-time",
                `🕒 ${formatTime(reminder.time)}`
            )
        );
    }

    if (reminder.repeat && reminder.repeat !== "none") {
        const repeatLabel =
            reminder.repeat.charAt(0).toUpperCase() +
            reminder.repeat.slice(1);

        meta.appendChild(
            createElement("span", "reminder-repeat", `↻ ${repeatLabel}`)
        );
    }

    if (reminder.completed) {
        meta.appendChild(
            createElement("span", "reminder-status", "✓ Completed")
        );
    } else if (reminder.date < todayKey()) {
        meta.appendChild(
            createElement("span", "reminder-status overdue", "Overdue")
        );
    } else if (reminder.date === todayKey()) {
        meta.appendChild(
            createElement("span", "reminder-status today", "Due today")
        );
    }

    content.appendChild(meta);
    card.appendChild(content);

    const actions = createElement("div", "reminder-actions");

    actions.appendChild(
        createButton(
            "✎",
            "reminder-edit-button",
            `Edit ${reminder.title}`,
            () => editReminder(reminder.id)
        )
    );

    actions.appendChild(
        createButton(
            "×",
            "reminder-delete-button",
            `Delete ${reminder.title}`,
            () => deleteReminder(reminder.id)
        )
    );

    card.appendChild(actions);

    return card;
}

/* ---------- Empty State ---------- */

function renderEmptyState(container) {
    const empty = createElement("div", "empty-state");

    const icon = createElement("div", "empty-state-icon", "✦");
    icon.setAttribute("aria-hidden", "true");

    empty.appendChild(icon);
    empty.appendChild(createElement("h3", "", "Nothing here yet"));

    const description = searchQuery
        ? "No reminders match your search. Try another keyword."
        : activeFilter === "completed"
            ? "Completed reminders will appear here."
            : activeFilter === "today"
                ? "You have no unfinished reminders for today."
                : "Create a reminder to keep track of important moments.";

    empty.appendChild(createElement("p", "", description));

    if (!searchQuery && activeFilter !== "completed") {
        empty.appendChild(
            createButton(
                "+ Add Reminder",
                "primary-button",
                "Add a new reminder",
                () => openReminderModal(null, selectedDateFilter)
            )
        );
    }

    container.appendChild(empty);
}

/* ---------- Render Reminder List ---------- */

export function renderReminders() {
    const container = getElement("remindersList");

    if (!container) {
        console.warn("Missing #remindersList in index.html.");
        return;
    }

    container.replaceChildren();

    const filtered = getFilteredReminders();

    if (filtered.length === 0) {
        renderEmptyState(container);
    } else {
        const fragment = document.createDocumentFragment();

        filtered.forEach((reminder) => {
            fragment.appendChild(renderReminderCard(reminder));
        });

        container.appendChild(fragment);
    }

    updateStatistics();
}

/* ---------- Dashboard Statistics ---------- */

export function updateStatistics() {
    const today = todayKey();

    const total = reminders.filter(
        (reminder) => !reminder.completed
    ).length;

    const todayCount = reminders.filter(
        (reminder) =>
            reminder.date === today && !reminder.completed
    ).length;

    const completedCount = reminders.filter(
        (reminder) => reminder.completed
    ).length;

    const upcomingCount = reminders.filter(
        (reminder) =>
            reminder.date >= today && !reminder.completed
    ).length;

    const totalElement = getElement("totalCount");
    const todayElement = getElement("todayCount");
    const completedElement = getElement("completedCount");
    const upcomingBadge = getElement("upcomingBadge");

    if (totalElement) totalElement.textContent = String(total);
    if (todayElement) todayElement.textContent = String(todayCount);
    if (completedElement) {
        completedElement.textContent = String(completedCount);
    }
    if (upcomingBadge) {
        upcomingBadge.textContent = String(upcomingCount);
    }
}

/* ---------- Calendar Date Selection ---------- */

function handleCalendarDateSelected(event) {
    const date = event.detail?.date;

    if (!isValidDateKey(date)) return;

    selectedDateFilter = date;

    if (activeFilter !== "completed") {
        activeFilter = "upcoming";

        const heading = getElement("remindersHeading");

        if (heading) {
            heading.textContent = `Reminders for ${formatDate(date)}`;
        }

        getElement("reminderFilters")
            ?.querySelectorAll("button")
            .forEach((button) => {
                const active = button.dataset.filter === "upcoming";

                button.classList.toggle("active", active);
                button.setAttribute("aria-pressed", String(active));
            });
    }

    renderReminders();
}

/* ---------- Authentication Changes ---------- */

async function handleAuthStateChanged(event) {
    const user = event.detail?.user;

    if (!user) {
        await loadRemindersFromStorage();
        return;
    }

    try {
        const guestReminders = (() => {
            try {
                const raw = localStorage.getItem(STORAGE_KEY);
                const parsed = raw ? JSON.parse(raw) : [];
                return Array.isArray(parsed) ? parsed : [];
            } catch {
                return [];
            }
        })();

        if (guestReminders.length > 0) {
            const shouldMigrate = window.confirm(
                "You have reminders saved as a guest. " +
                "Would you like to copy them to your signed-in account?"
            );

            if (shouldMigrate) {
                await migrateGuestRemindersToCloud();
            }
        }

        await loadRemindersFromStorage();
    } catch (error) {
        console.error("Failed to reload reminders after sign-in:", error);

        showToast(
            error.message || "Unable to load account reminders.",
            "error"
        );
    }
}

/* ---------- Initialize Module ---------- */

export function initReminders() {
    if (initialized) return;

    initialized = true;

    getElement("openReminderButton")?.addEventListener(
        "click",
        () => openReminderModal()
    );

    getElement("emptyAddButton")?.addEventListener(
        "click",
        () => openReminderModal()
    );

    getElement("reminderForm")?.addEventListener(
        "submit",
        handleReminderSubmit
    );

    getElement("closeModalButton")?.addEventListener(
        "click",
        closeReminderModal
    );

    getElement("cancelModalButton")?.addEventListener(
        "click",
        closeReminderModal
    );

    getElement("reminderModal")?.addEventListener("click", (event) => {
        if (event.target === event.currentTarget) {
            closeReminderModal();
        }
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            closeReminderModal();
        }
    });

    getElement("reminderFilters")
        ?.querySelectorAll("button")
        .forEach((button) => {
            button.addEventListener("click", () => {
                setActiveFilter(button.dataset.filter);
            });
        });

    getElement("searchInput")?.addEventListener("input", (event) => {
        searchQuery = event.target.value.trim();
        renderReminders();
    });

    getElement("clearSearchButton")?.addEventListener("click", () => {
        const input = getElement("searchInput");

        if (input) {
            input.value = "";
            input.focus();
        }

        searchQuery = "";
        renderReminders();
    });

    document.addEventListener(
        "remindme:date-selected",
        handleCalendarDateSelected
    );

    document.addEventListener(
        "remindme:auth-state-changed",
        handleAuthStateChanged
    );

    renderReminders();

    loadRemindersFromStorage();

    console.info("RemindMe reminder module initialized.");
}

/* ---------- Public API ---------- */

export {
    openReminderModal,
    closeReminderModal,
    editReminder,
    deleteReminder,
    toggleReminderCompleted
};