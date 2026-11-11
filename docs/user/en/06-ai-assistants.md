---
title: Connect Claude and others
description: Connect Claude, Codex or another AI assistant so it knows and manages your Muninn data.
order: 6
status: disponible
group: ia
icon: plug
---

# Connect Claude and others

Muninn has two ways to talk to an AI:

- **The app's Assistant**, with a model that runs on your computer: it's in [Assistant](11-assistant.md).
- **Claude, Codex or others**, connected to Muninn through **MCP** (Model Context Protocol), the standard AI
  assistants use to connect to other apps. That's what this page is about.

Both use **the same tools** with the same rules, so they understand the same things. Once it's connected, you can
ask it things like:

- *"How am I doing today?"*
- *"What's overdue in the Muninn project?"*
- *"Create an urgent task in Muninn to review the login, due Friday."*
- *"Move the login task to In progress."*
- *"Write down in a project note what we decided about the design."*
- *"I spent 24.90 at the movies."* or *"How much do I have in the piggy bank?"* (Finance: accounts, expenses, income and transfers)
- *"Turn this plan into Muninn tasks, each with its checklist."* It creates up to 50 tasks at once. If one fails (a
  column that doesn't exist, for example), the others are still created and it tells you which one failed.

You can refer to projects, columns, accounts and categories by name, without worrying about capitals. You say
amounts in euros, the way you'd write them. If you have an archived project with the same name as an active one, the active one
is used. If two active ones have the same name, it'll ask you which one you mean.

**Security:** the assistant can create, edit, move, complete and archive, but it can **never delete** anything for good.
In a task's history, what Claude does shows up as "Claude" and what the app's Assistant does, as "The assistant".

## Connect claude.ai

You can add Muninn as a **connector** in claude.ai: Claude signs in with your Muninn account and sees the same as you do in the app.

1. In claude.ai, go to **Settings › Connectors** and press **Add custom connector**.
2. Give it a name (for example, Muninn) and paste this address:
   `https://yjzzubpxikpvukymgfkt.supabase.co/functions/v1/mcp`
3. Press connect. claude.ai brings you to a Muninn screen that says which app is asking for access, which account you'll use and what it'll be able to
   do. If you weren't signed in, it asks you to sign in first. With two-factor authentication turned on, it also asks for the code from
   your app before letting you grant access.
4. Choose **Allow access** (or **Deny**). You go back to claude.ai with the connector ready and its tools.

A tip: set the read-only tools to "always allow" and the ones that change things to "require approval", so you
see what it's going to do before it does it.

> **Keep in mind:** if you use claude.ai inside an organization, whoever manages it may need to allow custom
> connectors. For now the connector shows an icon that isn't Muninn's. You can see and remove the permissions you give claude.ai
> in **Settings › Account › Apps with access** ([Account and security](14-account-and-security.md#remove-an-app-s-access)).

> **Coming soon:** using it from the Claude app on **iPhone**. It should work the same way, but it hasn't been tested yet.

---

## Setup (advanced)

> This section is technical: it'll get simpler once Muninn includes a setup assistant.

This is for connecting an assistant that runs on your computer (Claude Code, Claude Desktop, Codex…) directly, without going through
the internet. Build the server once from the project folder:

```bash
pnpm --filter @muninn/mcp build
```

### Where is the data stored?

| Configuration | Where |
|---|---|
| None | In a file on your computer: `~/.muninn/data.json`. Ideal for trying it out. |
| `MUNINN_DATA_FILE` | In the file you specify |
| `MUNINN_SUPABASE_URL` + `MUNINN_SUPABASE_SERVICE_ROLE_KEY` + `MUNINN_USER_ID` | In your Muninn account in the cloud (the same data you see in the app) |

> **Important:** the *service role key* gives full access to the database. Keep it only in your
> computer's configuration and never share it.

In the examples, replace `C:/sourcecode/muninn` with the folder where you have Muninn.

### Claude Code

```bash
claude mcp add muninn --scope user -- node C:/sourcecode/muninn/packages/mcp/dist/index.js
```

### Claude Desktop

Edit `%APPDATA%\Claude\claude_desktop_config.json` on Windows or
`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS:

```json
{
  "mcpServers": {
    "muninn": {
      "command": "node",
      "args": ["C:/sourcecode/muninn/packages/mcp/dist/index.js"]
    }
  }
}
```

To use your cloud data, add an `"env": { "MUNINN_SUPABASE_URL": "…", … }` block inside `"muninn"`.
Then quit Claude Desktop completely and open it again.

### Codex

In `~/.codex/config.toml`:

```toml
[mcp_servers.muninn]
command = "node"
args = ["C:/sourcecode/muninn/packages/mcp/dist/index.js"]
```

### Available tools

| To look things up | To take action |
|---|---|
| `overview`: summary of the day | `create_project` |
| `list_projects` | `create_task` (with its checklist), `create_tasks` (up to 50 at once), `update_task` |
| `project_status`: a project's report | `move_task`, `complete_task`, `archive_task` |
| `list_tasks`: with filters | `add_checklist_item`, `set_checklist_item_done` |
| `get_task`: with subtasks and notes | `create_note` (also as a child of another), `update_note`, `move_note` |
| `list_columns`, `list_notes`, `recent_activity` | |
| `list_note_comments`: a note's threads or the "For Claude" requests | `comment_on_note`, `reply_to_comment`, `resolve_comment` (also reopen) |
| `list_finance_accounts`, `list_transactions`, `finance_month_report` | `create_transaction`, `update_transaction`, `archive_transaction` |
| `list_news`, `news_digest` (with News) | |
| `fx_rate`: the ECB exchange rate of a currency against the euro (with Finance; rates arrive once their daily download is switched on) | |
| `list_finance_categories`, `list_subscriptions` | `create_finance_account`, `update_finance_account`, `archive_finance_account` |
| | `create_finance_category` (categories can't be edited or archived yet) |
| | `create_subscription`, `record_subscription_charge`, `skip_subscription_charge`, `archive_subscription` |
