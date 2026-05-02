#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
WORKTREE_UI="$REPO_ROOT/.claude/worktrees/agent-af3e70b7eb4ad9fdf/UI"

if [ ! -d "$WORKTREE_UI" ]; then
  echo "ERROR: Worktree UI not found at $WORKTREE_UI"
  echo "The React Flow migration worktree may have been cleaned up."
  exit 1
fi

echo "Using worktree UI: $WORKTREE_UI"
UI_DIR_OVERRIDE="$WORKTREE_UI" exec "$SCRIPT_DIR/start-dev.sh" "$@"
