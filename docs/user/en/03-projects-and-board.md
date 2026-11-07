---
title: Projects and board
description: Organize your work into projects with a Kanban made to fit you.
order: 3
status: parcial
group: tu-trabajo
icon: projects
---

# Projects and board

> **Status:** you can already create and edit projects (name, description, color, logo and cover), move tasks by dragging them,
> customize the columns (including their color) and view the board as a list or a calendar. In demo mode, without an
> account, nothing you do is saved (see [Getting around Muninn](08-getting-around.md)).

## Projects

A project groups the tasks and notes for something you're working on: an app, a client, a move…

On the **Projects** screen (in the sidebar, or in the tabs on your phone) each project has its own card with:

- Its **logo**, its **cover** and its **color**. On a computer or tablet the cover is the card's banner, with the
  logo on top; on a phone you see the logo. Without a cover, the banner is a gradient of its color; without a logo, you'll see the
  first letter of its name on its color.
- The **description**, if it has one. If not, on a computer you can click **+ Add a description**.
- A **color bar** showing how many tasks are in each state (backlog, to do, in progress, in review and done).
- **Alerts** at a glance: overdue tasks, tasks in progress, tasks with the agent and the GitHub
  repository. If there's nothing to look at, it says **Up to date**.
- **Up next:** the two tasks due soonest (one on a phone).
- When the **last activity** was, and a **+ Task** button to create one right in that project.

At the top you see how many projects you have, how many open tasks and how many overdue. You can filter (**All**, **With
overdue** and, with GitHub turned on, **With GitHub**), sort by **Urgency**, **Recent activity** or **Name**, and search
by name on a computer (ignoring capitals and accents, and with several words in any order). At the bottom,
**Archived** holds the projects you archived: open it and click **Restore** to bring one back, or the trash can to **delete it forever** (**Delete all** empties the list). Deleting a
project also deletes its columns and tasks; its notes stay, without a project. You have a few seconds to click
**Undo** in the notification; after that it can't be recovered. If you close Muninn before they're up, nothing is deleted.

Click a card to open its board.

### Create a project

Click **New project** (in Projects or on Home), the **+** in the sidebar, or search for "new project" with **⌘K** /
**Ctrl K**. Enter the **name** and, if you like, a **description**, pick a **color**, a **logo** and a **cover**, and
click **Create project**: its board opens with five columns. If you make a mistake, **Undo** in the notification archives it.

### Edit a project

Click the pencil on its card (**Edit** on a phone) or, on the board, **⋯ › Edit project**. You can change the
name, description, color, logo and cover. Each change shows a notification when it's saved and has **Undo**.

About the **logo** and the **cover**:

- The **logo** is the project's icon: a square image works best. If it has a transparent background, it shows on the project's
  color. When you pick it, Muninn takes its main color and sets it as the project color (the **From the logo** swatch), unless
  you'd already picked another color by hand. You can change it whenever you like. A black-and-white logo doesn't suggest a color.
- The **cover** is the card's banner on a computer or tablet: a landscape image works best. It's optional; without it,
  the banner uses the project's color.
- They can be photos or JPG, PNG or WebP files. Muninn shrinks them on your device before uploading them, so it doesn't matter
  if it's a big photo from your phone.
- **Remove** leaves the project without that image; **Undo** in the notification brings it back.
- Only you can see them: they're saved in your account, privately. When you're offline, you'll see the first letter and the color instead.
- In demo mode they're lost when you reload, like everything else.

From here you can also **archive** the project.

If an [AI assistant](06-ai-assistants.md) creates the project for you, it can give it a description, but not a logo or a cover.

### The project menu

On the board, the **⋯** menu at the top has:

