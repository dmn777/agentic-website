# Friction log

Every point where a (non-technical) student would plausibly get stuck, with what resolved it.
Format: date · phase · friction → resolution · severity for students (low/med/high).

## Phase 1 · Claude Cowork (v1) · 2026-09-22

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
12. **Delegation · Subagent output needs review.** Sonnet subagent (≈70 s) correctly fixed the role error across 4 files and wrote its author page, and proactively flagged a stale planning doc. Orchestrator review still caught 3 small factual slips: an ambiguous clause implying David designed the site; a claim that Opus integrated the result "without babysitting" (it reviewed the diff); and "including its own page below" for a page not yet written. → Keep a review step between subagent output and publishing. · med (students tend to trust fluent output)

## Phase 2 · Claude Code (v2) · 2026-09-23 to 2026-09-25

The second phase rebuilt the site in Claude Code with no human review: one planning
session, then unattended work, with checks and reviewer models as the only reviewers.
Entries 13–22 were logged as they happened; 23–32 were collected from the build records at
the wrap-up. Numbers are stable, because other notes cite them.

In short, for students:

- **The human steps shrank to a token and one login.** Everything else, including the
  CMS setup, was scriptable (13–18).
- **A green check proves little until you have seen it go red.** Several checks passed
  while the thing they checked was broken (23–25).
- **Fluent output needs checking in both directions.** The agent was confidently wrong
  about its own tools (29), and its reviewers were confidently wrong about the pages
  (30).

### Services and setup

