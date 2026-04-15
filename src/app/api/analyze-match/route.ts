import { ROSTER } from "@/lib/config";
import {
  buildPrompt,
  validateExtraction,
  type ExtractedMatch,
} from "@/lib/dota-ocr";

export const runtime = "nodejs";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "qwen/qwen2.5-vl-72b-instruct";
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

function extractJson(s: string): string {
  const fenced = s.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const body = (fenced ? fenced[1] : s).trim();
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  return start !== -1 && end > start ? body.slice(start, end + 1) : body;
}

export async function POST(request: Request): Promise<Response> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "OPENROUTER_API_KEY is not configured" },
      { status: 500 }
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Invalid multipart body" }, { status: 400 });
  }

  const file = form.get("image");
  if (!(file instanceof File)) {
    return Response.json({ error: "Missing 'image' file field" }, { status: 400 });
  }
  if (file.size === 0) {
    return Response.json({ error: "Empty file" }, { status: 400 });
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return Response.json({ error: "Image too large (>8MB)" }, { status: 413 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const mime = file.type && file.type.startsWith("image/") ? file.type : "image/png";
  const dataUrl = `data:${mime};base64,${buf.toString("base64")}`;

  const { system, user } = buildPrompt(ROSTER);
  const model = process.env.OPENROUTER_MODEL || DEFAULT_MODEL;

  let r: Response;
  try {
    r = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://omgg.local",
        "X-Title": "OMGG",
      },
      body: JSON.stringify({
        model,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          {
            role: "user",
            content: [
              { type: "text", text: user },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
      }),
    });
  } catch (err) {
    return Response.json(
      { error: "Failed to reach OpenRouter", detail: String(err) },
      { status: 502 }
    );
  }

  if (!r.ok) {
    const detail = await r.text().catch(() => "");
    return Response.json(
      { error: `OpenRouter error ${r.status}`, detail },
      { status: 502 }
    );
  }

  const payload = (await r.json().catch(() => null)) as {
    choices?: { message?: { content?: string } }[];
  } | null;
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    return Response.json({ error: "No content from model" }, { status: 502 });
  }

  let parsedRaw: unknown;
  try {
    parsedRaw = JSON.parse(extractJson(content));
  } catch {
    return Response.json(
      { error: "Model returned non-JSON", raw: content },
      { status: 502 }
    );
  }

  const rosterIds = new Set(ROSTER.map((r) => r.id));
  const match: ExtractedMatch | null = validateExtraction(parsedRaw, rosterIds);
  if (!match) {
    return Response.json(
      { error: "Extraction failed validation", raw: parsedRaw },
      { status: 502 }
    );
  }

  return Response.json({ match });
}
