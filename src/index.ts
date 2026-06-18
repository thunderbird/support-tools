#!/usr/bin/env node
import { Command } from "commander";
import { runFetch } from "./commands/fetch.js";
import { runImportSource } from "./commands/importSource.js";
import { runToMarkup } from "./commands/toMarkup.js";
import { runBuildStyle } from "./commands/buildStyle.js";
import { runDraft } from "./commands/draft.js";

const program = new Command();

program
  .name("sumo")
  .description("Tools to draft, edit, and publish SUMO Knowledge Base articles via Google Docs")
  .version("0.1.0");

program
  .command("fetch")
  .description("Fetch a SUMO KB article into a new Google Doc")
  .argument("<slug>", "article slug, e.g. thunderbird-and-gmail")
  .option("-l, --locale <locale>", "article locale", "en-US")
  .action(async (slug: string, options: { locale: string }) => {
    try {
      await runFetch(slug, options);
    } catch (err) {
      console.error(`\n❌ ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
  });

program
  .command("import-source")
  .description("Convert WikiMarkup source (file or stdin) into an editable Google Doc")
  .argument("[file]", "path to a .wiki file; omit to read from stdin")
  .option("-t, --title <title>", "Doc title (default: first heading in the source)")
  .option("--html", "print the converted HTML and skip Google Doc creation")
  .action(async (file: string | undefined, options: { title?: string; html?: boolean }) => {
    try {
      await runImportSource(file, options);
    } catch (err) {
      console.error(`\n❌ ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
  });

program
  .command("to-markup")
  .description("Convert an edited Google Doc back into paste-ready WikiMarkup")
  .argument("<doc>", "Google Doc id or URL")
  .option("-o, --out <file>", "write the WikiMarkup to a file instead of stdout")
  .option("--debug-lists", "print the Doc's raw list metadata and exit (for debugging)")
  .action(async (doc: string, options: { out?: string; debugLists?: boolean }) => {
    try {
      await runToMarkup(doc, options);
    } catch (err) {
      console.error(`\n❌ ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
  });

program
  .command("build-style")
  .description("Compile the SUMO KB style corpus (prompts/sumo-style/) for generation")
  .option("-l, --locale <locale>", "locale", "en-US")
  .action(async (options: { locale: string }) => {
    try {
      await runBuildStyle(options);
    } catch (err) {
      console.error(`\n❌ ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
  });

program
  .command("draft")
  .description("Generate an on-style SUMO WikiMarkup article from a brief (+ optional sources)")
  .argument("<brief>", "what the article should cover")
  .option("-s, --source <ref...>", "facts to ground in: file (.txt/.md/.wiki/.html/.pdf/image), SUMO slug/URL, or web URL")
  .option("-r, --reference <ref...>", "existing articles for style/structure/cross-links (not copied); same input types as --source")
  .option("--doc", "stage the result as a Google Doc")
  .option("-o, --out <file>", "write the WikiMarkup to a file instead of stdout")
  .option("--dry-run", "assemble the prompt and report sizes without calling Claude")
  .option("-m, --model <model>", "Claude model", "claude-opus-4-8")
  .option("-t, --title <title>", "Doc title (default: first heading)")
  .action(async (brief: string, options: DraftOptionsCli) => {
    try {
      await runDraft(brief, options);
    } catch (err) {
      console.error(`\n❌ ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
  });

program.parseAsync();

interface DraftOptionsCli {
  source?: string[];
  reference?: string[];
  doc?: boolean;
  out?: string;
  dryRun?: boolean;
  model: string;
  title?: string;
}
