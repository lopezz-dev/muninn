---
title: Notes
description: Notes you read and edit in the same place, with comments, organized in folders and linked to projects and tasks.
order: 5
status: disponible
group: tu-trabajo
icon: notes
---

# Notes

Notes are for everything that isn't a task: ideas, meeting minutes, project documentation…
You read and edit them in the same place, already formatted, and they save themselves as you type. Under the hood they're **Markdown**,
so Claude and the other assistants can read and write them with no trouble.

> **Demo mode:** without an account, your notes only live in memory and disappear when you reload the page.

## Where they are

On your computer, **Notes** is in the sidebar: the list on the left and the open note on the right. On your phone
it's under **Go to › Notes**, in your account sheet (or in the bottom bar, if you put it there). When you open a note it fills the screen, and the arrow at the top takes you back to the list.

Each note has its own link, so you can copy it or reload the page without losing your place.

## Folders and pages inside others

Notes are organized in a **tree**, like the table of contents of this help. Each project is a **space** with its notes, and the
ones that don't belong to any project go in **General**. Inside each space, a page can have **pages inside**, at
any level, and a **folder** is a page meant to group others (it can have text or not).

- **Create inside:** hover over a note and press **+**, or use **⋯ › New page inside** or **New folder inside**.
  The **+** in a space's header creates a page at its top level.
- **Move:** drag a note **onto another** to put it inside, or onto its **top or bottom edge** to place it
  next to it. Drop it on a **space's header** to take it to its top level, even in another project. It always
  moves with everything inside it, and the notification comes with **Undo**. On your phone, press and hold the note before dragging.
- **Collapse:** the arrow on a note with pages inside hides or shows them; it's remembered in this browser.
- **Folder or page:** **⋯ › Turn into a folder** (or into a page) only changes how it looks.
- **Archive:** **⋯ › Archive**, from the tree or from the note itself, removes it from the list with everything inside it.
  The notification comes with **Undo**; if it was the open note, you go back to the list and **Undo** brings you back to it.

When you open a note, at the top you see **where it is** (Notes › space › the notes that contain it), and at the bottom its **pages inside**
and the **previous** and **next** ones in the tree. When you search or filter by **Pinned**, the list leaves the tree and shows the
results.

## Create a note

