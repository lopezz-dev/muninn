---
title: Your data and privacy
description: Where your information is stored and who can see it.
order: 7
status: disponible
group: cuenta
icon: shield
---

# Your data and privacy

## Where it's stored

- **In the cloud (Supabase):** your projects, tasks and notes, your finances (accounts, transactions, categories and subscriptions),
  your News sources and articles and your settings are stored in a Postgres database, which lets them sync
  across devices.
- **Only on your device:** your conversations with the [Assistant](11-assistant.md) and the images you show it stay on that
  device and don't travel to your account (what the assistant changes does, like any other change).
- **Only on your device, without an account:** if you connect Claude or another assistant **directly on your computer** without setting up your
  account (the advanced option in [Connect Claude and others](06-ai-assistants.md#setup-advanced)), the data it handles goes
  to a local file (`~/.muninn/data.json`) and doesn't leave your computer. It isn't the same data you see in the app.
- **Your own server:** Muninn is designed so it can be hosted on your own server in the future.

> **Right now, in the app:**
>
> - **With an account:** your data is stored in Supabase, on a server in the European Union (Paris). Your
>   appearance (glass and accent color) and the modules you have turned on also go with your account. What you
>   change on one device shows up on the others right away, no reload needed.
> - **In demo mode:** what you create lives in the browser's memory and is lost when you reload. Only the
>   appearance is saved, on this device.

## News

To bring you new articles even when your computer is off, the Muninn server **downloads your RSS feeds** every
hour (and when you press **Refresh**). The websites you follow see that download as a visit from the server, not from you. The summary of what's
important, on the other hand, is made by the model on your computer (see [News](12-news.md)).

## Offline

With an account, Muninn keeps **on that device** a copy of the last things you saw (projects, tasks, notes, finances, news and
settings) so it opens
instantly and you can look things up even without a connection. Offline, the app is **read-only**: you'll see the "Offline · read-only"
notice and, if you try to change something, Muninn lets you know and leaves it as it was. When you're back online, it updates by itself.

That copy is private: it's cleared from the device when you **sign out**, it expires after 7 days without opening the app, and only your account
can retrieve it. In demo mode nothing is saved.

> **Coming soon:** creating and editing offline, with changes sent when you're back online.

## Your session

- You sign in with a code sent to your email, or with GitHub. Muninn doesn't store passwords.
- Your session is saved in the browser or in the app on that device, so you don't have to sign in every
  time. **Sign out** (in Settings › Account) clears it from that device. There you can also see which other
  devices it's open on and sign them out: [Account and security](14-account-and-security.md).
- Before sending you the code, Cloudflare Turnstile checks that you're not a robot. It doesn't use advertising
  cookies or follow you around other websites; Muninn only gets a "yes" or a "no".
- If you sign in with GitHub, Muninn only gets your name, your email and your profile picture, to show them in the app.
- When you sign out, the app forgets what it had loaded: nobody who later signs in on that device with another
  account will see your data.

## Who can see it

- Each row in the database belongs to a user, and the database itself stops anyone
  else from reading or changing it (*Row Level Security*). It's not just a check in the app.
- AI assistants only see what you ask for through Muninn's tools, and they can never delete data.

## Activity history

Muninn keeps a log of changes (what was created, moved or completed, and whether you did it, an
assistant, GitHub or an agent). It's used for summaries ("what did I do this week?") and it can't be edited.
