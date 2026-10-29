# RemindMe Email Alerts Setup

## Important
The website can play its sound and show browser notifications while the page is running. The included email option uses EmailJS and also runs from the open page; it is **not** a background scheduler. If the browser is closed, the static website cannot check reminder times or send emails. Reliable closed-browser email delivery requires a trusted server-side scheduler (for example, Firebase Cloud Functions/Cloud Scheduler). Do not put Firebase Admin credentials or other server secrets in frontend JavaScript.

## Configure the included EmailJS option

1. Create/sign in to an account at https://www.emailjs.com/.
2. Create an email service and connect the sending mailbox.
3. Create an email template with these template variables: `to_email`, `reminder_title`, `reminder_description`, `reminder_date`, `reminder_time`, and `app_name`. Set the template recipient (`To email`) to `{{to_email}}`.
4. Copy your Service ID, Template ID, and Public Key.
5. Open `js/notifications.js` and replace the three placeholder values in `EMAILJS_CONFIG`. The public key is designed for browser use; never add a private key or service-account credential here.
6. Run the site over `http://localhost` (Live Server) or HTTPS. Open Notification Settings, enter the recipient address, enable Email Alerts, then click **Test Email**.
7. After the test arrives, create a reminder a few minutes ahead and keep the website open to test delivery at the due time.

## Security notes

- Restrict EmailJS allowed origins/domains to your development and production website where the EmailJS plan supports it.
- Set rate limits and abuse protection in EmailJS. Do not publish your service credentials beyond the intended public key.
- Email delivery is subject to EmailJS plan limits, browser availability, network access, and email provider filtering.
- For a production service that must send emails with the website closed, use a server-side scheduled worker that authenticates securely and reads each user's reminders. Do not make the Realtime Database publicly readable to enable this.
