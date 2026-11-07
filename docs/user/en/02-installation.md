---
title: Installation
description: Install Muninn on your computer and your phone.
order: 2
status: parcial
group: primeros-pasos
icon: download
---

# Installation

## Desktop

Download the installer for your system from the [releases page](https://github.com/lopezz-dev/muninn/releases) (the one at
the top is the latest). It's under **Assets** in each release:

| System | File |
|---|---|
| Windows 10 and 11 | `Muninn_x.y.z_x64-setup.exe` |
| macOS (Intel and Apple Silicon) | `Muninn_x.y.z_universal.dmg` |
| Linux | `.AppImage` (portable), `.deb` (Debian/Ubuntu) or `.rpm` (Fedora) |

### Windows

1. Download the `-setup.exe` and open it. It installs just for your user: it doesn't ask for administrator permissions.
2. The first time, Windows may show **"Windows protected your PC"**, because the installer doesn't have a Microsoft certificate.
   Click **More info** and then **Run anyway**.
3. Open Muninn from the Start menu.

### macOS

Open the `.dmg` and drag Muninn to **Applications**. Until Muninn is signed by Apple, macOS won't let you open it
the first time. On macOS 15 (Sequoia) or later, try to open it, close the warning and go to **System Settings › Privacy &
Security**: at the bottom you'll see Muninn with an **Open Anyway** button. On earlier versions, just **right-click → Open**.

### Updates

You don't have to download anything again. Every time you open Muninn it checks for a new version; if there is one, it downloads it without
interrupting you and lets you know at the top with **A new version is available · Restart**. Click **Restart** whenever suits you: it
installs and Muninn opens again. If you'd rather keep going, close the notice: it'll offer it again the next
time you open Muninn.

Muninn only installs versions signed by the project. When you're offline it doesn't check anything and doesn't bother you. On Linux,
automatic updates work with the `.AppImage`; with `.deb` or `.rpm`, install the new version by hand.

The version you have shows at the top of the sidebar, next to the Muninn name, and on your phone in **About Muninn**, in your account sheet (tap your photo, bottom right).

## In the browser

There's nothing to install: open [muninn-sepia.vercel.app](https://muninn-sepia.vercel.app) in any browser and sign in with your
account. It's the same address you use to install it on your phone.

## iPhone

Muninn installs from Safari like any other app, without going through the App Store:

1. Open [muninn-sepia.vercel.app](https://muninn-sepia.vercel.app) in **Safari**.
2. Tap the **Share** button (the square with the arrow).
3. Choose **Add to Home Screen**.
4. Open Muninn from the new icon, the raven on an amber background.

> **Notifications on your phone:** with Muninn installed this way (iOS 16.4 or later), turn on notifications in **Settings › Notifications** to
> hear about each charge before it happens. Step by step in [Notifications](13-notifications.md).

## Android

Open [muninn-sepia.vercel.app](https://muninn-sepia.vercel.app) in Chrome and tap **Install app** in the menu (⋮).

## Signing in

With an account, your projects, tasks and notes are saved and you see them on all your devices. There are no
passwords: you sign in with a code sent to your email.

1. Open Muninn. If you haven't signed in, you'll see the **Sign in to Muninn** screen.
2. Enter your email and click **Send code**.
3. Open the email from Muninn, copy the code and type it into **Code**. Click **Sign in**.

The first time, this creates your account. The code expires in an hour. If it doesn't arrive, check your spam
folder or click **Resend code** (you can request one per minute). If you got the
address wrong, click **Use a different email**.

Use the same email on your computer and your phone to see the same things on both.

### The anti-robot check

To stop anyone from creating accounts in bulk, Muninn checks that you're a person before sending you the code.
Most of the time you won't see anything: it passes on its own in a second. Meanwhile the button says **Checking…**. Sometimes
it'll ask you to tick a box below the form.

If it says **Couldn't complete the anti-robot check**, check your connection and click **Retry**.
Some very strict ad blockers block it: allow `challenges.cloudflare.com` in them.

### With GitHub

Click **Continue with GitHub**: it takes you to GitHub to grant permission and brings you back to Muninn signed in. If the
button doesn't show up, it isn't turned on yet.

In the desktop app, GitHub opens in your browser. Grant permission there; the browser will ask if you want to
open Muninn: accept and you're back in the app, already signed in. While you wait, the button says **Waiting for GitHub…** and you can
click **Cancel**. If you don't come back within five minutes, Muninn stops waiting and lets you know.

> **Coming soon:** signing in with a **passkey** (Face ID, Touch ID or Windows Hello). Until then, sign in
> with the email code or with GitHub.

### Try it without an account

On the sign-in screen, click **Demo mode**. You can use the whole app, but whatever you create lives in
the browser's memory and **is lost when you reload**. To leave, go to **Settings › Account** and click
**Leave demo mode**.

### Signing out

Go to **Settings › Account** and click **Sign out**, or search for "sign out" with **⌘K** / **Ctrl K**. You're
signed out only on that device: your data stays in your account and you stay signed in on your other
devices. To sign out on other devices, see [Account and security](14-account-and-security.md).

When you reload the page or open the app again, you stay signed in: you don't have to sign in every time.
