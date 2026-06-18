// Generate SUMO WikiMarkup with Claude (Opus 4.8, adaptive thinking, streamed). D13.

import Anthropic from "@anthropic-ai/sdk";

export interface GenerateRequest {
  model: string;
  system: Anthropic.TextBlockParam[];
  content: Anthropic.ContentBlockParam[];
  onText?: (delta: string) => void;
}

/** Strip a wrapping ``` fence if the model added one despite instructions. */
function stripFences(s: string): string {
  const m = /^```[a-z]*\s*\n([\s\S]*?)\n```$/.exec(s.trim());
  return (m ? m[1] : s).trim();
}

export async function generateWikiMarkup(req: GenerateRequest): Promise<string> {
  const client = new Anthropic(); // reads ANTHROPIC_API_KEY from the environment

  // Stream to avoid HTTP timeouts on long articles; adaptive thinking per D13.
  const stream = client.messages.stream({
    model: req.model,
    max_tokens: 64000,
    thinking: { type: "adaptive" },
    system: req.system,
    messages: [{ role: "user", content: req.content }],
  });

  if (req.onText) stream.on("text", req.onText);

  const message = await stream.finalMessage();
  const text = message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");

  return stripFences(text);
}
