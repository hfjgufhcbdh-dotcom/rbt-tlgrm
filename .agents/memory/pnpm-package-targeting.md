---
name: Workspace package installs
description: The package-install targeting rule for this pnpm monorepo.
---

Install runtime dependencies against the owning workspace package rather than the repository root. In this workspace, the generic package installer can default to the root and be rejected by pnpm's workspace-root guard.

**Why:** A scheduler dependency install initially targeted the monorepo root and failed before the package-specific install succeeded.

**How to apply:** For server dependencies, use the package filter for the relevant `@workspace/*` package when the generic installer cannot target a workspace package.