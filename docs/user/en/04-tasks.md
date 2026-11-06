---
title: Tasks
description: Create, move and complete tasks; priorities, dates and subtasks.
order: 4
status: disponible
group: tu-trabajo
icon: checklist
---

# Tasks

> **Status:** you can already create, edit, move, complete and archive tasks from the app, and also through
> [AI assistants](06-ai-assistants.md). Archived tasks can be restored or deleted forever from the app.

## Create a task

There are three ways: the **New task** button (or the **N** key), the **+** in a column's header, or **Add task**
at the bottom of the column: type the title, press **Enter** and carry on with the next one.

A task belongs to a project. If you don't pick a column, it goes to the first one of type **To do** ("To do" on the
default board). If you make a mistake, **Undo** in the notification archives it.

## Open and edit a task

Click a card to open it: on a computer a panel opens on the right, on a phone a full screen. It has
its own link, so you can copy it or reload the page. From there you can change:

- **Title** and **description** (saved when you leave the field). The description is written in **Markdown** (bold, lists,
  links, `code`…, as in [notes](05-notes.md#what-you-can-write)): when you leave the field it shows with its formatting; click
  the text or **Edit** to write again. Checkboxes in a task list (`- [ ] something`) can be ticked without going into edit mode.
- **Status** (the column), **priority** (none, low, medium, high or urgent) and **due date**.
- Free-form **labels**: type and press **Enter**.
- **Subtasks** (checklist): tick them, remove them or add more; the card shows the progress, for example 2/3. To
  reorder them, drag them by the ⠿ handle on their left (on a computer it shows up when you hover; on a phone,
  press and hold the handle). With the keyboard: Tab to the handle, Space, arrow keys and Space. Always with **Undo**.
- **Linked notes:** the notes for that task, and **Add note** to create another one already linked (see [Notes](05-notes.md)).
- You see the task's **activity**: who created, moved or changed it, and when.

Every change shows a notification and can be undone.

## Move a task

Drag the card to another column or to another position in the same one. When you move it to a column of
type **Done**, Muninn marks it as completed with the date. If you take it out of there, it's open again.

## Complete, archive and delete

- **Complete:** click the task's checkbox (on Home, in the panel or with **Complete**) and it moves to the "Done" column.
  Click again to **reopen** it.
- **Archive:** hides it from the board without deleting it (the task's **⋯** menu). **Undo** brings it back.
- **Delete:** only archived tasks, from **Archived tasks** (below). AI assistants can't delete tasks.

### Archived tasks

On the board, the project's **⋯** menu has **Archived tasks**: the ones in that project, the last one you archived first, with
the column they were in.

- **Restore** puts it back in its column. **Undo** in the notification archives it again.
- The **trash can** deletes it forever, and **Delete all** does the same with the whole list. There's no confirmation dialog:
  it disappears from the list and you have a few seconds to click **Undo** in the notification. Nothing is deleted until the notification goes away (if
  you close the app before then, nothing is deleted either).
- Its subtasks go with it. Its **notes aren't deleted**: they stay in the project, without a task. And the history records that you
  deleted it.
- If it comes from **GitHub** and its issue is still open, Muninn will bring it back as a new task on the next sync: deleting
  doesn't touch the issue. If you don't want to see it again, close it on GitHub or leave it archived.

## Where each task comes from

Each task remembers its **source**, shown with a badge:

| Source | When |
|---|---|
| Manual | You created it in the app |
| Assistant | Claude or another assistant created it for you |
| GitHub | It comes from a GitHub issue: it carries the issue number, and its title and description are changed there (see [GitHub](09-github.md)) |
| Agent | An automatic agent created it *(coming soon)* |

## Overdue, due today and coming up

On **Home** you see **overdue** tasks, the ones due **today**, what you have **in progress**, what's due in the
**next 7 days** and what you've completed today. You can ask an AI assistant for the same thing, per project.
