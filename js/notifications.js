
/* ==========================================
   RemindMe - Browser Notifications
   File: js/notifications.js

   Features:
   - Notification permission
   - Reminder time checking
   - Repeat reminder support
   - Duplicate notification prevention
   - Notification settings modal (browser notifications + sound only)
========================================== */

import { getReminders } from "./reminders.js";

/* ---------- Configuration ---------- */

const CHECK_INTERVAL_MS = 15000;
const NOTIFIED_STORAGE_KEY = "remindme_notified_occurrences";
const SETTINGS_STORAGE_KEY = "remindme_notification_settings";

let notificationTimer = null;
let initialized = false;
let notificationSettings = {
    enabled: true,
    soundEnabled: true,
};

let reminderAudioContext = null;
let audioReady = false;

/* ---------- DOM Helpers ---------- */

function getElement(id) {
    return document.getElementById(id);
}

/* ---------- Local Date Helpers ---------- */

function pad(value) {
    return String(value).padStart(2, "0");
}

function getDateKey(date) {
    return [
        date.getFullYear(),
        pad(date.getMonth() + 1),
        pad(date.getDate())
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

/* ---------- Settings Storage ---------- */

function loadSettings() {
    try {
        const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);

        if (stored) {
            const parsed = JSON.parse(stored);

            if (typeof parsed.enabled === "boolean") {
                notificationSettings.enabled = parsed.enabled;
            }

            if (typeof parsed.soundEnabled === "boolean") {
                notificationSettings.soundEnabled = parsed.soundEnabled;
            }
        }
    } catch (error) {
        console.warn("Unable to load notification settings.", error);
    }
}

function saveSettings() {
    try {
        localStorage.setItem(
            SETTINGS_STORAGE_KEY,
            JSON.stringify(notificationSettings)
        );
    } catch (error) {
        console.warn("Unable to save notification settings.", error);
    }
}

/* ---------- Duplicate Prevention ---------- */

function loadNotifiedOccurrences() {
    try {
        const stored = localStorage.getItem(NOTIFIED_STORAGE_KEY);

        if (!stored) return {};

        const parsed = JSON.parse(stored);

        return parsed && typeof parsed === "object" &&
            !Array.isArray(parsed)
            ? parsed
            : {};
    } catch {
        return {};
    }
}

function saveNotifiedOccurrences(occurrences) {
    try {
        localStorage.setItem(
            NOTIFIED_STORAGE_KEY,
            JSON.stringify(occurrences)
        );

        return true;
    } catch (error) {
        console.warn("Unable to record notification state.", error);
        return false;
    }
}

function hasBeenNotified(key) {
    const occurrences = loadNotifiedOccurrences();

    return Boolean(occurrences[key]);
}

function markAsNotified(key) {
    const occurrences = loadNotifiedOccurrences();

    occurrences[key] = Date.now();

    // Keep storage bounded by removing older records.
    const entries = Object.entries(occurrences)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 500);

    return saveNotifiedOccurrences(
        Object.fromEntries(entries)
    );
}

/* ---------- Toast Helper ---------- */

function showToast(message, type = "info") {
    const toast = getElement("toast");

    if (!toast) {
        console.info(`[RemindMe] ${message}`);
        return;
    }

    toast.textContent = message;
    toast.className = `toast show ${type}`;
    toast.setAttribute("role", "status");

    if (showToast.timeoutId) {
        clearTimeout(showToast.timeoutId);
    }

    showToast.timeoutId = setTimeout(() => {
        toast.classList.remove("show");
    }, 3500);
}

/* ---------- Reminder Sound (Web Audio API) ---------- */

function prepareReminderAudio() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;

    if (!AudioContextClass) return null;

    try {
        if (!reminderAudioContext) {
            reminderAudioContext = new AudioContextClass();
        }

        if (reminderAudioContext.state === "suspended") {
            // Must be triggered by a user gesture in modern browsers.
            reminderAudioContext.resume().then(() => {
                audioReady = reminderAudioContext.state === "running";
            }).catch((error) => {
                console.info("Reminder audio is waiting for user interaction.", error);
            });
        } else {
            audioReady = reminderAudioContext.state === "running";
        }

        return reminderAudioContext;
    } catch (error) {
        console.warn("Unable to initialize reminder audio.", error);
        return null;
    }
}

