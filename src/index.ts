#!/usr/bin/env node
import { Command } from "commander";
import { runFetch } from "./commands/fetch.js";
import { runImportSource } from "./commands/importSource.js";
import { runToMarkup } from "./commands/toMarkup.js";

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

program.parseAsync();
