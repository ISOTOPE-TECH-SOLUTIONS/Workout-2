import { NextRequest, NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

const TARGET_BASE = process.env.HARDWARE_BRIDGE_TARGET || "http://127.0.0.1:5000";

type RouteContext = {
  params: {
    path: string[];
  };
};

const buildTargetUrl = (req: NextRequest, path: string[]) => {
  const normalizedBase = TARGET_BASE.endsWith("/") ? TARGET_BASE.slice(0, -1) : TARGET_BASE;
  const normalizedPath = (path || []).map((segment) => encodeURIComponent(segment)).join("/");
  const base = normalizedPath ? `${normalizedBase}/${normalizedPath}` : normalizedBase;
  return `${base}${req.nextUrl.search}`;
};

const forwardRequest = async (req: NextRequest, path: string[]) => {
  const targetUrl = buildTargetUrl(req, path);
  const contentType = req.headers.get("content-type") || "application/json";
  const body = req.method === "GET" ? undefined : await req.text();

  try {
    const upstream = await fetch(targetUrl, {
      method: req.method,
      headers: {
        "Content-Type": contentType,
      },
      body,
      cache: "no-store",
    });

    const payload = await upstream.text();
    const upstreamContentType = upstream.headers.get("content-type") || "application/json";

    return new NextResponse(payload, {
      status: upstream.status,
      headers: {
        "Content-Type": upstreamContentType,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "Hardware bridge is unreachable",
        detail: String(error),
      },
      { status: 502 }
    );
  }
};

export async function GET(req: NextRequest, context: RouteContext) {
  return forwardRequest(req, context.params.path || []);
}

export async function POST(req: NextRequest, context: RouteContext) {
  return forwardRequest(req, context.params.path || []);
}