function playReminderSound() {
    if (!notificationSettings.soundEnabled) return false;

    const context = prepareReminderAudio();
    if (!context || context.state !== "running") return false;

    try {
        // Play a soft repeating chime for approximately five seconds.
        const startAt = context.currentTime + 0.04;
        const durationSeconds = 5;
        const chimeInterval = 0.48;
        const frequencies = [880, 1174.66, 1396.91];

        for (let elapsed = 0, index = 0; elapsed < durationSeconds; elapsed += chimeInterval, index++) {
            const noteStart = startAt + elapsed;
            const noteEnd = Math.min(noteStart + 0.36, startAt + durationSeconds);
            const oscillator = context.createOscillator();
            const gain = context.createGain();

            oscillator.type = "sine";
            oscillator.frequency.setValueAtTime(frequencies[index % frequencies.length], noteStart);
            gain.gain.setValueAtTime(0.0001, noteStart);
            gain.gain.exponentialRampToValueAtTime(0.14, noteStart + 0.025);
            gain.gain.exponentialRampToValueAtTime(0.0001, Math.max(noteStart + 0.04, noteEnd));
            oscillator.connect(gain);
            gain.connect(context.destination);
            oscillator.start(noteStart);
            oscillator.stop(noteEnd + 0.02);
        }

        return true;
    } catch (error) {
        console.warn("Unable to play reminder sound.", error);
        return false;
    }
}

export async function testReminderSound() {
    if (!notificationSettings.soundEnabled) {
        showToast("Sound alerts are turned off. Enable Sound alerts first.", "info");
        return false;
    }

    const context = prepareReminderAudio();
    if (!context) {
        showToast("This browser does not support sound alerts.", "error");
        return false;
    }

    try {
        if (context.state !== "running") {
            await context.resume();
        }

        audioReady = context.state === "running";
        const played = audioReady && playReminderSound();
        if (played) {
            showToast("Test sound played. If you did not hear it, check your device volume and browser tab mute setting.", "success");
        } else {
            showToast("Sound could not start. Check browser/site sound settings and click Test Sound again.", "error");
        }
        return Boolean(played);
    } catch (error) {
        console.error("Unable to resume audio context.", error);
        showToast("Unable to start sound. Check browser/site sound settings.", "error");
        return false;
    }
}

export async function testBrowserNotification() {
    if (!("Notification" in window)) {
        showToast("This browser does not support notifications.", "error");
        return false;
    }

    if (Notification.permission !== "granted") {
        showToast("First click Enable Browser Notifications and allow permission.", "info");
        return false;
    }

    try {
        const registration = "serviceWorker" in navigator
            ? await navigator.serviceWorker.getRegistration()
            : null;
        if (registration && typeof registration.showNotification === "function") {
            await registration.showNotification("RemindMe test notification", {
                body: "Browser notifications are working. Keep RemindMe open for scheduled reminder alerts. Keep RemindMe open for scheduled reminder alerts.",
                icon: "./assets/icons/icon-192.png",
                tag: "remindme-test-notification"
            });
        } else {
            new Notification("RemindMe test notification", {
                body: "Browser notifications are working. Keep RemindMe open for scheduled reminder alerts.",
                icon: "./assets/icons/icon-192.png",
                tag: "remindme-test-notification"
            });
        }
        showToast("Test notification sent.", "success");
        return true;
    } catch (error) {
        console.error("Test notification failed:", error);
        showToast("Test notification failed. Check browser notification settings.", "error");
        return false;
    }
}

function updateSoundControl() {
    const soundToggle = getElement("enableReminderSound");
    if (soundToggle) {
        soundToggle.checked = Boolean(notificationSettings.soundEnabled);
    }
}

/* ---------- Permission Status ---------- */

export function getNotificationPermission() {
    if (!("Notification" in window)) {
        return "unsupported";
    }

    return Notification.permission;
}

