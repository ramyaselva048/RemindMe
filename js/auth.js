
/* ==========================================
   RemindMe - Authentication
   Google Authentication + OneSignal
   File: js/auth.js
========================================== */

import {
    auth,
    googleProvider,
    authPersistenceReady
} from "./firebase.js";

import {
    signInWithPopup,
    signOut
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";

/* ---------- State ---------- */

let authInitialized = false;
let isSigningIn = false;
let isSigningOut = false;

/* ---------- DOM Helpers ---------- */

function getElement(id) {
    return document.getElementById(id);
}

/* ---------- Toast ---------- */

function showAuthMessage(message, type = "info") {
    const toast = getElement("toast");

    if (toast) {
        toast.textContent = message;
        toast.className = `toast show ${type}`;
        toast.setAttribute("role", "status");

        clearTimeout(showAuthMessage.timeoutId);

        showAuthMessage.timeoutId = setTimeout(() => {
            toast.classList.remove("show");
        }, 3500);
    } else {
        console.info(`[RemindMe] ${message}`);
    }
}

/* ---------- Button Loading ---------- */

function setLoginLoading(loading) {
    const button = getElement("googleSignInButton");
    const buttonText = getElement("googleButtonText");

    if (button) {
        button.disabled = loading;
        button.setAttribute("aria-busy", String(loading));
    }

    if (buttonText) {
        buttonText.textContent = loading
            ? "Signing in..."
            : "Continue with Google";
    }
}

/* ---------- OneSignal User Linking ---------- */

function linkOneSignalUser(user) {
    if (!user?.uid) return;

    if (!window.OneSignalDeferred) {
        window.OneSignalDeferred = [];
    }

    window.OneSignalDeferred.push(async (OneSignal) => {
        try {
            await OneSignal.login(user.uid);

            console.info(
                "RemindMe: OneSignal user linked successfully."
            );
        } catch (error) {
            console.error(
                "RemindMe: OneSignal linking failed:",
                error
            );
        }
    });
}

/* ---------- OneSignal Logout ---------- */

function unlinkOneSignalUser() {
    if (!window.OneSignalDeferred) {
        window.OneSignalDeferred = [];
    }

    window.OneSignalDeferred.push(async (OneSignal) => {
        try {
            await OneSignal.logout();

            console.info(
                "RemindMe: OneSignal user logged out."
            );
        } catch (error) {
            console.error(
                "RemindMe: OneSignal logout failed:",
                error
            );
        }
    });
}

/* ---------- Update Authentication UI ---------- */

function updateAuthUI(user) {
    const authArea = getElement("authArea");
    const userProfile = getElement("userProfile");
    const userPhoto = getElement("userPhoto");
    const userName = getElement("userName");
    const signInButton = getElement("googleSignInButton");

    if (user) {
        if (authArea) {
            authArea.hidden = true;
        }

        if (signInButton) {
            signInButton.hidden = true;
        }

        if (userProfile) {
            userProfile.hidden = false;
        }

        if (userName) {
            userName.textContent =
                user.displayName ||
                user.email ||
                "RemindMe User";
        }

        if (userPhoto) {
            if (user.photoURL) {
                userPhoto.src = user.photoURL;
                userPhoto.alt = user.displayName || "Profile photo";
                userPhoto.hidden = false;
            } else {
                userPhoto.removeAttribute("src");
                userPhoto.alt = "";
                userPhoto.hidden = true;
            }
        }
    } else {
        if (authArea) {
            authArea.hidden = false;
        }

        if (signInButton) {
            signInButton.hidden = false;
        }

        if (userProfile) {
            userProfile.hidden = true;
        }

        if (userName) {
            userName.textContent = "";
        }

        if (userPhoto) {
            userPhoto.removeAttribute("src");
            userPhoto.hidden = true;
        }
    }
}

/* ---------- Google Sign In ---------- */

async function handleGoogleSignIn() {
    if (isSigningIn) return;

    isSigningIn = true;
    setLoginLoading(true);

    try {
        await authPersistenceReady;

        const result = await signInWithPopup(
            auth,
            googleProvider
        );

        updateAuthUI(result.user);

        // Link the signed-in Firebase user to OneSignal.
        linkOneSignalUser(result.user);

        showAuthMessage(
            `Welcome ${result.user.displayName || "back"}!`,
            "success"
        );

    } catch (error) {
        console.error("Google sign-in failed:", error);

        let message = "Google sign-in failed. Please try again.";

        if (error.code === "auth/popup-closed-by-user") {
            message = "Sign-in was cancelled.";
        } else if (error.code === "auth/popup-blocked") {
            message = "Allow popups for this website and try again.";
        } else if (error.code === "auth/unauthorized-domain") {
            message = "Add this website domain in Firebase Authentication settings.";
        } else if (error.code === "auth/operation-not-allowed") {
            message = "Enable Google sign-in in Firebase Authentication.";
        } else if (error.code === "auth/network-request-failed") {
            message = "Network error. Check your internet connection.";
        }

        showAuthMessage(message, "error");

    } finally {
        isSigningIn = false;
        setLoginLoading(false);
    }
}

/* ---------- Sign Out ---------- */

async function handleSignOut() {
    if (isSigningOut) return;

    isSigningOut = true;

    const button = getElement("signOutButton");

    if (button) {
        button.disabled = true;
    }

    try {
        await signOut(auth);

        // Disconnect the OneSignal external user.
        unlinkOneSignalUser();

        updateAuthUI(null);

        showAuthMessage(
            "Signed out successfully.",
            "success"
        );

    } catch (error) {
        console.error("Sign-out failed:", error);

        showAuthMessage(
            "Unable to sign out. Please try again.",
            "error"
        );

    } finally {
        isSigningOut = false;

        if (button) {
            button.disabled = false;
        }
    }
}

/* ---------- Initialize Authentication ---------- */

export function initAuth() {
    if (authInitialized) return;

    authInitialized = true;

    const signInButton = getElement("googleSignInButton");
    const signOutButton = getElement("signOutButton");

    if (signInButton) {
        signInButton.addEventListener(
            "click",
            handleGoogleSignIn
        );
    } else {
        console.warn(
            'Element "googleSignInButton" was not found.'
        );
    }

    if (signOutButton) {
        signOutButton.addEventListener(
            "click",
            handleSignOut
        );
    }

    /*
     * Listen for Firebase authentication changes.
     */
    document.addEventListener(
        "remindme:auth-state-changed",
        (event) => {
            const user = event.detail?.user || null;

            updateAuthUI(user);

            if (user) {
                linkOneSignalUser(user);
            }
        }
    );

    /*
     * Restore existing Firebase session.
     */
    updateAuthUI(auth.currentUser || null);

    if (auth.currentUser) {
        linkOneSignalUser(auth.currentUser);
    }
}

/* ---------- Automatic Initialization ---------- */

if (document.readyState === "loading") {
    document.addEventListener(
        "DOMContentLoaded",
        initAuth,
        { once: true }
    );
} else {
    initAuth();
}
