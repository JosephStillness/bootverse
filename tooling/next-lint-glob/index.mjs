import { globSync as nodeGlobSync, statSync } from "node:fs";

// Next 16.4.0 only uses this one API to find project root directories.
export function globSync(pattern, options) {
  if (typeof pattern !== "string" || options?.onlyDirectories !== true) {
    throw new TypeError("Unsupported Next lint glob API; review the pinned plugin integration.");
  }
  return nodeGlobSync(pattern).filter(path => statSync(path, { throwIfNoEntry: false })?.isDirectory());
}
