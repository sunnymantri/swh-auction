#!/usr/bin/env node
/**
 * Bumps the app version by 0.1 (minor +1, patch reset to 0).
 * Rolls major when minor reaches 99.
 *
 *   2.6.0   -> 2.7.0
 *   2.99.0  -> 3.0.0
 *
 * Run manually with `npm run version:bump`, or automatically on every
 * commit via the pre-commit hook in .githooks/ (see `npm run setup:hooks`).
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const pkgPath = join(root, 'package.json')

const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
const [majorRaw = '0', minorRaw = '0'] = String(pkg.version || '0.0.0').split('.')
const major = Number(majorRaw)
const minor = Number(minorRaw)

const next = minor >= 99
  ? `${major + 1}.0.0`
  : `${major}.${minor + 1}.0`

pkg.version = next
writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`)

console.log(`version bumped to ${next}`)