function updatePermissionStatus() {
    const statusElement = getElement(
        "notificationPermissionStatus"
    );

    const enableButton = getElement(
        "enableNotificationsButton"
    );

    const permission = getNotificationPermission();

    if (statusElement) {
        statusElement.classList.remove(
            "enabled",
            "denied"
        );

        if (permission === "granted") {
            statusElement.textContent =
                "Notifications are enabled in this browser.";

            statusElement.classList.add("enabled");
        } else if (permission === "denied") {
            statusElement.textContent =
                "Notifications are blocked. Change this website's notification permission in your browser settings.";

            statusElement.classList.add("denied");
        } else if (permission === "unsupported") {
            statusElement.textContent =
                "This browser does not support notifications.";
        } else {
            statusElement.textContent =
                "Allow notifications to receive reminders while this page is open.";
        }
    }

    if (enableButton) {
        enableButton.disabled =
            permission === "granted" ||
            permission === "unsupported";

        if (permission === "granted") {
            enableButton.textContent = "Notifications Enabled";
        } else if (permission === "denied") {
            enableButton.textContent = "Permission Blocked";
        } else {
            enableButton.textContent = "Enable Notifications";
        }
    }

    const notificationButton = getElement("notificationButton");

    if (notificationButton) {
        notificationButton.setAttribute(
            "aria-label",
            permission === "granted"
                ? "Notification settings"
                : "Enable notifications"
        );
    }
}

/* ---------- Request Permission ---------- */

export async function requestNotificationPermission() {
    // Start/resume audio while this call is still inside the user's click gesture.
    prepareReminderAudio();

    if (!("Notification" in window)) {
        showToast(
            "Your browser does not support notifications.",
            "error"
        );

        updatePermissionStatus();
        return false;
    }

    if (Notification.permission === "granted") {
        notificationSettings.enabled = true;
        saveSettings();
        updatePermissionStatus();
        startNotificationScheduler();

        showToast("Notifications are enabled.", "success");
        return true;
    }

    if (Notification.permission === "denied") {
        showToast(
            "Notifications are blocked. Allow them in your browser settings.",
            "error"
        );

        updatePermissionStatus();
        return false;
    }

    try {
        // Call this function from a real button click.
        const permission = await Notification.requestPermission();

        updatePermissionStatus();

        if (permission === "granted") {
            notificationSettings.enabled = true;
            saveSettings();

            startNotificationScheduler();

            showToast(
                "Notifications enabled successfully!",
                "success"
            );

            return true;
        }

        showToast(
            "Notification permission was not granted.",
            "info"
        );

        return false;
    } catch (error) {
        console.error("Notification permission error:", error);

        showToast(
            "Unable to request notification permission.",
            "error"
        );

        return false;
    }
}

/* ---------- Repeat Reminder Date ---------- */

function getOccurrenceDate(reminder, now) {
    const repeat = reminder.repeat || "none";

    if (!reminder.date || !isValidDateKey(reminder.date)) {
        return null;
    }

    const [year, month, day] = reminder.date.split("-").map(Number);

    const startDate = new Date(year, month - 1, day);
    const today = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
    );

    if (repeat === "none") {
        return getDateKey(startDate) === getDateKey(today)
            ? getDateKey(startDate)
            : null;
    }

    if (today < startDate) {
        return null;
    }

    if (repeat === "daily") {
        return getDateKey(today);
    }

    if (repeat === "weekly") {
        const daysElapsed = Math.floor(
            (today.getTime() - startDate.getTime()) /
            86400000
        );

        return daysElapsed % 7 === 0
            ? getDateKey(today)
            : null;
    }

    if (repeat === "monthly") {
        // Repeat on the original day number when that day exists.
        // For example, a reminder on the 31st skips months
        // that do not have a 31st.
        return (
            today.getDate() === startDate.getDate()
        )
            ? getDateKey(today)
            : null;
    }

    if (repeat === "yearly") {
        return (
            today.getMonth() === startDate.getMonth() &&
            today.getDate() === startDate.getDate()
        )
            ? getDateKey(today)
            : null;
    }

    return null;
}

/* ---------- Reminder Time ---------- */

