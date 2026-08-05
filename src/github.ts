// Load GitHub issues/PRs as clean Markdown instead of scraping the rendered page.
//
// The rendered issue page is ~85% navigation chrome and loses the markdown structure
// that matters for a checklist (task boxes, fenced ```wiki blocks, inline `{button}`
// code spans). The API gives us the raw body verbatim.
//
// Auth: prefer the `gh` CLI, which reuses the user's existing login and so works for
// private repos with no token plumbing. Fall back to the REST API (GITHUB_TOKEN /
// GH_TOKEN if present, otherwise unauthenticated — fine for public repos).

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export const GITHUB_ISSUE = /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/(?:issues|pull)\/(\d+)/i;

interface IssueData {
  title: string;
  body: string | null;
  comments?: { author?: { login?: string } | null; body?: string | null }[];
}

/** Render the issue as Markdown: title, body, then each comment attributed. */
function format(num: string, data: IssueData): string {
  const parts = [`# ${data.title}  (#${num})`, (data.body ?? "").trim()];
  for (const c of data.comments ?? []) {
    const who = c.author?.login ?? "unknown";
    const body = (c.body ?? "").trim();
    if (body) parts.push(`## Comment by ${who}\n\n${body}`);
  }
  return parts.filter((p) => p !== "").join("\n\n") + "\n";
}

async function viaGh(slug: string, num: string): Promise<IssueData> {
  const { stdout } = await execFileAsync(
    "gh",
    ["issue", "view", num, "--repo", slug, "--json", "title,body,comments"],
    { maxBuffer: 32 * 1024 * 1024 },
  );
  return JSON.parse(stdout) as IssueData;
}

async function viaApi(slug: string, num: string): Promise<IssueData> {
  const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "sumo-kb-tools",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const base = `https://api.github.com/repos/${slug}/issues/${num}`;
  const res = await fetch(base, { headers });
  if (!res.ok) throw new Error(`GitHub API ${res.status} ${res.statusText} for ${slug}#${num}`);
  const issue = (await res.json()) as { title: string; body: string | null };

  // Comments are a separate endpoint on the REST API.
  const cRes = await fetch(`${base}/comments`, { headers });
  const raw = cRes.ok
    ? ((await cRes.json()) as { user?: { login?: string }; body?: string }[])
    : [];

  return {
    title: issue.title,
    body: issue.body,
    comments: raw.map((c) => ({ author: { login: c.user?.login }, body: c.body })),
  };
}

/** Fetch a GitHub issue/PR as labeled Markdown text for use as a generation source. */
export async function fetchIssueMarkdown(
  owner: string,
  repo: string,
  num: string,
): Promise<{ label: string; text: string }> {
  const slug = `${owner}/${repo}`;
  let data: IssueData;
  try {
    data = await viaGh(slug, num);
  } catch {
    // gh missing, not authenticated, or failed — fall back to the REST API.
    data = await viaApi(slug, num);
  }
  return { label: `GitHub ${slug}#${num}: ${data.title}`, text: format(num, data) };
}
