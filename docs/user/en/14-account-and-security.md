---
title: Account and security
description: Protect your account with two-factor authentication, get an alert when someone signs in from a new device, sign out of the ones you no longer use and remove other apps' access.
order: 14
status: disponible
group: cuenta
icon: shield
---

# Account and security

All of this is in **Settings › Account**. You need an account: it doesn't show up in demo mode.

## Turn on two-factor authentication

Two-factor authentication is optional. With it, the email code or GitHub isn't enough to sign in: Muninn also
asks you for a six-digit code from an app on your phone (Google Authenticator, 1Password, Authy or whichever you use). If someone
gets hold of your email code, they still can't get into the app without your phone.

In **Two-factor authentication**, press **Turn on**. A window opens (on your phone, from the bottom) with three steps:

1. **Scan:** in your authenticator app, add a new account and scan the QR code with the camera. If you can't
   scan it, press **Enter the key manually**.
2. **Save the key:** it's the same information as the QR code, in letters and numbers. Press **Copy key** and keep it somewhere
   safe (your password manager, for example). If you didn't scan the QR code, type it into your app.
3. **Confirm:** enter the six-digit code the app shows you. You can paste it; on your phone, the keyboard may
   suggest it. As soon as it's complete, Muninn checks it: if it isn't right, it's cleared so you can enter the one
   showing now (it changes every 30 seconds).

When you're done you'll see a green check and your **recovery codes**: ten single-use codes to sign in if one day you don't
have your phone. Press **Copy all** and save them in your password manager: **you won't see them again**. If you close the
window before confirming, nothing is turned on; you can start again whenever you like (with a new QR code).

**Save the setup key too.** If you lose your phone, you can use it to add Muninn to the app on another phone.

## Recovery codes

With two-factor authentication turned on, **Recovery codes** shows how many you have left. Each code works only once.
If you're running low, or you think someone has seen them, press **Generate new codes**: you get ten new ones and the old ones
stop working, including the ones you hadn't used. This can't be undone, so have somewhere ready to save them.

## Sign in with two-factor authentication

Sign in as usual, with the email code or with GitHub. Then Muninn asks you for the code from your app: enter it and
you're in. If you picked the wrong account, press **Use a different account**.

Don't have your phone handy? Press **Use a recovery code** and enter one of the ones you saved. Afterwards, in
Settings › Account, check how many you have left.

It asks you every time you sign in on a new device; as long as the session stays open on that device, it doesn't.

If an app like claude.ai brings you to **Allow access** and you haven't entered the code in that session yet, Muninn asks you for it
first: press **Enter the code** and you'll go back to the permission screen. If, when you grant access, it warns you that the app won't see
your data, remove its access in **Apps with access** and connect it again.

## Turn off two-factor authentication

Press **Turn off**: a window opens asking for the code your app is showing at that moment. Enter it and press
**Turn off**. From then on, the
email code or GitHub is enough to sign in, and your recovery codes stop working. This can't be undone: to turn it
back on, you'll have to add Muninn to your app again (with a new key) and save new codes. You can delete the old Muninn account from your app.

With two-factor authentication turned on, the server won't let any session that hasn't passed the code read or change your data,
even if someone gets hold of your email code.

Apps you connect **with two-factor authentication already on** (like claude.ai) keep seeing your data: when you pressed
**Allow access**, you had already entered the code when signing in. If you connected an app **before** turning it on, it stops seeing your
data: remove its access in **Apps with access** (below) and connect it again once from that app. The same applies if
the app disconnects and reconnects without showing you the **Allow access** screen: each approval is good for a
single connection, so that nobody with just the email code can take advantage of it. Even if you approve it with two-factor
authentication, a connected app can't see or end your sessions or connect GitHub.

To **connect a GitHub repository** to a project you need two-factor authentication turned on, because Muninn will be able to
write to it. If you don't have it, Muninn will tell you when you link it: turn it on here and link it again. Removing a repository
doesn't require it. Finance integrations will require it too when they arrive.