function getReminderDateTime(reminder, occurrenceDate) {
    if (!reminder.time ||
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(reminder.time)) {
        return null;
    }

    const [year, month, day] = occurrenceDate
        .split("-")
        .map(Number);

    const [hours, minutes] = reminder.time
        .split(":")
        .map(Number);

    return new Date(
        year,
        month - 1,
        day,
        hours,
        minutes,
        0,
        0
    );
}

/* ---------- Display a Notification ---------- */

async function displayNotification(reminder, occurrenceDate) {
    if (Notification.permission !== "granted") {
        return false;
    }

    const title = reminder.title || "RemindMe Reminder";

    const body = reminder.description
        ? reminder.description
        : `Scheduled for ${occurrenceDate} at ${reminder.time}.`;

    const options = {
        body,
        icon: "./assets/icons/icon-192.png",
        badge: "./assets/icons/icon-192.png",
        tag: `remindme-${reminder.id}-${occurrenceDate}`,
        renotify: false,
        data: {
            reminderId: reminder.id,
            date: occurrenceDate,
            url: window.location.href
        }
    };

    try {
        /*
          Prefer the service worker when it is registered.
          Otherwise, use the page's Notification API.
        */

        if ("serviceWorker" in navigator) {
            const registration =
                await navigator.serviceWorker.getRegistration();

            if (registration &&
                typeof registration.showNotification === "function") {
                await registration.showNotification(title, options);
                return true;
            }
        }

        const notification = new Notification(title, options);

        notification.onclick = () => {
            window.focus();

            document.dispatchEvent(
                new CustomEvent("remindme:notification-clicked", {
                    detail: {
                        reminderId: reminder.id,
                        date: occurrenceDate
                    }
                })
            );

            notification.close();
        };

        return true;
    } catch (error) {
        console.error("Failed to display notification:", error);
        return false;
    }
}

/* ---------- Check Reminder Times ---------- */

export async function checkDueReminders() {
    // Sound alerts can work even if browser notification permission was not granted.
    if (!notificationSettings.enabled ||
        (!notificationSettings.soundEnabled && getNotificationPermission() !== "granted")) return;

    let allReminders = [];

    try {
        allReminders = getReminders();
    } catch (error) {
        console.error("Unable to read reminders:", error);
        return;
    }

    if (!Array.isArray(allReminders)) return;

    const now = new Date();

    for (const reminder of allReminders) {
        if (!reminder ||
            reminder.completed ||
            !reminder.id) {
            continue;
        }

        const occurrenceDate = getOccurrenceDate(reminder, now);

        if (!occurrenceDate) continue;

        const dueAt = getReminderDateTime(
            reminder,
            occurrenceDate
        );

        if (!dueAt) continue;

        const elapsed = now.getTime() - dueAt.getTime();

        /*
          Notify only during the first minute after the scheduled time.
          This avoids sending old notifications when the page opens
          hours later. The occurrence key prevents duplicates.
        */

        // Allow a short grace window in case the browser throttles timers.
        if (elapsed < 0 || elapsed >= 5 * 60 * 1000) {
            continue;
        }

        const occurrenceKey =
            `${reminder.id}:${occurrenceDate}:${reminder.time}`;

        if (hasBeenNotified(occurrenceKey)) {
            continue;
        }

        /*
          Record the occurrence before displaying the notification
          to reduce duplicate attempts across quick repeated checks.
        */

        if (!markAsNotified(occurrenceKey)) {
            console.warn(
                "Notification deduplication could not be saved."
            );
        }

        if (notificationSettings.soundEnabled) {
            playReminderSound();
        }

        if (getNotificationPermission() === "granted") {
            await displayNotification(reminder, occurrenceDate);
        }
    }
}

/* ---------- Scheduler ---------- */

export function startNotificationScheduler() {
    stopNotificationScheduler();

    if (!notificationSettings.enabled) {
        return;
    }

    // Run the timer for sound alerts even if notification permission is not granted.
    // Browser notifications themselves are still shown only when permission is granted.
    if (!notificationSettings.soundEnabled && getNotificationPermission() !== "granted") {
        return;
    }

    // Check immediately, then periodically while the page is active.
    checkDueReminders();

    notificationTimer = setInterval(() => {
        checkDueReminders();
    }, CHECK_INTERVAL_MS);
}

