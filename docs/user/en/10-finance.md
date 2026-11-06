---
title: Finance
description: Your accounts, expenses, income and savings, with the balance always up to date.
order: 10
status: parcial
group: modulos
icon: finance
---

# Finance

> **Status:** you can already create accounts, log expenses, income, savings and investments, see each account's balance and keep track of your
> subscriptions with a reminder before each charge. There's no bank import yet: transactions are logged by hand (or by
> asking the assistant).

## Turn it on

Finance is a module: if you don't see it in the menu, go to **Settings › Modules** and turn on **Finance**. Turning it off only hides it;
your data stays there.

## Accounts

Start by creating your accounts in the **Accounts** tab (or with the button that shows up the first time):

- **Checking**, **Cash** or **Other**: your day-to-day money.
- **Savings**: a savings jar. You can give it a **goal** and you'll see how far along you are ("Goal €12,000 · 78%").
- **Investment**: a fund or a portfolio.

The **opening balance** is what's in the account today. If it starts below zero (an overdraft), tick the box. From then on,
**the balance works itself out** from your transactions: you never have to touch it by hand.

## Log a transaction

Press **Transaction** (on a computer, in the **Transactions** tab, the form is always on the right) and choose the type:

| Type | What it does |
|---|---|
| **Expense** | Takes money out of the account. Pick a category (Groceries, Leisure…). |
| **Income** | Adds money to the account (Salary, Invoices…). |
| **Savings** | Moves money from an account to your savings jar. |
| **Investment** | Moves money from an account to your investment account. |
| **Transfer** | Moves money between any two accounts (from the bank to cash, for example). |

The amount accepts a comma or a period ("24,90") and is saved down to the exact cent. The date is today unless you choose another one.

When you save, a notification with **Undo** shows up, in case you made a mistake.

## View and search

- **Overview**: the month at a glance. Change month with the arrows, or press the month's name to jump to any month and year:
  - **Income** and **expenses**, compared with the previous month as a percentage. If the previous month had hardly any data (for example, the
    first month you log things), instead of a huge percentage you'll see how much there was: "In September: €9.95".
  - **Savings** and **investment**: what you moved that month to your savings jars and investment accounts (if you took money out, it subtracts).
  - **Savings rate**: the part of what came in that you **didn't spend** ((income − expenses) ÷ income). It includes what you set aside and what
    stayed in the account; **Free** tells you how much stayed without being set aside.
  - **Where the money goes** (spending by category) and the **last 6 months** of income and expenses (hover over a bar to
    see the figures).
  - Your accounts with their balance, your subscriptions and your latest transactions.
- **Transactions**: the month's transactions, grouped by day with each day's total. Change month just like in the Overview and filter by text,
  type, category or account. On your phone, type, category and account are behind the filter button (the funnel), next to the
  search. If you filter by an account, transfers show up with a sign: what goes out (−) and what comes in (+).
  The text searches the description and the note, ignoring capitals and accents; if you type several words, you get the transactions
  that have all of them, in any order ("milk coffee" finds "Coffee with milk").

## Edit and archive

Tap a transaction to change any detail or **archive** it. Archiving removes it from the balances and the list, but doesn't delete it:
the notification has **Undo**. The same goes for accounts and categories (in **Accounts**): an archived account is no longer shown and its
transactions are kept; an archived category is no longer offered, but older transactions still show it.

## Categories

You start with a few built-in ones (Housing, Groceries, Subscriptions, Transport, Restaurants, Leisure, Health, Other; and Salary,
Invoices and Other income). In **Accounts** you can rename them, change their color, archive them or create your own.

To **sort them** the way you like, drag them by the handle on the left (⠿). With the keyboard: go to the handle with Tab, press Space or
Enter, move it with the arrow keys and press again to drop it. Expenses and income are sorted separately, and that's the order you see them in
when you log a transaction and in the filters. A notification with **Undo** shows up.

## Subscriptions

In the **Subscriptions** tab you add what you pay every week, month or year (Spotify, the gym, a domain): name, amount,
account, category, next charge and how many days before you want the reminder (3 by default). You'll see how much they add up to per month and per year.

When a charge is coming up, it shows up in **Upcoming charges**, on Home and in Finance, and if you turned on notifications you'll get one on your phone
([Notifications](13-notifications.md)):

- **Log** saves it as an expense (with a repeat icon in the list) and moves the subscription on to the next period.
- **Skip** moves on to the next period without logging anything (you weren't charged that month).

Both have **Undo**. **Muninn never logs a charge on its own**: it isn't connected to your bank and doesn't know whether you were actually charged,
whether the price changed or whether you cancelled. If you don't open the app, the charge stays "overdue" until you log it or skip it.

Shortcut: when you log an expense, tick **Repeat every month (subscription)** and the subscription is created with that first charge already logged.

A subscription you no longer pay is **archived** (it stops reminding you; its logged charges are kept).

## With the assistant

If you have an assistant connected ([Connect Claude and others](06-ai-assistants.md)), you can tell it "I spent 24.90 at the cinema" or
ask "How much do I have in my savings jar?", "How am I doing this month?", and also "Which subscriptions charge me this week?" or "Log the Spotify charge". It can't
delete anything either: at most, it archives.

## What's not here yet

- Importing transactions from the bank (Imagin CSV) or connecting it directly.
- More than one currency: everything is in euros.
- Logging that an investment has gone up or down in value: for now, log it as income or an expense in that account.
