---
title: Notifications
description: Get a notification on your phone before each charge, even when Muninn is closed.
order: 13
status: parcial
group: cuenta
icon: bell
---

# Notifications

Muninn can notify you on your phone (or your computer) **before a subscription charges you**, even when you don't have the app
open. Notifications are turned on **on each device**: the permission belongs to that browser or that installed app.

## Turn on notifications

1. Open **Settings › Notifications**.
2. Turn on **Notifications on this device**.
3. The browser asks whether you'll let Muninn send you notifications: click **Allow**.
4. To check it, click **Send test**: within a few seconds you'll get "Notifications work on this device".

You need an account: in demo mode there's no server to notify you.

## On iPhone

On iPhone and iPad, notifications **only work with Muninn installed** on your Home Screen (iOS 16.4 or later). In Safari,
without installing it, Settings explains how to do it instead of showing the switch:

1. In Safari, tap **Share** › **Add to Home Screen** (more detail in [Installation](02-installation.md#iphone)).
2. Open Muninn **from the icon**.
3. Go to **Settings › Notifications** and turn notifications on. The permission can only be requested by tapping the switch.

If you remove Muninn from your Home Screen, that iPhone stops getting notifications and drops off the list of devices on its own.

## What it notifies you about

- **Before each charge:** every morning (around 8 or 9, Madrid time), one notification for each subscription charged within
  its **notice days**, for example "Spotify charges you tomorrow · €9.99". You choose the notice days for each subscription
  ([Finance](10-finance.md)); by default, 3. Tapping the notification opens **Finance › Subscriptions**, where you log the charge or skip it.
- Each charge notifies you **only once**. Once you log it or skip it, the next charge will notify you when it's due.
- Charges that are already overdue don't notify you on your phone: they stay in **Home › Upcoming charges** until you log them or skip them.

## Your devices

In **Settings › Notifications › Devices** you see all the ones that get your notifications, with the name of the device and the browser
("iPhone · App", "Mac · Chrome") and when it was last seen. The one you're using is marked **This one**.

- To stop getting notifications on one, click the trash can. If you make a mistake, **Undo** brings it back.
- When you **sign out**, that device stops getting your account's notifications.

## If something isn't working

- **"Notifications blocked":** at some point you chose **Don't allow**. The browser won't ask again: allow it in its settings
  (on iPhone: **Settings › Notifications › Muninn**) and come back to Muninn.
- **"This browser doesn't support notifications":** the desktop app doesn't have notifications yet; use your phone or the browser on your computer.
- **"Notifications not set up":** this Muninn installation is still missing the notification key on the server. You don't have to do
  anything; once it's there, the switch will show up.

## What isn't here yet

- Notifications when an agent finishes its work or when a task is due: they'll come later.
- Choosing the notification time or muting them by type: for now, it's all or nothing on each device.
