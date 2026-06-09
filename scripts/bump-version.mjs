#!/usr/bin/env node
/**
 * Bumps the app version by 0.1 (minor +1, patch reset to 0).
 *
 *   2.6.0  ->  2.7.0   (footer shows v2.6 -> v2.7)
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
const [major = '0', minor = '0'] = String(pkg.version || '0.0.0').split('.')
const next = `${Number(major)}.${Number(minor) + 1}.0`

pkg.version = next
writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`)

console.log(`version bumped to ${next}`)
