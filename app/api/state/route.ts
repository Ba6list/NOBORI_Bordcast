export const dynamic = "force-dynamic";

const KEY_PREFIX = "nobori:broadcast-state";

function responseJson(body: unknown, init?: ResponseInit) {
  return Response.json(body, {
    ...init,
    headers: {
      "cache-control": "no-store",
      ...(init?.headers ?? {}),
    },
  });
}

function getRedisConfig() {
  const url =
    process.env.KV_REST_API_URL ??
    process.env.UPSTASH_REDIS_REST_URL ??
    process.env.REDIS_REST_API_URL;
  const token =
    process.env.KV_REST_API_TOKEN ??
    process.env.UPSTASH_REDIS_REST_TOKEN ??
    process.env.REDIS_REST_API_TOKEN;

  if (!url || !token) return null;

  return { url, token };
}

function roomKey(request: Request) {
  const room =
    new URL(request.url).searchParams.get("room")?.replace(/[^\w-]/g, "").slice(0, 48) ||
    "main";

  return `${KEY_PREFIX}:${room}`;
}

async function redisCommand<T>(command: unknown[]) {
  const config = getRedisConfig();
  if (!config) {
    return { configured: false as const, result: null as T | null };
  }

  const response = await fetch(config.url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${config.token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(command),
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => null)) as {
    result?: T;
    error?: string;
  } | null;

  if (!response.ok || payload?.error) {
    throw new Error(payload?.error ?? `Redis request failed: ${response.status}`);
  }

  return { configured: true as const, result: payload?.result ?? null };
}

export async function GET(request: Request) {
  try {
    const { configured, result } = await redisCommand<string>([
      "GET",
      roomKey(request),
    ]);

    if (!configured) {
      return responseJson({ configured: false, state: null });
    }

    if (!result) {
      return responseJson({ configured: true, state: null, updatedAt: null });
    }

    const stored = JSON.parse(result) as { state?: unknown; updatedAt?: string };

    return responseJson({
      configured: true,
      state: stored.state ?? null,
      updatedAt: stored.updatedAt ?? null,
    });
  } catch (error) {
    return responseJson(
      {
        configured: true,
        state: null,
        error: error instanceof Error ? error.message : "Unknown sync error",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { state?: unknown };

    if (!body || typeof body.state !== "object" || body.state === null) {
      return responseJson(
        { configured: true, ok: false, error: "Missing state" },
        { status: 400 },
      );
    }

    const updatedAt = new Date().toISOString();
    const serialized = JSON.stringify({ state: body.state, updatedAt });
    const { configured } = await redisCommand<string>([
      "SET",
      roomKey(request),
      serialized,
    ]);

    if (!configured) {
      return responseJson({ configured: false, ok: false });
    }

    return responseJson({ configured: true, ok: true, updatedAt });
  } catch (error) {
    return responseJson(
      {
        configured: true,
        ok: false,
        error: error instanceof Error ? error.message : "Unknown sync error",
      },
      { status: 500 },
    );
  }
}
