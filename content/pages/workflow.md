---
title: The agentic workflow
description: How the website is made — roles, the edit-to-publish loop, where the human is in the loop, and the frictions we hit.
navTitle: Workflow
order: 2
updated: 2026-09-22
---

The whole site is produced through conversation. The human describes what he wants; an AI agent plans, writes, builds and publishes; the human checks the result and answers questions. This page describes that loop as it actually happened.

## Who does what

| Role | Who | Does |
|---|---|---|
| Lead QA & responsible human | [David](/authors/david/) | Sets goals, answers questions, creates accounts and secrets, approves permissions, reviews what goes live |
| Orchestrator | [Claude Opus](/authors/claude-opus/), in a Claude Cowork session | Plans, researches, writes content and code, runs builds, publishes, keeps the friction log |
| Subagent | [Claude Sonnet](/authors/claude-sonnet/) | Writes its own author page and one free-topic page, launched by the orchestrator with an explicit model choice |

## The loop

1. **Ask.** David says what he wants in plain language ("add a page about…", "the menu is too crowded").
2. **Clarify.** For open decisions Claude asks multiple-choice questions instead of guessing.
3. **Edit.** Claude changes Markdown files in the project folder on David's laptop — directly, through a shell that runs on that machine.
4. **Build & check.** Claude builds the site locally and checks for errors, broken links and mobile layout.
5. **Publish.** Claude commits the change with git and pushes it to GitHub; a GitHub Action rebuilds and deploys the site within a minute or two.
6. **Verify.** Claude loads the live site, takes screenshots and reports back; David does the final QA.

## Where the human is needed

An agent in Cowork is deliberately *not* allowed to do some things, even when asked: it may not create accounts, type passwords, or paste access tokens into web forms, and it needs explicit approval before deleting files on the user's computer. In practice this means a short setup phase where the human does a handful of clicks — create a GitHub repository, create an access token limited to that one repository, save it into a file — after which the agent works alone.

## Friction log (so far)

These are the snags from the first session, roughly in order. Each is a lesson for students.

- **Invisible work.** Unlike Claude Code, Cowork does not show the agent's intermediate reasoning and steps; the user sees a spinner for minutes. Fix: ask the agent explicitly to post short progress messages.
- **Answers that never arrived.** Answers to a multiple-choice question were lost — most likely because a new chat message was sent while the question was still pending. Fix: answer, then wait.
- **Git versus the permission system.** By default the agent may not delete files in the user's folder. Git constantly creates and deletes small temporary files, so the first commit failed half-way. Fix: grant delete permission for the project folder (one approval per session).
- **Nothing survives the session except the folder.** The agent's shell on the laptop has a fresh home directory every session, so a GitHub login stored there is gone next time. Fix: keep a narrowly scoped access token in a git-ignored file inside the project folder.
- **Moving targets.** The site generator (Astro) was at version 7, newer than most of the model's training data, and one hosting provider (Cloudflare) is mid-way through merging two products. Fix: the agent checks current documentation rather than relying on memory.
