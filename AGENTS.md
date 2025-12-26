## Communication

Be extremely concise in all responses. Sacrifice grammar for the sake of concision.

## Project overview

- Do not add emojis.
- Do not add comments in any code unless it is extremely complicated.
- Use minimal JSDoc annotations only when necessary.
- We are using Chrome extension Manifest V3.
- Use `bd` for task tracking (run `bd quickstart` for help)

## Verifying changes

* run tests: `yarn test`, `yarn test:watch`, `yarn test --filter <test name string/regexp>` (ex: `--filter "my"` or `--filter "/.*Memories$/"`), or `yarn test --reporter dot` (for quick verification)
* validate types: `yarn ts:check`

## Alpine

By default, in order for Alpine to execute JavaScript expressions from HTML attributes like x-on:click="console.log()", it needs to use utilities that violate the "unsafe-eval" Content Security Policy that some applications enforce for security purposes. We use an alternate build that doesn't violate "unsafe-eval" and supports most of Alpine's inline expression syntax.

Most expressions work exactly like regular Alpine. Some advanced JavaScript features aren't supported:

```html
<!-- ❌ These don't work -->
<div x-data>
  <!-- Arrow functions -->
  <button x-on:click="() => console.log('hi')">Bad</button>

  <!-- Destructuring -->
  <div x-text="{ name } = user">Bad</div>

  <!-- Template literals -->
  <div x-text="`Hello ${name}`">Bad</div>

  <!-- Spread operator -->
  <div x-data="{ ...defaults }">Bad</div>
</div>
```

If you need any of these features, extract complex logic into dedicated functions or Alpine.data() components for better organization.
Use 'bd' for task tracking

## Landing the Plane (Session Completion)

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd sync
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
