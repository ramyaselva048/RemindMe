
/* ==========================================
   RemindMe - Main Application Controller
   File: js/app.js
========================================== */

import {
    initCalendar,
    renderWeekdayHeaders,
    refreshCalendar
} from "./calendar.js";

import {
    initReminders,
    getReminders,
    updateStatistics,
    renderReminders
} from "./reminders.js";

import {
    initNotifications
} from "./notifications.js";

import {
    auth,
    authPersistenceReady
} from "./firebase.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";

import { initAuth } from "./auth.js";

/* ---------- Application State ---------- */

let appInitialized = false;
let authListenerInitialized = false;

/* ---------- DOM Helpers ---------- */

function getElement(id) {
    return document.getElementById(id);
}

/* ---------- Toast Messages ---------- */

function showAppMessage(message, type = "info") {
    const toast = getElement("toast");

    if (!toast) {
        console.info(`[RemindMe] ${message}`);
        return;
    }

    toast.textContent = message;
    toast.className = `toast show ${type}`;
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");

    if (showAppMessage.timeoutId) {
        clearTimeout(showAppMessage.timeoutId);
    }

    showAppMessage.timeoutId = setTimeout(() => {
        toast.classList.remove("show");
    }, 3500);
}

/* ---------- Loading State ---------- */

function showAppLoading() {
    document.body.classList.add("app-loading");
    document.documentElement.setAttribute("data-app-state", "loading");
}

function hideAppLoading() {
    document.body.classList.remove("app-loading");
    document.documentElement.setAttribute("data-app-state", "ready");
}

/* ---------- Dashboard Refresh ---------- */

function refreshDashboard() {
    renderReminders();
    updateStatistics();
    refreshCalendar();
}

/* ---------- Application Events ---------- */

function setupApplicationEvents() {
    document.addEventListener(
        "remindme:reminders-updated",
        () => {
            refreshDashboard();
        }
    );

    document.addEventListener(
        "remindme:date-selected",
        (event) => {
            const selectedDate = event.detail?.date;

            if (selectedDate) {
                document.documentElement.dataset.selectedDate =
                    selectedDate;
            }
        }
    );

    window.addEventListener("storage", (event) => {
        if (event.key === "remindme_reminders") {
            /*
             * Refresh the active tab when guest reminders change
             * in another tab.
             */
            refreshDashboard();
        }
    });

    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
            refreshDashboard();
        }
    });
}

/* ---------- Authentication Listener ---------- */

function setupAuthenticationListener() {
    if (authListenerInitialized) return;

    authListenerInitialized = true;

    onAuthStateChanged(
        auth,
        (user) => {
            console.info(
                user
                    ? `RemindMe signed in: ${user.uid}`
                    : "RemindMe is running in guest mode."
            );

            /*
             * reminders.js listens for this event and reloads
             * the active user's reminders.
             */
            document.dispatchEvent(
                new CustomEvent("remindme:auth-state-changed", {
                    detail: {
                        user: user || null,
                        isSignedIn: Boolean(user)
                    }
                })
            );

            refreshDashboard();
        },
        (error) => {
            console.error("Authentication listener error:", error);

            showAppMessage(
                "Unable to check your sign-in status.",
                "error"
            );
        }
    );
}


/* ---------- Sidebar Page Navigation ---------- */
function setupSidebarNavigation() {
    const app = getElement("app");
    const links = document.querySelectorAll(".nav-link[data-view]");
    if (!app || !links.length) return;

    links.forEach((link) => {
        link.addEventListener("click", (event) => {
            event.preventDefault();
            const view = link.dataset.view || "dashboard";
            app.dataset.currentView = view;
            links.forEach((item) => {
                const active = item === link;
                item.classList.toggle("active", active);
                if (active) item.setAttribute("aria-current", "page");
                else item.removeAttribute("aria-current");
            });

            const filter = view === "completed" ? "completed" : "upcoming";
            if (view === "upcoming" || view === "completed") {
                document.querySelector(`.filter-btn[data-filter="${filter}"]`)?.click();
                getElement("reminders-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
            } else if (view === "calendar") {
                app.dataset.currentView = "dashboard";
                getElement("calendar-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
            } else {
                document.querySelector('.filter-btn[data-filter="upcoming"]')?.click();
                window.scrollTo({ top: 0, behavior: "smooth" });
            }
        });
    });
}

/* ---------- Initialize Application ---------- */

export async function initApp() {
    if (appInitialized) return;

    appInitialized = true;
    showAppLoading();

    try {
        /*
         * Initialize the authentication UI.
         * auth.js also calls initAuth() automatically;
         * this function is safe to call more than once.
         */
        initAuth();

        /*
         * Initialize reminders first.
         * Guest reminders are stored locally.
         */
        initReminders();

        /*
         * Initialize calendar and its weekday labels.
         */
        renderWeekdayHeaders();

        initCalendar({
            getReminders
        });

        /*
         * Initialize notification settings.
         */
        initNotifications();

        /*
         * Register shared application events.
         */
        setupApplicationEvents();
        setupSidebarNavigation();

        /*
         * Wait for Firebase persistence before listening
         * to authentication changes.
         */
        try {
            await authPersistenceReady;
        } catch (authError) {
            // Defensive fallback for unexpected persistence failures.
            console.error("Firebase persistence setup failed:", authError);
            showAppMessage(
                "Guest mode is available. Some sign-in features may need attention.",
                "info"
            );
        }

        // Keep the auth state listener active even if persistence setup failed.
        setupAuthenticationListener();

        /*
         * Render the initial dashboard.
         */
        refreshDashboard();

        hideAppLoading();

        console.info("RemindMe application initialized.");
    } catch (error) {
        console.error(
            "RemindMe initialization failed:",
            error
        );

        hideAppLoading();

        showAppMessage(
            "The app could not initialize completely. Check the browser console.",
            "error"
        );
    }
}

/* ---------- Start Application ---------- */

if (document.readyState === "loading") {
    document.addEventListener(
        "DOMContentLoaded",
        initApp,
        { once: true }
    );
} else {
    initApp();
}
