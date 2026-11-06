---
title: GitHub
description: Your repositories' issues, as tasks in their project.
order: 9
status: parcial
group: modulos
icon: github
---

# GitHub

> **Status:** syncing is up and running and has been tested with real issues. The agent needs some setup in each repository
> (see below).

## The GitHub screen

In **GitHub** (in the sidebar or, on your phone, under **Go to** in your account sheet) you have everything in one place:

- **Your repositories.** Linked ones come first, with their project, how many issues are still open and when something last changed.
  Below them are the other repositories that syncing can reach, marked "Not linked" (if there are many, **Show more**).
- **Link from here.** In the **Project in Muninn** column, pick a repository's project, or **Not linked** to let it go.
  If you pick a different project for a repository that's already linked, it moves to that project. Always with **Undo**.
- **Sync now.** Muninn goes over all your linked repositories right away, without waiting for the 5 minutes, and tells you what
  changed ("2 new issues · 1 changed"). If a repository fails, you'll see it in red on its row.
- **The agent column** of each linked project, so you can pick it or remove it without going to the board.
- **Recent runs:** what the agent is doing. **Working** if the task is in its column; **PR open**, **Merged**
  or **PR closed** depending on its *pull request* (with a link); **No PR** if it finished without opening one.

The design also has a switch to pause a repository. It doesn't exist yet: to stop syncing a repository, unlink it.

## Link a repository

Besides the **GitHub** screen, in **Settings › GitHub** you'll see your projects, each with a picker for its repository.
Open it and choose one from the list. A notification with **Undo** confirms it. To unlink it, choose **No repository**.

The list shows your private repositories that syncing has access to, plus **all** your public repositories. When you pick a
public one, Muninn quickly checks that syncing can use it; if it can't, it tells you and doesn't link it.

Each repository goes with just one project: if it's already linked to another, it shows up grayed out and tells you which one ("in Huginn").

Can't find the repository you're looking for, or it says it has no access? Syncing can only use the repositories you gave it
access to when you set it up. Give it access to that repository on GitHub and pick it again.

If the list can't load (for example, in demo mode), you'll see a field instead: type `user/repository` or paste the
GitHub address and press **Enter**.

On that same screen you can see whether the **GitHub** module is turned on and whether any issue has arrived yet.

## What syncing does

- Each **open issue** in the repository shows up as a task in the project, in the first column of the **To do** kind ("Pendiente" on a
  new board), with its labels. Issues that were already closed aren't brought in, and neither are *pull requests*.
- **Closing the issue completes the task**, and reopening it sends it back to that column. It works the other way too: **completing the task closes the issue**,
  and reopening the task reopens the issue. Changes from GitHub arrive in a few seconds; changes from Muninn take at most about 5 minutes to reach GitHub.
- If the issue is deleted or moved to another repository, its task is **archived** (not deleted).

## Tasks that come from GitHub

- They carry the **GitHub** badge with their issue number (for example, "GitHub #42") on the board and in the list. In the task
  details, the badge is a link that opens the issue.
- Their **title and description** come from GitHub: you can see them in Muninn but not edit them, and they update on their own when they change in the issue.
- Everything else is yours: the column, the order, the priority, the date, the subtasks, the notes and the labels (the issue's labels are only copied
  when the task is created).
- If you **archive** a GitHub task, Muninn won't bring it back even if the issue changes.
- If you **delete** it (from [Archived tasks](04-tasks.md#archived-tasks)) and the issue is still open, it comes back as a new task in
  the next sync: deleting doesn't close the issue. To keep it from coming back, leave it archived or close the issue.
- On the board you can show only these tasks with the **Source › GitHub** filter.

## For the agent

You can ask an agent (Claude Code) to solve an issue for you: move its task to the agent column and it works in the
repository, opens a *pull request*, and the task moves forward on its own.

> **Status:** brand new. It needs some setup in the GitHub repository that can't be done from Muninn yet (installing the
> Claude app, a key and a workflow file). Until that's done, moving a task to the column only adds a label to the issue.

- **Choose the column.** In a column's menu (the three dots), pick **Use for the agent**. It shows a small robot next to its name.
  It's only offered if the project has a repository and the GitHub module is turned on, and never on a "Done" column. To remove it,
  pick **Stop using it for the agent**.
- **Move a GitHub task there.** Muninn labels its issue with `muninn:agent` within seconds and the agent gets started. Tasks you
  create in Muninn don't have an issue: they can't be moved there, and Muninn tells you so.
- **When the agent opens its PR**, the task moves to "Review". In its activity you'll see "View the PR".
- **You review and merge.** The agent never merges. When you merge the PR, the task is completed and the issue is closed. If you close the PR without
  merging it, the task goes back to "To do".
- **If the agent finishes without a PR** (it couldn't do it or was missing information), the task goes back to "To do" and its activity explains why.
  To try again, move it to the column again.
- **Changed your mind?** Take the task out of the column: the label is removed and the agent stops.

Each time you send a task to the agent, it uses up a GitHub Actions run and some Claude usage. Only send issues you've read:
the agent reads the whole issue, and in a public repository anyone can write in it.