- **Edit project:** name, description, color, logo and cover.
- **New column:** adds a column at the end.
- **Copy link:** copies the board's address, to open it directly or save it.
- **Archived tasks:** the tasks you archived in this project, to restore them or delete them forever (see
  [Tasks](04-tasks.md#archived-tasks)).
- **Archive project:** it disappears from the lists, but it isn't deleted. **Undo** in the notification brings it back, and so does
  **Projects › Archived**. If it was linked to a GitHub repository, it isn't anymore (the notification tells you): that way you
  can link that repository to another project. **Undo** tries to link it again; if it asks for two-factor authentication,
  link it yourself in **GitHub**.

### Link a GitHub repository

Optional, from **Settings › GitHub**: each project can go with one repository, and its issues show up as tasks
in the project and stay up to date on their own (see [GitHub](09-github.md)).

## The board

Each project has its own Kanban board. When you create it, it starts with five columns:

**Backlog → To do → In progress → Review → Done**

### Customize the columns

From each column's **⋯** menu you can **edit it** (name, type, color and limit), **move it** left or
right and **delete it**. With **Column**, at the top next to **New task** (or in the project's **⋯** menu), you create a new one
at the end. You can also reorder them by dragging the handle in their header.

On a computer, the columns share the width of the screen and each one scrolls on its own when it has lots of
tasks: that way you see the whole board at a glance.

The **limit** is the number of tasks you want to have at once in that column (handy so you don't have too many things
"in progress"). When you reach it, the counter turns amber, and red if you go over it. It's just a heads-up: Muninn doesn't
stop you from moving more cards.

Each column also has a **type**, which tells Muninn what it means, whatever you call it:

| Type | Means |
|---|---|
| Backlog | Ideas or unplanned work |
| To do | Planned, not started yet |
| In progress | Working on it |
| Review | Waiting for review or sign-off |
| Done | Finished |

Thanks to the type, if you call your last column "Published", Muninn knows that what's there is finished
and counts it that way in summaries.

Each column's color dot is its type's color, unless you pick another one in **Color** (the first swatch,
**Automatic**, goes back to the type's color). You see that color on the board, in the tabs on your phone, in the List and in the calendar.

### Delete a column

If the column has tasks, you choose which column they go to (**Delete and move its tasks to…**). A project always needs
at least one column. There's no confirmation dialog: click **Undo** in the notification and the column comes back, with its tasks.

## Board, list or calendar

Above the board you have **Board · List · Calendar** (on your phone, their three icons next to "‹ Projects"). The list shows the same tasks, grouped by column, one per row:

- The **checkbox** on each row completes the task (or reopens it if it's already done), with its notification and **Undo**.
- Clicking the title opens the task, just like on the board. To move it to another column, do it from the task.
- Each group collapses when you click its header and has its own **Add task** at the bottom (except "Done").
- You can't drag in the list: to reorder cards, go back to the board.
- Filters apply to all three views.
- Muninn remembers the view you chose **for each project and on each device**: you can have the list on your phone and the
  board on your computer.

## The calendar

The calendar puts each task on the day it's due. It always opens on today.

### On a computer

- **Month or week.** Choose with **Month · Week**. The ‹ › arrows change the month (or week) and **Today** takes you back to today.
  Muninn remembers whether you left it on month or week.
- **Each task is a pill** with its column's color and a flag if it's medium, high or urgent priority. **Overdue** tasks
  (the date has passed and they aren't done) show in red; **done** ones, crossed out. Hover over one to see the whole card, and
  click to open it.
- If a day can't fit them all, you'll see **"+N more"**: open it to see them all. The taller the window, the more tasks fit per day.
- The **"N overdue"** button shows only overdue tasks (it's the **Due › Overdue** filter). Click it again to remove it.
- **Drag a task to another day** to change its date. Only the date changes: the task stays in its column. You get a notification
  ("Due Wed, Nov 4") with **Undo**. If you hold it over ‹ or › for a moment, the calendar moves to the next or previous month.
- **No date.** Tasks without a date are in the tray on the right (open or close it with **No date · N**). Drag one onto a
  day to give it a date, or drop a task in the tray to **remove** its date. When it's closed, a narrow strip stays on the right:
  you can drop there too. In the month view it opens on its own if it has tasks; in the **Week** view it starts closed, so the days
  have room.
- **In the week view** each task shows its column, its labels and its subtasks. Days without tasks get narrower to make room for the
  ones that have them.
- **Create on a day:** click the **+** that shows up when you hover over a day (or click its empty space), type the title and press
  Enter. The task gets that date, in the "To do" column (you can pick another one). **More options…** opens the full form.
- **With the keyboard:** Tab to a task and press **Space** to pick it up. The ← → arrows move it one day and ↑ ↓ one week
  (if you go past what you can see, the calendar moves to the next month or week on its own), **S** takes it to "No date" and **Space** drops it. **Escape** cancels.
- Within a day you can't sort by hand: open tasks first, then by priority and by column.

### On your phone

- It opens on **this week**, with today's tasks below. Each day has a dot per task (red if it's overdue); tap
  a day to see its tasks. The arrows move week by week.
- **Show the month** expands the whole month (and the arrows move month by month); **Only this week** collapses it again. It
  remembers how you left it in each project.
- To **change the date**, tap the calendar button next to the task or press and hold it. Choose **Today**, **Tomorrow**,
  **Next Monday**, **In a week**, another date or **Remove date**. Always with **Undo**.
- **Swipe left** to complete it, just like on the board.
- **Add on …** creates a task on the day you've selected. If there are tasks without a date, **No date · N** opens their list, and from there
  you can give them one.
- On your phone you can't drag in the calendar: with your finger it's quicker to pick from the sheet.

> **Offline:** you can look at the calendar, but you can't change dates or create tasks: those buttons disappear until you're
> back online.

## Filter the board

On a computer, above the columns there's a filter bar: a text field ("Filter tasks…") and the **Priority**,
**Labels**, **Source** (manual, assistant, GitHub or agent) and **Due** (overdue, today, next 7 days, later or no
date) menus. On your phone, the funnel button at the top opens a sheet with the same options.

- The text searches the title, description and labels, ignoring capitals and accents; if you type several words,
  the task must have all of them.
- In each menu you can tick **several options**: any of them counts. Across different menus, all of them must match: "Priority: high"
  and "Due: today" shows tasks that are high **and** due today.
- At the top you'll see how many tasks are showing, for example "2 of 9 tasks", and **Clear filters** shows them all again.
- The column counters and limits still count **all** tasks, including hidden ones.
- **You can drag with a filter on.** The card goes right below the one above it; hidden tasks
  keep their place.
- Filters stay when you open and close a task, but not when you reload the page.

## Move cards

- **With the mouse:** drag the card to another column or another position. A click opens the task.
- **With your finger:** press and hold the card and drag it. On your phone you'll see a tab per column: drop the card
  on another tab to move it to that column, or swipe the card left to complete it.
- **With the keyboard:** focus the card with **Tab**, press **Space** to pick it up, move it with the **arrow keys**
  and press **Space** again to drop it (**Esc** cancels). **Enter** opens the task.

Every move is confirmed by a notification with **Undo**, which puts the card back where it was.
