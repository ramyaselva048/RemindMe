
/* ==========================================
   RemindMe - Storage Manager
   Guest: localStorage
   Signed-in users: Firebase Realtime Database
   File: js/storage.js
========================================== */

import { auth, rtdb, authPersistenceReady } from "./firebase.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";

import {
    ref,
    get,
    set,
    remove
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-database.js";

/* ---------- Configuration ---------- */

const GUEST_STORAGE_KEY = "remindme_reminders";
const REMINDERS_PATH = "users";

/* ---------- Authentication State ---------- */

let currentUser = auth.currentUser || null;
let authReadyResolve;

const authReady = new Promise((resolve) => {
    authReadyResolve = resolve;
});

let authReadyResolved = false;

onAuthStateChanged(auth, (user) => {
    currentUser = user || null;

    if (!authReadyResolved) {
        authReadyResolved = true;
        authReadyResolve(currentUser);
    }
});

export async function waitForAuthReady() {
    await authPersistenceReady;
    await authReady;
    return currentUser;
}

export function getStorageMode() {
    return currentUser ? "realtime-database" : "local";
}

export function getStorageUserId() {
    return currentUser?.uid ?? null;
}

/* ---------- Guest Local Storage ---------- */

function readGuestReminders() {
    try {
        const raw = localStorage.getItem(GUEST_STORAGE_KEY);

        if (!raw) return [];

        const parsed = JSON.parse(raw);

        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        console.error("Unable to read guest reminders:", error);
        throw new Error("Could not read locally saved reminders.");
    }
}

function writeGuestReminders(reminders) {
    try {
        localStorage.setItem(
            GUEST_STORAGE_KEY,
            JSON.stringify(reminders)
        );
        return true;
    } catch (error) {
        console.error("Unable to save guest reminders:", error);
        throw new Error("Could not save reminders in browser storage.");
    }
}

/* ---------- Realtime Database References ---------- */

function getUserRemindersRef(user) {
    if (!user?.uid) {
        throw new Error("Please sign in to access cloud reminders.");
    }

    return ref(rtdb, `${REMINDERS_PATH}/${user.uid}/reminders`);
}

function getUserReminderRef(user, reminderId) {
    if (!reminderId || typeof reminderId !== "string") {
        throw new Error("A valid reminder ID is required.");
    }

    return ref(
        rtdb,
        `${REMINDERS_PATH}/${user.uid}/reminders/${reminderId}`
    );
}

/* ---------- Validation ---------- */

function validateReminder(reminder) {
    if (!reminder || typeof reminder !== "object") {
        throw new Error("Invalid reminder data.");
    }

    if (typeof reminder.id !== "string" || !reminder.id.trim()) {
        throw new Error("Reminder ID is required.");
    }

    if (
        typeof reminder.title !== "string" ||
        !reminder.title.trim()
    ) {
        throw new Error("Reminder title is required.");
    }

    if (reminder.title.length > 150) {
        throw new Error("Reminder title is too long.");
    }

    if (
        typeof reminder.date !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(reminder.date)
    ) {
        throw new Error("A valid reminder date is required.");
    }

    const [year, month, day] = reminder.date.split("-").map(Number);
    const date = new Date(year, month - 1, day);

    if (
        date.getFullYear() !== year ||
        date.getMonth() !== month - 1 ||
        date.getDate() !== day
    ) {
        throw new Error("Invalid calendar date.");
    }

    return {
        ...reminder,
        title: reminder.title.trim()
    };
}

/* ---------- Load Reminders ---------- */

export async function loadReminders() {
    const user = await waitForAuthReady();

    if (!user) {
        return readGuestReminders();
    }

    try {
        const snapshot = await get(getUserRemindersRef(user));

        if (!snapshot.exists()) return [];

        const data = snapshot.val();

        return Object.entries(data).map(([id, reminder]) => ({
            ...reminder,
            id
        }));
    } catch (error) {
        console.error("Realtime Database load failed:", error);
        throw new Error(
            "Unable to load cloud reminders. Check your connection and database rules."
        );
    }
}

/* ---------- Save or Update Reminder ---------- */

export async function saveReminder(reminder) {
    const validReminder = validateReminder(reminder);
    const user = await waitForAuthReady();

    if (!user) {
        const existing = readGuestReminders();

        const updated = existing.some(
            (item) => item.id === validReminder.id
        )
            ? existing.map((item) =>
                item.id === validReminder.id ? validReminder : item
            )
            : [...existing, validReminder];

        writeGuestReminders(updated);
        return validReminder;
    }

    try {
        await set(
            getUserReminderRef(user, validReminder.id),
            {
                ...validReminder,
                updatedAt: new Date().toISOString()
            }
        );

        return validReminder;
    } catch (error) {
        console.error("Realtime Database save failed:", error);
        throw new Error("Unable to save this reminder to your account.");
    }
}

/* ---------- Delete Reminder ---------- */

export async function removeReminder(reminderId) {
    const user = await waitForAuthReady();

    if (!user) {
        const updated = readGuestReminders().filter(
            (item) => item.id !== reminderId
        );

        writeGuestReminders(updated);
        return true;
    }

    try {
        await remove(getUserReminderRef(user, reminderId));
        return true;
    } catch (error) {
        console.error("Realtime Database delete failed:", error);
        throw new Error("Unable to delete this cloud reminder.");
    }
}

/* ---------- Replace All Reminders ---------- */

export async function replaceAllReminders(reminderList) {
    if (!Array.isArray(reminderList)) {
        throw new Error("Reminders must be provided as an array.");
    }

    const validated = reminderList.map(validateReminder);
    const user = await waitForAuthReady();

    if (!user) {
        writeGuestReminders(validated);
        return validated;
    }

    try {
        const data = {};

        for (const reminder of validated) {
            data[reminder.id] = {
                ...reminder,
                updatedAt: new Date().toISOString()
            };
        }

        await set(getUserRemindersRef(user), data);

        return validated;
    } catch (error) {
        console.error("Realtime Database replace failed:", error);
        throw new Error("Unable to replace your cloud reminders.");
    }
}

/* ---------- Migrate Guest Reminders ---------- */

export async function migrateGuestRemindersToCloud() {
    const user = await waitForAuthReady();

    if (!user) {
        throw new Error("Sign in before migrating guest reminders.");
    }

    const guestReminders = readGuestReminders();

    if (guestReminders.length === 0) {
        return {
            migrated: 0,
            message: "There are no guest reminders to migrate."
        };
    }

    const validated = guestReminders.map(validateReminder);

    try {
        const currentSnapshot = await get(getUserRemindersRef(user));
        const cloudData = currentSnapshot.exists()
            ? currentSnapshot.val()
            : {};

        for (const reminder of validated) {
            cloudData[reminder.id] = {
                ...reminder,
                updatedAt: new Date().toISOString()
            };
        }

        await set(getUserRemindersRef(user), cloudData);

        // Clear local guest data only after successful cloud save.
        localStorage.removeItem(GUEST_STORAGE_KEY);

        return {
            migrated: validated.length,
            message: "Guest reminders copied to your account."
        };
    } catch (error) {
        console.error("Guest migration failed:", error);
        throw new Error(
            "Guest reminders were not cleared. Please retry migration."
        );
    }
}

/* ---------- Clear Guest Reminders ---------- */

export function clearGuestReminders() {
    localStorage.removeItem(GUEST_STORAGE_KEY);
}

console.info("RemindMe Realtime Database storage module loaded.");
