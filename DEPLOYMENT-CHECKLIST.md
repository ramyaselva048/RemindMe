# RemindMe Deployment Checklist

## Run locally

1. Extract the ZIP. Open the `RemindMe` folder in VS Code.
2. Start **Live Server** from `index.html` (or run `python -m http.server 8000` from this folder and open `http://localhost:8000`). Do not open the file using `file://`.
3. Test calendar navigation, create/edit/delete/complete reminder, search/filter, test sound, and test browser notification.

## Firebase Google Sign-In and private cloud reminders

This project is already configured to use Firebase project `remindme-smart-calendar` and its Realtime Database. Check the Firebase Console before deployment:

1. **Authentication → Sign-in method:** enable Google.
2. **Authentication → Settings → Authorized domains:** add `localhost` for local testing and your exact GitHub Pages/custom domain for production.
3. **Realtime Database → Rules:** review `firebase-database.rules.json` and publish those rules if they match your intended data structure. They restrict each signed-in user to `/users/{their-auth-uid}/...`. Do not replace existing rules without checking whether other apps share the database.
4. Sign in with Google, create a reminder, refresh the page, sign out, and sign in with a different account. Verify that each account sees only its own cloud reminders.

## GitHub Pages

1. Upload the contents of the `RemindMe` folder to your repository (the `index.html` file should be at the published root).
2. In repository **Settings → Pages**, select the correct branch/folder.
3. Add the published domain to Firebase Authentication's authorized domains.
4. Open the published HTTPS URL and test again.

## Notification limitations

- Sound and reminder checks run while the website is open. Browser throttling may delay checks.
- Browser notifications require permission and a supported browser.
- Service-worker notifications in this build are triggered by the page's scheduler; the service worker does not independently schedule future reminders.
- EmailJS must be configured separately; see `EMAIL-SETUP.md`. Email alerts in this static build require the page to be running.
- For reminders to trigger while the browser is closed, add a secure server-side scheduler and push/email delivery service. A static GitHub Pages site alone cannot guarantee this.
