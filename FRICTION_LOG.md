# Friction log

Every point where a (non-technical) student would plausibly get stuck, with what resolved it.
Format: date · phase · friction → resolution · severity for students (low/med/high).

## 2026-09-22 · Session 1

1. **Setup · Hidden agent activity.** Cowork shows no intermediate reasoning/steps (unlike Claude Code); user saw only a timer for minutes. → Ask Claude explicitly to post progress messages. · med
2. **Setup · Lost AskUserQuestion answers.** User answered multiple-choice questions, then sent a chat message while waiting; the answers never reached Claude. → Answer and wait; don't send a new message while a question is pending. · high (silent failure)
3. **Setup · Delete permission vs git.** Default Cowork policy forbids deleting files in connected folders; git needs to unlink lock/temp files, so the first commit failed half-way and left an undeletable test folder. → Grant delete permission for the project folder (per session). · high (cryptic error)
4. **Setup · Ephemeral local home dir.** The local Linux VM's $HOME is per session, so CLI logins (gh, wrangler) don't persist across sessions. → Fine-grained PAT scoped to one repo, stored in git-ignored `_secrets/` in the project folder. · med
5. **Setup · Human-only steps.** Claude may not create accounts or enter passwords/tokens; user must create repo + token by hand (≈5 min, click-by-click instructions provided). · med (fine-grained token UI is intimidating)
6. **Setup · Notes on multiple-choice answers.** Unclear how to add a note to an AskUserQuestion option in Cowork (Claude Code has a key for it); free-text "Other" works. · low
7. **Research · Version drift.** Astro 7.x is newer than the model's training focus; Cloudflare Pages is being folded into Workers. → Claude verifies current docs before writing config. · low (invisible to students if the agent does it; high if it doesn't)
8. **Research · Netlify credit pricing.** New Netlify free accounts: 300 credits/month, 15 per production deploy → ~20 deploys then site pauses. Unsuitable for iterative vibe-coding. · n/a (avoided)
9. **Build · Breaking change in Astro 7.** The default Markdown processor changed (Sätteri); a rehype plugin in the old config location crashed the build with an install hint, then a deprecation warning. → Claude read the error + Astro source, added `@astrojs/markdown-remark` and moved the plugin to `markdown.processor: unified({...})`. ~3 min. · high for students without an agent (error is clear but the fix is not), low with one
10. **Deploy · Enabling Pages needs admin rights.** `POST /repos/{repo}/pages` requires the fine-grained "Administration: write" permission; rather than widen the token, the user switched Settings → Pages → Source to "GitHub Actions" by hand (1 click). → Add this click to the setup instructions. · low
11. **QA · Code blocks unreadable in light mode.** Shiki's default theme is dark; our CSS forced a light background. Caught only by screenshot review, not by the build. → Lesson: automated visual checks (screenshots) belong in the loop. · med