13. **Setup · `npx` crashes with "Lock compromised".** `npx sanity login` on npm 11.6 failed with `ECOMPROMISED`: a long install stalls npx's lock refresh, and npx then believes its own lock was stolen. → Upgrade npm (11.20 fixes it), and pin CLIs as project devDependencies instead of fetching them with `npx`. · high (the error names nothing you can act on)
14. **Setup · A login that needs a TTY.** Commands run with Claude Code's `!` prefix have no terminal, so `sanity login` can't ask which provider to use and fails. → Pass the choice as a flag (`sanity login --provider github`). Write such flags into any human-step instructions. · med
15. **Setup · A new Sanity account has no organization.** `sanity projects create` stops with "No organizations are available". → `sanity organizations create --name …`, then create the project with `--organization <id>`. The agent found this in `--help`; the setup notes written from the docs two days earlier didn't mention it. · low with an agent, med without
16. **Setup · Config key renamed.** `studioHost` is deprecated in Sanity CLI 8; the first deploy now takes `--url <host>` and returns an app ID that goes into `deployment.appId`. → The CLI printed the exact line to add. · low
17. **Setup · The Studio address only redirects.** `agentic-website.sanity.studio` forwards to the Studio inside Sanity's dashboard, behind a login, so an automated check can only confirm the login page. → Accepted; the deploy output and a scripted read/write smoke test are the evidence. · low
18. **Publish · "Resource not accessible by personal access token".** Starting a site rebuild via `workflow_dispatch` needs the token's Actions permission, which the repo token didn't have. → The rebuild script falls back to a `repository_dispatch` event, which needs only the Contents permission the token already had for pushing. · med (the error doesn't say which permission is missing)

### The game

19. **Build · A bug found only by clicking.** After a click on Pause, Resume or Sound, the arrow keys stopped steering: only the game field listened for keys, and focus stayed on the button, or fell to the page when the Resume card disappeared. Type checks, unit tests and screenshots all passed. The harness's state machine check found it by pressing ← after every click path. → Keys are heard on the whole game, and resuming hands focus back to the field. · med (a player just feels the controls "die")
20. **Design · The economy looked fine on paper.** The first tuning had a single catch refill less ink than the loop took to draw. A pen left alone lasted 21 s and a looping bot 30 s, so playing well barely mattered. A 30-seed bot simulation in a throwaway test file showed it in about a second, before any playtest. → Retuned (refill 12, drain 2.5 → 7.5, 9 → 5 diatoms). The bot now lasts about 50 s. · low with a simulation, high without one (it only shows up as "not fun")
21. **Delegation · Two agents, one `dist/`.** A subagent building the test harness while the main agent kept changing the game would have raced on the same build folder. → The subagent worked in a separate `git worktree` with `node_modules` symlinked, and its branch was merged afterwards. · low
22. **Design · "Is it fun?" with no players.** Three playtest subagents stood in for players: personas, hand-steered runs and headless bots over 40 seeds. The first found the game 2–3× too harsh, and each later one found what the previous fix had missed. Fun was argued from numbers (survival, catches per loop, snaps per minute) and from screenshots, never from a human hand; the sound was never heard at all. → Report the verdict with its limits, and cap the polish rounds (2) so the loop ends. · med (it works, but it measures proxies)

### Building and checking the site

23. **QA · A check that could never fail.** The screenshot suite's "too wide for a phone" check compared the page width with the window width. Chromium's phone emulation widens the window to fit whatever overflows, so the check always passed. Running the suite once against a page broken on purpose showed it. → Compare against the phone's real width (390 px), and test every new check against a planted fault before trusting it. · high (a check that can't go red looks exactly like one that works)
24. **QA · Passing tests, wrong pictures.** Two drawing generators passed every test (deterministic, in bounds) while one drew a single diagonal line and another drew only dots, because its particles moved 0.015 px per step. Only the screenshots showed it. → Test a physical property of each drawing (it covers an area, its lines have length), and check that the test fails on the broken version. · med
25. **QA · A type check that skipped the islands.** `astro check` doesn't type-check `.svelte` files, so a missing import passed it and failed only at build time. → `npm run check` also runs `svelte-check`, which then found a real reactivity bug as well. · med
26. **Setup · A browser download that wants sudo.** Installing Playwright's own Chromium means a large download, and on WSL it can prompt for system libraries. → Pin the Playwright release whose Chromium is already on the machine (1.60.0 ↔ `chromium-1223`), so nothing is downloaded. · med (a sudo prompt stops a student cold)
27. **Build · CSS that fails silently.** Three features ignored bad input without a word in the console: `light-dark()` accepts only colours; Chromium drops a registered `@property` whose default is `1rem`; and `vector-effect: non-scaling-stroke` makes a line-drawing animation stop short on large screens. → Found by looking at every screenshot before handing them to a reviewer. Each fix was small once the cause was known. · med (nothing points at the cause)
28. **Evidence · A `tail` that hid the evidence.** Three documents quoted a 403 error that no saved output contained: a `tail -8` had cut the line. A fact-check subagent noticed. → Scripts that make a decision write it to a file (`deploy:trigger` saves `trigger.json`). · med
29. **Facts · Confidently wrong about itself.** The agent-loop page (Pl. VI) had 7 wrong and 9 imprecise claims, several of them about Claude Code itself and written from memory: how permission modes work, how many words a token is, what a subagent starts with. A fact-check subagent that read the current docs and recomputed from the raw log caught them. → Fact-check claims about the agent's own tools like any other claims. · high (the most fluent source is the least suspected)
30. **Reviewers · Reviewers can be wrong too.** Reviewer findings were rejected with evidence in six tasks. Examples: a "blocker" about a text colour the page doesn't use (the computed styles showed the right token), and a "corner clump" of sand that is the formula's true shape (a zoomed crop settled it, and the reviewer withdrew). → Answer a finding with a measurement before changing anything. · med (the mirror image of entry 12: don't obey fluent output either)
31. **Content · The site's descriptions fell behind the site.** As plates shipped, hand-kept lists went stale. The site description left out Pl. VII, and About said the browser stores only the theme, although the game also keeps a best score. The sweep reviewers caught both. → Generate the descriptions from the same data as the pages, and make a check fail when a live kind of page goes unmentioned (`qa:claims`). · med
32. **Delegation · Reviews need frozen evidence.** In the first sweep, `dist/` was rebuilt while a reviewer was reading it, and the reviewer subagent was not allowed to write its report file. → Snapshot `dist/` before a review, ask for the report as the reviewer's final answer, and save it yourself. · low

### From phase 1 to phase 2

| Phase 1 friction | In phase 2 |
|---|---|
| 1 · Hidden agent activity | Gone: Claude Code shows each tool call as it runs. |
| 2 · Lost multiple-choice answers | Not seen. Questions were asked only in the one planning session. |
| 3 · Delete permission vs git | Not seen. |
| 4 · Ephemeral home directory | Not an issue: the WSL home persists. Tokens still live in files outside the repo. |
| 5 · Human-only steps | Still there, but smaller: a repo token and one Sanity login (13, 14). |
| 7 · Version drift | Still there (13, 16). Reading `--help` and the current docs handled it. |
| 11 · Unreadable code blocks | Now a unit test: every text colour, code themes included, is held to WCAG AA in both themes. |
| 12 · Subagent output needs review | Still true, in both directions (29, 30). |
