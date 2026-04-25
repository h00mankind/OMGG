import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";

const VALID_VALUE = /^(#[0-9a-fA-F]{3,8}|oklch\([^)]+\)|hsl\([^)]+\)|rgb\([^)]+\))$/;
const TOKEN_PATH = path.join(
  process.cwd(),
  "src",
  "app",
  "globals.css",
);
const SENTINEL_RE =
  /(\/\* @playground:tokens-start \*\/[\s\S]*?\/\* @playground:tokens-end \*\/)/;

type Body = {
  primary?: string;
  surface?: string;
  surface2?: string;
};

export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse("Not found", { status: 404 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const tokens = {
    primary: body.primary,
    surface: body.surface,
    "surface-2": body.surface2,
  };

  for (const [k, v] of Object.entries(tokens)) {
    if (typeof v !== "string" || !VALID_VALUE.test(v)) {
      return NextResponse.json(
        { error: `Invalid value for ${k}: ${String(v)}` },
        { status: 400 },
      );
    }
  }

  let css: string;
  try {
    css = await fs.readFile(TOKEN_PATH, "utf8");
  } catch (err) {
    return NextResponse.json(
      {
        error: "Could not read globals.css",
        detail: err instanceof Error ? err.message : "unknown",
      },
      { status: 500 },
    );
  }

  if (!SENTINEL_RE.test(css)) {
    return NextResponse.json(
      {
        error:
          "Sentinel comments not found in globals.css — restore /* @playground:tokens-start */ … /* @playground:tokens-end */",
      },
      { status: 400 },
    );
  }

  const next = [
    "/* @playground:tokens-start */",
    "/* Tokens controlled by /playground. The dev-only \"Save to globals.css\" button",
    "   rewrites this block. Edit by hand or via the playground. */",
    ".dark {",
    `  --primary: ${tokens.primary};`,
    `  --surface: ${tokens.surface};`,
    `  --surface-2: ${tokens["surface-2"]};`,
    "}",
    "/* @playground:tokens-end */",
  ].join("\n");

  const updated = css.replace(SENTINEL_RE, next);

  try {
    await fs.writeFile(TOKEN_PATH, updated, "utf8");
  } catch (err) {
    return NextResponse.json(
      {
        error: "Could not write globals.css",
        detail: err instanceof Error ? err.message : "unknown",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