Press the **+** in the list (or **New note** if you don't have any yet) and type the title. If you have a project
filtered, the note is created in that project. If you made a mistake, press **Undo** in the notification: the note is archived.

You can also create one from a task, with **Add note** in its panel: it's created linked to that task.

## Writing

**On your computer** you read and edit the note in the same place: click the text and type. There's no edit mode
and no preview.

- **Top bar:** the block type (**Text** or **Heading 1, 2 and 3**), **bold**, *italic*, ~~strikethrough~~, code, link,
  bulleted or numbered lists, task list, quote, code block, **table**, and **Undo** and **Redo**. With the cursor
  inside a table, its button adds or removes rows and columns.
- **When you select text** a bar appears above it with bold, italic, strikethrough, code, link and **Comment**.
- **Shortcuts:** **Ctrl B** bold, **Ctrl I** italic, **Ctrl E** code, **Ctrl K** link (with text selected), **Ctrl Z**
  undo and **Ctrl Shift Z** redo (on a Mac, ⌘ instead of Ctrl). **Ctrl Alt M** (⌘ ⌥ M) comments on the selection.
- **Write like in Markdown:** `## ` at the start of a line makes a heading, `- ` a list, `1. ` a numbered list,
  `[ ] ` a task (also after `- `), `> ` a quote, and three backticks a code block.
- **Links:** with the cursor inside a link you see its address, with **Open link**, **Edit link** and **Remove link**. **Ctrl click** opens it
  directly.

**On your phone** the note opens **for reading**: you can scroll, select, copy and **comment** without the keyboard popping up,
and tick the task checkboxes. To change something, tap the **pencil** at the top; with **✓** you go back to reading.

Prefer raw Markdown? **⋯ › Edit as Markdown** opens the text as it is, with its usual bar; **⋯ › Back to the
editor** takes you back.

At the top you'll see **Saved**, **Saving…** or **Not saved**: Muninn saves shortly after you stop typing, when you leave
the text, when you switch notes and when you hide the window. If it fails, it lets you know and you can **Retry**. Opening a note never
changes it: only what you write gets saved.

### What you can write

Headings, **bold**, *italic*, ~~strikethrough~~, bulleted or numbered lists (also nested), task lists,
quotes, inline code and code blocks, tables, dividers and links.

**Tables** that don't fit (on your phone, for example) scroll sideways inside the note.

For security:

- Any **HTML** in a note shows up as text and is saved as it is: it isn't interpreted.
- **Links** can only go to web pages (`http`/`https`), email (`mailto:`) and phone numbers (`tel:`).
- **Images** don't load: you'll see their alt text, and the image is kept in the Markdown.

## Comments

Select a piece of text and press **Comment** (or **Ctrl Alt M**). Write your comment and press **Comment**
(or **Ctrl Enter**). The text gets **underlined**; hover over it or tap it to open its thread.

- **Where you see them:** if the note has room, threads go **in the right margin**, each one next to its text. If not (a
  narrow window, your phone), they open in a panel. The counter at the top (the speech bubble with a number) opens the note's **list of
  comments**.
- **Reply, resolve and reopen:** each thread has its own box to reply and the **Resolve** button. A resolved thread is no longer
  underlined; you'll find it in the list, under **resolved**, with **Reopen**. From **⋯ › Remove thread** you remove it. Everything lets you know and can be
  **undone**.
- **If you change the text:** the underline follows its text even if you write before or after it. If you delete or completely change what
  you commented on, the thread moves to **No longer in the text**, with the quote crossed out: it isn't lost, and if the text comes back, it finds its place again.
- Comments **aren't written into the note**: the Markdown stays clean, for the assistants too.

### For Claude

When you comment, turn on **For Claude** and the thread becomes a **request** ("summarize this", "check these numbers"…). It's meant
mostly for your phone: you leave the request while you're out, and Claude handles it when you ask through the [Muninn MCP](06-ai-assistants.md)
(for example, "check the comments for you").

Claude reads the open requests, changes the note if needed, **replies in the thread** with what it did and resolves it: you'll see it
as **Resolved by Claude**, and you can **Reopen** it if you're not happy with it. If something isn't clear, it asks you in the thread and leaves it
open.

> **Coming soon:** Claude checking the requests on its own, every so often, without you having to ask.

## Link a note

Under the title, choose the note's **project** and, if you want, a **task** from that project. The arrow next to the task
opens it. From a task's panel you see its **Linked notes**.

If you move a note to another project, it's unlinked from its task (the task belonged to the previous project), goes to the top level
of that space and takes its pages inside with it. Each change lets you know and can be undone.

## Pin, search and filter

- **Pin** (the pushpin): pinned notes also show up at the very top, in their own group, so you have them at hand.
- **Search:** the field in the list searches the title and the text, ignoring capitals and accents. If you type several
  words, the note must have all of them.
- **Filters:** **All**, **Pinned** and a chip for each project that has notes.

## Archive and restore

With **⋯ › Archive note** the note leaves the list, with all its pages inside, but it isn't deleted. **Undo** in the notification brings it back. If you open the
link to an archived note, you can press **Restore note**. You can't delete notes from the app yet, and the
AI assistants can't either.

## With AI assistants

Claude and other [assistants](06-ai-assistants.md) can create, read, search and edit your notes for you; what they write
shows up here just like yours.

They can also **put one note under another** (a parent note with its children) and move them, to split a long text into
parts, and you'll see it in the tree right away. And they can read the **comments**, reply to them and resolve them (see
[For Claude](#for-claude)); they never delete one.

If you turn on the [morning report](11-assistant.md#morning-report), every day it leaves you a **pinned note** with your
tasks, upcoming charges and the news summary.

## On all your devices

With an account, what you write or change on one device (comments too) shows up on the others right away, no reload needed.

You can also find a note from search (**⌘K** / **Ctrl K**): type part of the title or the text. And to
start one without going to Notes, search for "new note".

> **Coming soon:** links between notes.
