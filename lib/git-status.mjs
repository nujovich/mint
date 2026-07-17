// Thin wrapper over `git status --porcelain` used by `apply` to refuse
// overwriting files with uncommitted changes. Falls back gracefully when the
// path is not inside a git repository.

import { execFileSync } from 'node:child_process'

function git(args, cwd) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' })
}

// Returns { isRepo, dirty } where `dirty` is the subset of `files` that have
// uncommitted changes (modified, staged, or untracked).
export function getDirtyFiles(files, cwd) {
  try {
    git(['rev-parse', '--is-inside-work-tree'], cwd)
  } catch {
    return { isRepo: false, dirty: [] }
  }
  let out = ''
  try {
    out = git(['status', '--porcelain', '--', ...files], cwd)
  } catch {
    return { isRepo: true, dirty: [] }
  }
  const dirty = out
    .split('\n')
    .filter(Boolean)
    .map((line) => line.slice(3).trim())
    .filter(Boolean)
  return { isRepo: true, dirty }
}
