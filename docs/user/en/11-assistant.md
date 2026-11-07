---
title: Assistant
description: Ask Muninn questions and for things to be done, with a model that runs on your computer.
order: 11
status: parcial
group: ia
icon: assistant
---

# Assistant

The **Assistant** is Muninn talking with you. You ask it about your tasks, notes and finances, and you can also ask it to
do things: create a task, move it, log an expense, write a note… You'll find it in the menu, on the button with the Muninn
logo next to the tabs on your phone, and in the search box (**Ctrl K** or **⌘ K**, type your question and choose **Ask Muninn**).

> **Before you start:** install **Ollama** and a model on your computer (see [Install Ollama](#install-ollama)); without them, the
> Assistant can't answer. In the **demo** you can see how it works with scripted replies.

## What you can ask it

- *"How am I doing today?"*
- *"Create an urgent task in Muninn for Friday: review the test bench."*
- *"I've finished the macOS signing, mark it as done."*
- *"I spent 24.90 at the cinema."*
- *"Which subscriptions charge me this week?"*
- *"Take a note for me: ideas for the trip."*

Call things by their name (projects, columns, accounts, categories) and give amounts in euros, the way you'd
write them yourself.

## Images

You can show it up to **4 images** per message: with the paperclip, by dragging them into the message box or by pasting them
(**Ctrl V**). For example, a photo of a receipt with *"log this expense"* or a screenshot with *"create a task with this"*.

- They're shrunk before sending (a photo of several MB ends up at a few hundred KB) and **don't leave your computer**:
  they go to the local model and are saved in this device's history.
- You need a **model with vision** in Ollama, such as `gemma3`, `qwen2.5vl` or `llama3.2-vision`
  (`ollama pull gemma3` and choose it in **Settings › Local model**). If yours can't see images, the screen tells you and
  won't let you send them.
- The model sees the images in the message you send them with. If you want it to look at them again in another message, attach them
  again.

## What you see in the conversation

- **The tools it used**, as small tags above the answer (for example `overview` or
  `create_task`). One with ✓ went fine; with ✗, it failed and the assistant tried another way.
- **The answer**, which appears as it's being written. While it thinks, the Muninn logo pulses and a line with a shimmer
  in your accent color tells you it's working on it ("Connecting the dots…", "Crunching numbers…").
- **What changed**, if it touched your data, with a link to **Open** each thing and the **Undo** button, which puts
  everything back the way it was. You also get a notification at the top with "Undo".

**It never deletes anything.** It can create, edit, move, complete and archive. If you ask it to delete, it'll offer to archive instead. Everything
it does is recorded in each task's history as "The assistant".

It only uses what you have turned on in **Settings › Modules**: if Finance is turned off, it won't touch your accounts and will tell you
to turn it on.

## Where it works

The assistant thinks with a model that runs **on your computer** (with Ollama). That way it's free and private: what you
ask it never leaves home.

- **On your computer** (the desktop app or the browser): it works as soon as Ollama is open and has the model.
- **On your iPhone:** there's no model, so the screen tells you so. From your phone you can use Claude with the Muninn
  connector ([Connect Claude and others](06-ai-assistants.md#connect-claude-ai)). Whatever the assistant changed from your computer you see the same way on
  your phone.

If something's missing, the screen tells you what it is and how to fix it:

| What you see | What's going on | What to do |
|---|---|---|
| "I can't find Ollama on this computer" | Ollama isn't installed, is closed or isn't accepting Muninn | Install it or open it (see below) and press **Retry** |
| "The model qwen3:8b is missing" | Ollama is there, but without that model | `ollama pull qwen3:8b` in a terminal, or choose another model in Settings |
| "The assistant uses your computer's model" | You're on your phone | Ask it from your computer, or use Claude |

## Install Ollama

1. Download Ollama from **ollama.com/download** and install it. It sits in the system tray.
2. Let Muninn talk to it: add the `OLLAMA_ORIGINS` environment variable (the exact values are in the repository's technical
   guide, `docs/gotchas/desktop.md`) and reopen Ollama.
3. Download the model: `ollama pull qwen3:8b` (about 5 GB).
4. Open the Assistant: at the top you'll see **Local · Ollama · qwen3:8b** with a green dot.

In **Settings › Local model** you can change Ollama's address (you'll hardly ever need to) and the model, and press
**Test connection**.

## Morning report

If you turn it on in **Settings › Morning report**, every day at the time you choose Muninn prepares a report with your overdue
tasks, today's tasks and the ones in progress, the charges coming up in the next few days and the summary from [News](12-news.md).
It's saved as a **pinned note** ("Morning report · Thursday, Oct 22"), so you can read it on any device, and it shows up
at the top of the Assistant's list of conversations.

- It's prepared by **the computer** that has Muninn open at that time. If it was off, it does it as soon as you open Muninn that day and
  tells you so in the first line. On days you don't open Muninn, there's no report.
- The figures and tasks come straight from your data. If the model is ready, it adds one or two sentences at the top with what matters most.
- **Run now** prepares one on the spot, so you can see how it looks.
- It's **turned off** at first: it creates a note every day, and that's your call.

## Your conversations

They're saved **only on this device** (the last 30) and are deleted when you sign out. They don't travel to your account. What the
assistant changes, on the other hand, is in your account, like any other change.

> **Coming soon:** talking to it with your voice in the desktop app (hold down the microphone to dictate, and have it answer you
> out loud), also locally. On your iPhone you'll be able to listen to the summary and the report in the phone's own voice; to dictate, use the
> keyboard's microphone.
