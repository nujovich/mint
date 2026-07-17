import { describe, it, expect, vi, afterEach } from 'vitest'
import * as cp from 'node:child_process'
import { getDirtyFiles } from '../git-status.mjs'

vi.mock('node:child_process', () => ({ execFileSync: vi.fn() }))

afterEach(() => vi.restoreAllMocks())

describe('getDirtyFiles', () => {
  it('returns isRepo=false when git rev-parse fails', () => {
    vi.spyOn(cp, 'execFileSync').mockImplementation(() => {
      throw new Error('not a git repo')
    })
    const res = getDirtyFiles(['a.css'], '/tmp/x')
    expect(res.isRepo).toBe(false)
    expect(res.dirty).toEqual([])
  })

  it('returns the dirty subset from git status --porcelain', () => {
    vi.spyOn(cp, 'execFileSync').mockImplementation((_bin, args) => {
      if (args.includes('rev-parse')) return 'true\n'
      return ' M a.css\n?? b.css\n'
    })
    const res = getDirtyFiles(['a.css', 'b.css', 'c.css'], '/repo')
    expect(res.isRepo).toBe(true)
    expect(res.dirty.sort()).toEqual(['a.css', 'b.css'])
  })

  it('returns empty dirty list when the tree is clean', () => {
    vi.spyOn(cp, 'execFileSync').mockImplementation((_bin, args) => {
      if (args.includes('rev-parse')) return 'true\n'
      return ''
    })
    const res = getDirtyFiles(['a.css'], '/repo')
    expect(res.isRepo).toBe(true)
    expect(res.dirty).toEqual([])
  })
})
