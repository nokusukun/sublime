#!/usr/bin/env node
/**
 * Cleans up deprecated Sublime skill files, symlinks, and skills-lock.json
 * entries left over from previous versions.
 *
 * Safe to run repeatedly — it is a no-op when nothing needs cleaning.
 *
 * Usage (from the project root):
 *   node {{scripts_path}}/cleanup-deprecated.mjs
 *
 * What it does:
 *   1. Finds every harness-specific skills directory (.claude/skills,
 *      .cursor/skills, .agents/skills, etc.).
 *   2. For each deprecated skill name (with and without s- prefix),
 *      checks if the directory exists and its SKILL.md mentions
 *      "sublime" (to avoid deleting unrelated user skills).
 *   3. Deletes confirmed matches (files, directories, or symlinks).
 *   4. Removes the corresponding entries from skills-lock.json.
 */

import { existsSync, readFileSync, writeFileSync, rmSync, lstatSync, unlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';

// Skills that have been renamed, merged, or folded in past versions.
// Add entries here whenever a verb is removed or renamed.
const DEPRECATED_NAMES = [
  // (none yet — sublime is at v0.1)
];

// All known harness directories that may contain a skills/ subfolder.
const HARNESS_DIRS = [
  '.claude', '.cursor', '.gemini', '.codex', '.agents',
  '.trae', '.trae-cn', '.pi', '.opencode', '.kiro', '.rovodev',
];

/**
 * Walk up from startDir until we find a directory that looks like a project
 * root (has package.json, .git, or skills-lock.json).
 */
export function findProjectRoot(startDir = process.cwd()) {
  let dir = resolve(startDir);
  const root = '/';
  while (dir !== root) {
    if (
      existsSync(join(dir, 'package.json')) ||
      existsSync(join(dir, '.git')) ||
      existsSync(join(dir, 'skills-lock.json'))
    ) {
      return dir;
    }
    const parent = resolve(dir, '..');
    if (parent === dir) break;
    dir = parent;
  }
  return resolve(startDir);
}

/**
 * Check whether a skill directory belongs to Sublime by reading its SKILL.md
 * and looking for the word "sublime" (case-insensitive).
 */
export function isSublimeSkill(skillDir) {
  const skillMd = join(skillDir, 'SKILL.md');
  if (!existsSync(skillMd)) return false;
  try {
    const content = readFileSync(skillMd, 'utf-8');
    return /sublime/i.test(content);
  } catch {
    return false;
  }
}

/**
 * Build the full list of names to check: each deprecated name, plus its
 * s-prefixed variant.
 */
export function buildTargetNames() {
  const names = [];
  for (const name of DEPRECATED_NAMES) {
    names.push(name);
    names.push(`s-${name}`);
  }
  return names;
}

/**
 * Find every skills directory across all harness dirs in the project. Returns
 * absolute paths that exist on disk.
 */
export function findSkillsDirs(projectRoot) {
  const dirs = [];
  for (const harness of HARNESS_DIRS) {
    const candidate = join(projectRoot, harness, 'skills');
    if (existsSync(candidate)) {
      dirs.push(candidate);
    }
  }
  return dirs;
}

/**
 * Remove deprecated skill directories/symlinks from all harness dirs. Returns
 * an array of paths that were deleted.
 */
export function removeDeprecatedSkills(projectRoot) {
  const targets = buildTargetNames();
  if (targets.length === 0) return [];
  const skillsDirs = findSkillsDirs(projectRoot);
  const deleted = [];

  for (const skillsDir of skillsDirs) {
    for (const name of targets) {
      const skillPath = join(skillsDir, name);

      let stat;
      try {
        stat = lstatSync(skillPath);
      } catch {
        continue;
      }

      if (stat.isSymbolicLink()) {
        const targetAlive = existsSync(skillPath);
        const isMatch = targetAlive ? isSublimeSkill(skillPath) : true;
        if (isMatch) {
          unlinkSync(skillPath);
          deleted.push(skillPath);
        }
        continue;
      }

      if (isSublimeSkill(skillPath)) {
        rmSync(skillPath, { recursive: true, force: true });
        deleted.push(skillPath);
      }
    }
  }

  return deleted;
}

/**
 * Remove deprecated entries from skills-lock.json. Only removes entries whose
 * source field references sublime.
 */
export function cleanSkillsLock(projectRoot) {
  const lockPath = join(projectRoot, 'skills-lock.json');
  if (!existsSync(lockPath)) return [];

  let lock;
  try {
    lock = JSON.parse(readFileSync(lockPath, 'utf-8'));
  } catch {
    return [];
  }

  if (!lock.skills || typeof lock.skills !== 'object') return [];

  const targets = buildTargetNames();
  const removed = [];

  for (const name of targets) {
    const entry = lock.skills[name];
    if (!entry) continue;
    if (typeof entry.source === 'string' && /sublime/i.test(entry.source)) {
      delete lock.skills[name];
      removed.push(name);
    }
  }

  if (removed.length > 0) {
    writeFileSync(lockPath, JSON.stringify(lock, null, 2) + '\n', 'utf-8');
  }

  return removed;
}

/**
 * Run the full cleanup. Returns a summary object.
 */
export function cleanup(projectRoot) {
  const root = projectRoot || findProjectRoot();
  const deletedPaths = removeDeprecatedSkills(root);
  const removedLockEntries = cleanSkillsLock(root);
  return { deletedPaths, removedLockEntries, projectRoot: root };
}

// CLI entry point
if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  const result = cleanup();
  if (result.deletedPaths.length === 0 && result.removedLockEntries.length === 0) {
    console.log('No deprecated Sublime skills found. Nothing to clean up.');
  } else {
    if (result.deletedPaths.length > 0) {
      console.log(`Removed ${result.deletedPaths.length} deprecated skill(s):`);
      for (const p of result.deletedPaths) console.log(`  - ${p}`);
    }
    if (result.removedLockEntries.length > 0) {
      console.log(`Cleaned ${result.removedLockEntries.length} entry/entries from skills-lock.json:`);
      for (const name of result.removedLockEntries) console.log(`  - ${name}`);
    }
  }
}
