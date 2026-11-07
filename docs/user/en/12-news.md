---
title: News
description: Follow your blogs and websites via RSS and get a summary every morning, made on your computer.
order: 12
status: parcial
group: modulos
icon: news
---

# News

**News** brings together in one place what the blogs and websites you follow publish (via **RSS**) and prepares a daily summary
with what matters most. Turn it on in **Settings › Modules › News**.

> **Status:** downloading articles already works: every hour and when you press "Refresh". The **daily summary** needs the
> assistant's model installed on your computer; without it, you see the articles but not the summary.

## Add a source

The quickest way: **Official sources** (in the **Sources** panel, or on the empty screen) opens a list of feeds published by
the outlet or organization itself, by topic: current affairs (RTVE, El País, Europa Press…), institutions (BOE, La Moncloa, Banco de
España, WHO), economy, technology, AI, development and science. Press **Add** on the ones you want and they're saved with their topic,
so each topic gets its own tab.

If the one you're looking for isn't there, in the **Sources** panel paste the feed's address (it usually ends in `rss`, `feed` or `atom.xml`) into **Add RSS**,
give it a **topic** if you like (for example "Rust" or "Local AI") and press **Add source**. If you make a mistake, **Undo**.

- The switch **pauses** a source: it stops being downloaded, but you keep what already arrived.
- The archive button **removes** it. Its saved articles stay. If you add it again, it comes back.
- If a source fails (it doesn't exist, it isn't a feed…), you'll see the reason in red under its name.

## How articles arrive

The **Muninn server** downloads your sources **every hour**, even when your computer is off. **Refresh** downloads them
right then. Articles are kept for **30 days**; the ones you mark with **Read later**, forever.

## Reading

- At the top, **What matters today**: the daily summary.
- The tabs filter by **topic** and **Saved**; the search box, by text: it looks at the title and the summary, ignoring capitals
  and accents, and if you type several words you get the articles that have all of them, in any order. You can also search from
  **Ctrl K / ⌘ K** with **Search News**.
- In **All**, if a source publishes lots of articles in a row, you see the first 3 and the rest stay under **Show N more from …**,
  in their place. That way sources that publish little don't get lost underneath.
- Press the **source's name** on an article to see only its articles; **Only … ✕** removes the filter.
- If an article is about one of your projects, it shows **Related to …**.
- Each article has **Create task** (opens "New task" with the title and the link), **Save as note**, **Read later**
  and **Open** (in your browser, also from the desktop app; it gets marked as read). The title does the same; on
  your phone, the title first lets you choose between opening or copying the link.

## The daily summary

It's written by **your computer's model** (the same one as the [Assistant](11-assistant.md)), so what interests you never leaves
home. It's made automatically the first time you open News each day **on the computer where Ollama is**; you can also press
**Summarize** or **Redo** (with "Undo" to go back to the previous one). It's saved in your account, so you see it the same way on your iPhone.

The summary shares its space among your sources: even if one publishes fifty articles a day, the others get in too.

If you don't open Muninn on your computer that day, there won't be a new summary: you'll still see the articles.

> **Coming soon:** listening to the summary out loud.
