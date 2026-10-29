# 💜 RemindMe — Smart Calendar & Reminder Website

**Make Every Moment Count.**

A responsive calendar and reminder app built with HTML, CSS, JavaScript ES modules, Firebase Google Authentication, and Firebase Realtime Database. Theme: Midnight Plum and Champagne Gold.

## Features

- Monthly calendar with previous/next month navigation, today highlight, date selection, and reminder indicators.
- Create, edit, delete, complete, and reopen reminders.
- Title, description, date, time, category, repeat schedule, and sound option.
- Search and filter reminders; dashboard statistics.
- Google Sign-In through Firebase Authentication.
- Guest reminders saved in localStorage; signed-in reminders saved under that user's Firebase UID.
- Reminder chime, browser notifications, notification settings, and test buttons.
- Browser notification messages and reminder sound alerts (no email integration).
- Responsive layout, service worker cache, and PWA manifest/icons.

## Quick start

1. Extract the ZIP and open the `RemindMe` folder in VS Code.
2. Start the site with the Live Server extension, or run `python -m http.server 8000` from this folder and visit `http://localhost:8000`. Use localhost/HTTPS; do not use `file://`.
3. Click **Continue with Google** to test cloud storage. Guest mode can be used without signing in.
4. To configure Firebase, review the existing values in `js/firebase.js`, enable Google Sign-In, add your website domain to Firebase's authorized domains, and publish reviewed Realtime Database rules from `firebase-database.rules.json`.
5. For deployment, follow `DEPLOYMENT-CHECKLIST.md`.

## Firebase data isolation

Cloud reminders are stored at `users/{uid}/reminders/{reminderId}`. The supplied `firebase-database.rules.json` allows a signed-in user to read/write only their own `/users/{uid}` subtree. Review it before publishing, especially if this database is shared with other projects. Never publish service-account credentials or Firebase Admin secrets in this frontend repository.

## Notification behavior

The sound/browser notification scheduler checks due reminders while the page is running, typically every 15 seconds with a short grace window. Browser permissions and autoplay restrictions apply. The service worker supports caching and notifications requested by the page; it does not independently wake up to run a reminder schedule.

Browser notifications and sound are checked while the page is running. The service worker can display a notification requested by the page, but it does not independently wake up to run a reminder schedule. Allow notifications in Chrome and keep the website open for scheduled alerts.

## Project structure

```text
RemindMe/
├── index.html
├── manifest.json
├── service-worker.js
├── README.md
├── EMAIL-SETUP.md
├── DEPLOYMENT-CHECKLIST.md
├── firebase-database.rules.json
├── css/
│   ├── style.css
│   ├── calendar.css
│   ├── reminders.css
│   └── responsive.css
├── js/
│   ├── app.js
│   ├── firebase.js
│   ├── auth.js
│   ├── calendar.js
│   ├── reminders.js
│   ├── storage.js
│   └── notifications.js
└── assets/
    ├── images/
    └── icons/
```

## Theme palette

- Background: `#171322`
- Cards: `#262038`
- Accent: `#E8C879`
- Main text: `#FFF9ED`
- Secondary text: `#B8AECF`

## Useful links

- Firebase Console: https://console.firebase.google.com/
- EmailJS: https://www.emailjs.com/
- GitHub Pages: https://pages.github.com/


## Black & Gold Update
- Black background with gold accents and uppercase typography.
- Calendar renders only dates belonging to the selected month (with blank weekday alignment slots).
- Sidebar Upcoming and Completed navigation filters the reminder list into focused views.
- Logo and app icon assets have been recolored to a black-and-gold palette.

Note: browser notifications and sound still depend on browser permission and the page's runtime; reliable notifications after closing the website require a separate push service and scheduler.
