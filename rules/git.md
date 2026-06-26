# Git Rules

## Branch Naming
- Feature branches: `feat/short-description` (e.g. `feat/nl-quick-add`)
- Bug fixes: `fix/short-description` (e.g. `fix/login-error`)
- Refactors: `refactor/short-description` (e.g. `refactor/backend-structure`)
- No personal names or issue numbers in branch names

## Commit Messages
- Conventional commits format: `type: short description`
- Types: `feat`, `fix`, `refactor`, `style`, `docs`, `test`, `chore`
- Imperative mood, no period at end
- Body optional, use for explaining why not what

## Workflow
- Create feature branches from main
- Small focused commits — one logical change per commit
- Never force push to shared branches
- Squash merge feature branches into main
- Delete branch after merge

## Code Review Before Committing
- Run `git status` and `git diff` before any commit
- Stage only intended files — no secrets or debug files
- Ensure no `.env`, `node_modules`, `__pycache__`, or build artifacts
- Run linter before committing (eslint for frontend, flake8 for backend)

## What Not To Do
- No commits directly to main
- No `--force` or `--force-with-lease` unless absolutely necessary
- No large binary files in the repo
- No committing commented-out code
