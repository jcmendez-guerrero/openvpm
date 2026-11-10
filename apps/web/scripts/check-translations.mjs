#!/usr/bin/env node
// Fails when a translation catalog drifts from the English source:
// missing or extra keys, different {placeholders}, or invalid ICU syntax.
// Contract: specs/001-spanish-translation/contracts/message-catalog.md
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse, TYPE } from "@formatjs/icu-messageformat-parser";

const MESSAGES_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "messages");
const SOURCE = "en";

export function loadCatalogs(dir = MESSAGES_DIR) {
  return Object.fromEntries(
    readdirSync(dir)
      .filter((file) => file.endsWith(".json"))
      .map((file) => [file.slice(0, -5), JSON.parse(readFileSync(join(dir, file), "utf8"))]),
  );
}

function flatten(node, prefix = "", out = {}) {
  for (const [key, value] of Object.entries(node)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object") flatten(value, path, out);
    else out[path] = String(value);
  }
  return out;
}

/** Argument and tag names used by a message, e.g. "name", "count", "<b>". */
function placeholders(elements, out = new Set()) {
  for (const el of elements) {
    if (el.type === TYPE.literal || el.type === TYPE.pound) continue;
    if (el.type === TYPE.tag) {
      out.add(`<${el.value}>`);
      placeholders(el.children, out);
      continue;
    }
    out.add(el.value);
    if (el.options) for (const option of Object.values(el.options)) placeholders(option.value, out);
  }
  return out;
}

function analyse(message) {
  try {
    return { names: [...placeholders(parse(message))].sort().join(",") };
  } catch {
    return { invalid: true };
  }
}

export function checkCatalogs(catalogs) {
  const errors = [];
  const summary = [];
  const source = flatten(catalogs[SOURCE] ?? {});
  const sourceKeys = Object.keys(source);

  for (const key of sourceKeys) {
    if (analyse(source[key]).invalid) errors.push(`${SOURCE}: invalid message ${key}`);
  }

  for (const [language, catalog] of Object.entries(catalogs)) {
    if (language === SOURCE) continue;
    const target = flatten(catalog);
    let present = 0;
    for (const key of sourceKeys) {
      if (!(key in target)) {
        errors.push(`${language}: missing key ${key}`);
        continue;
      }
      present += 1;
      const translated = analyse(target[key]);
      if (translated.invalid) {
        errors.push(`${language}: invalid message ${key}`);
        continue;
      }
      const original = analyse(source[key]);
      if (!original.invalid && original.names !== translated.names) {
        errors.push(`${language}: placeholders differ in ${key} (${original.names} vs ${translated.names})`);
      }
    }
    for (const key of Object.keys(target)) {
      if (!(key in source)) errors.push(`${language}: extra key ${key}`);
    }
    const percent = sourceKeys.length ? Math.floor((present / sourceKeys.length) * 100) : 100;
    summary.push(`${language}: ${present}/${sourceKeys.length} keys, ${percent}%`);
  }
  return { errors, summary };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { errors, summary } = checkCatalogs(loadCatalogs());
  for (const line of summary) console.log(line);
  for (const line of errors) console.error(line);
  process.exit(errors.length ? 1 : 0);
}