## See where you're signed in

**Sessions and devices** lists every place where you've signed in with your account: the browser or app and the system
("Mac · Chrome", "iPhone · Safari", "Muninn for Windows"), when it was last used and when you signed in. The one
marked **This one** is the device in front of you.

- The desktop app shows up with your computer's name, like "PC-ALEX · Muninn for Windows" (on Windows, the computer's
  name; on a Mac, the one in Settings › General › About). If you signed in with a version older than 0.10, it shows up without the name
  ("Muninn for Windows") until you sign in again.
- In the browser there's no way to know the computer's name: it shows the system and the browser ("Windows · Chrome"). To tell which is
  which, **give it a name** (below).
- Apps you connected to your account get **one row per app**, like "Claude · connected app", with how many sessions it has
  open: each time it reconnects, it opens a new one. **Sign out all** ends them, but if the app still has access it'll reconnect
  on its own. To cut it off completely, use **Apps with access** (below).
- "Program or server" is something that signs in without a browser, like a script of yours or the Muninn MCP on your computer.

If you see one you don't recognize, sign it out.

## Give a session a name

Press the **pencil** on any row and type a name you'll recognize, like "Work laptop" or "iPhone" (up to 40
characters). The row takes that name and below it you still see what it is ("Windows · Chrome"). To remove it, leave it empty.
You can undo it from the notification.

- The name belongs to that session: if the session ends, the name goes with it.
- The name of **this** device is also remembered by the browser: when you sign in here again, the new session gets it back on its own.

## Sign out on another device

Press **Sign out** on its row. That device stops getting your notifications right away and will be signed out in less than an hour (the time
its access takes to expire). To
come back, it'll have to sign in again with the code or with GitHub. This can't be undone, but it doesn't delete anything either: your data
stays in your account.

This device's session has no button there: to sign out here, use **Sign out** (under Sign-in).

## Sign out everywhere at once

At the end of the list, in **Sign out of other devices**:

- **Other devices:** you're signed out of all of them except this one. Handy if you've lost your phone or signed in on someone else's computer.
- **Everywhere:** you're signed out of this one too, and you go back to the sign-in screen.

Either way, the other devices stop getting your notifications right away and are signed out in less than an hour. If you sign
back in on one of them and want notifications, turn them on again in **Settings › Notifications**.

## New device alert

When someone signs in to your account from a device Muninn doesn't recognize, you get an email a few minutes later. It says
which device it was, when, and from which IP address. If it wasn't you, sign it out in **Sessions and devices** (the email
has the link) and turn on two-factor authentication.

Muninn recognizes a device by its **name**: your computer's name in the desktop app, the one you gave it with the pencil
(see "Give a session a name") or a connected app's name, like claude.ai. That's why:

- A session **without a name** always triggers an alert: someone signing in without permission doesn't have one.
- If it was you, **give that session a name** and we won't alert you about it again. The browser remembers it, so the
  next time you sign in from there it won't alert you either.
- Reconnecting an app you already used doesn't trigger an alert every time.
- We send you **at most one email a day**. If there are several sign-ins on the same day, they go in the same email; anything that comes
  later only shows up in the list.

It's on by default. You turn it off in **Sign-in alerts › Email me about new devices**; while
it's off, Muninn keeps recording your devices, so when you turn it back on you don't get a backlog of alerts.

## Remove an app's access

**Apps with access** lists the apps you gave permission to use your account, like claude.ai or Claude Code when you connected
the Muninn MCP ([Connect Claude and others](06-ai-assistants.md)). For each one you can see since when it has had access, its website and
which details from your profile it can see.

Press **Remove access** and that app can no longer use your account, effective immediately: its sessions are ended. This can't be undone
from here; to use it again, connect it again from that app and accept on Muninn's authorization screen.