export function stopNotificationScheduler() {
    if (notificationTimer !== null) {
        clearInterval(notificationTimer);
        notificationTimer = null;
    }
}

/* ---------- Enable / Disable Notifications ---------- */

export function setNotificationsEnabled(enabled) {
    notificationSettings.enabled = Boolean(enabled);

    saveSettings();

    if (notificationSettings.enabled &&
        (notificationSettings.soundEnabled || getNotificationPermission() === "granted")) {
        startNotificationScheduler();
    } else {
        stopNotificationScheduler();
    }

    updatePermissionStatus();
}

/* ---------- Modal Controls ---------- */

function openNotificationModal() {
    const modal = getElement("notificationModal");

    if (!modal) {
        requestNotificationPermission();
        return;
    }

    updatePermissionStatus();

    modal.hidden = false;
    modal.classList.add("show", "active");
    modal.setAttribute("aria-hidden", "false");

    document.body.classList.add("modal-open");
}

function closeNotificationModal() {
    const modal = getElement("notificationModal");

    if (!modal) return;

    modal.hidden = true;
    modal.classList.remove("show", "active");
    modal.setAttribute("aria-hidden", "true");

    document.body.classList.remove("modal-open");
}

/* ---------- Initialization ---------- */

export function initNotifications() {
    if (initialized) return;

    initialized = true;

    loadSettings();

    getElement("notificationButton")?.addEventListener(
        "click",
        openNotificationModal
    );

    getElement("closeNotificationModal")?.addEventListener(
        "click",
        closeNotificationModal
    );

    getElement("enableNotificationsButton")?.addEventListener(
        "click",
        requestNotificationPermission
    );

    getElement("enableReminderSound")?.addEventListener(
        "change",
        (event) => {
            notificationSettings.soundEnabled = Boolean(event.target.checked);
            saveSettings();
            if (notificationSettings.soundEnabled) {
                prepareReminderAudio();
                showToast("Reminder sound enabled.", "success");
            } else {
                showToast("Reminder sound muted.", "info");
            }
        }
    );

    getElement("testReminderSound")?.addEventListener(
        "click",
        () => { testReminderSound(); }
    );

    getElement("testBrowserNotification")?.addEventListener(
        "click",
        () => { testBrowserNotification(); }
    );

    // Unlock audio on the first user interaction; browsers block autoplay otherwise.
    const unlockAudioOnce = () => {
        prepareReminderAudio();
        if (reminderAudioContext && reminderAudioContext.state === "running") {
            audioReady = true;
        }
        document.removeEventListener("pointerdown", unlockAudioOnce, true);
        document.removeEventListener("keydown", unlockAudioOnce, true);
    };
    document.addEventListener("pointerdown", unlockAudioOnce, true);
    document.addEventListener("keydown", unlockAudioOnce, true);

    getElement("notificationModal")?.addEventListener(
        "click",
        (event) => {
            if (event.target === event.currentTarget) {
                closeNotificationModal();
            }
        }
    );

    // Refresh the schedule when reminders change.
    document.addEventListener(
        "remindme:reminders-updated",
        () => {
            if (notificationSettings.enabled &&
                (notificationSettings.soundEnabled || getNotificationPermission() === "granted")) {
                startNotificationScheduler();
            }
        }
    );

    // Pause timer when this document is being unloaded.
    window.addEventListener("pagehide", stopNotificationScheduler);

    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
            updatePermissionStatus();

            if (notificationSettings.enabled &&
                (notificationSettings.soundEnabled || getNotificationPermission() === "granted")) {
                checkDueReminders();
                startNotificationScheduler();
            }
        }
    });

    updatePermissionStatus();
    updateSoundControl();

    if (notificationSettings.enabled &&
        (notificationSettings.soundEnabled || getNotificationPermission() === "granted")) {
        startNotificationScheduler();
    }

    console.info("RemindMe notifications module initialized.");
}

/* ---------- Export API ---------- */

export {
    openNotificationModal,
    closeNotificationModal
};
