// Cross-platform clipboard copy + open-in-browser, for the semi-automated publish step.

import { spawn } from "node:child_process";

export async function copyToClipboard(text: string): Promise<boolean> {
  const platform = process.platform;
  const cmd = platform === "darwin" ? "pbcopy" : platform === "win32" ? "clip" : "xclip";
  const args = platform === "linux" ? ["-selection", "clipboard"] : [];
  return new Promise((resolve) => {
    try {
      const proc = spawn(cmd, args);
      proc.on("error", () => resolve(false));
      proc.on("close", (code) => resolve(code === 0));
      proc.stdin.write(text);
      proc.stdin.end();
    } catch {
      resolve(false);
    }
  });
}

export function openUrl(url: string): void {
  const platform = process.platform;
  const cmd = platform === "darwin" ? "open" : platform === "win32" ? "start" : "xdg-open";
  const args = platform === "win32" ? ["", url] : [url];
  try {
    spawn(cmd, args, { detached: true, stdio: "ignore" }).unref();
  } catch {
    /* caller falls back to printing the URL */
  }
}
