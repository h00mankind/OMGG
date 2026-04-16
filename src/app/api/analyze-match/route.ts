import { ROSTER } from "@/lib/config";
import {
  buildPrompt,
  validateExtractionDetailed,
} from "@/lib/dota-ocr";
import { checkRateLimit, clientKey } from "@/lib/rate-limit";

const IS_DEV = process.env.NODE_ENV !== "production";

export const runtime = "nodejs";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "qwen/qwen2.5-vl-72b-instruct";
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

type ImageMime = "image/png" | "image/jpeg" | "image/webp";

function sniffImageMime(buf: Buffer): ImageMime | null {
  if (buf.length >= 8 &&
      buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
      buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a) {
    return "image/png";
  }
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return "image/jpeg";
  }
  if (buf.length >= 12 &&
      buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
      buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) {
    return "image/webp";
  }
  return null;
}

function extractJson(s: string): string {
  const fenced = s.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const body = (fenced ? fenced[1] : s).trim();
  let depth = 0;
  let start = -1;
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (c === "{") {
      if (depth === 0) start = i;
      depth++;
    } else if (c === "}") {
      depth--;
      if (depth === 0 && start !== -1) return body.slice(start, i + 1);
    }
  }
  return body;
}

function isSameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  if (!origin || !host) return false;
  try {
    const u = new URL(origin);
    return u.host === host;
  } catch {
    return false;
  }
}

function publicBaseUrl(req: Request): string {
  const host = req.headers.get("host") ?? "omgg.local";
  const proto =
    req.headers.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function POST(request: Request): Promise<Response> {
  if (!isSameOrigin(request)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const rl = checkRateLimit(clientKey(request));
  if (!rl.ok) {
    return Response.json(
      { error: "Rate limit exceeded. Try again later." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "Server misconfigured" },
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
  const mime = sniffImageMime(buf);
  if (!mime) {
    return Response.json(
      { error: "Unsupported image format (png/jpeg/webp only)" },
      { status: 415 }
    );
  }

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
        "HTTP-Referer": process.env.OPENROUTER_REFERER ?? publicBaseUrl(request),
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
    console.error("[analyze-match] upstream fetch failed:", err);
    return Response.json({ error: "Upstream unreachable" }, { status: 502 });
  }

  if (!r.ok) {
    console.error("[analyze-match] upstream error:", r.status, await r.text().catch(() => ""));
    return Response.json({ error: "Upstream error" }, { status: 502 });
  }

  const payload = (await r.json().catch(() => null)) as {
    choices?: { message?: { content?: string } }[];
  } | null;
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    console.error("[analyze-match] no content in upstream payload");
    return Response.json({ error: "No content from model" }, { status: 502 });
  }

  let parsedRaw: unknown;
  try {
    parsedRaw = JSON.parse(extractJson(content));
  } catch {
    console.error(
      "[analyze-match] non-JSON model output. content:",
      content.slice(0, 2000)
    );
    return Response.json(
      {
        error: "Model returned non-JSON",
        ...(IS_DEV ? { raw: content } : {}),
      },
      { status: 502 }
    );
  }

  const rosterIds = new Set(ROSTER.map((r) => r.id));
  const result = validateExtractionDetailed(parsedRaw, rosterIds);
  if (!result.ok) {
    console.error("[analyze-match] validation failed:", result.reason);
    console.error("[analyze-match] parsedRaw:", JSON.stringify(parsedRaw).slice(0, 2000));
    return Response.json(
      {
        error: "Extraction failed validation",
        ...(IS_DEV ? { reason: result.reason, raw: parsedRaw } : {}),
      },
      { status: 502 }
    );
  }

  return Response.json({ match: result.match });
}
