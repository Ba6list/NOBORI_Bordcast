export const dynamic = "force-dynamic";

const KEY_PREFIX = "nobori:broadcast-state";
const APPLY_PATCH_SCRIPT = `
local raw = redis.call("GET", KEYS[1])
if not raw then
  return false
end

local stored = cjson.decode(raw)
local state = stored.state
local operations = cjson.decode(ARGV[1])

for _, operation in ipairs(operations) do
  local path = operation.path
  if #path == 0 then
    state = operation.value
  else
    local target = state
    for index = 1, #path - 1 do
      local segment = path[index]
      if type(segment) == "number" then
        segment = segment + 1
      end
      target = target[segment]
    end

    local finalSegment = path[#path]
    if type(finalSegment) == "number" then
      finalSegment = finalSegment + 1
    end
    target[finalSegment] = operation.value
  end
end

stored.state = state
stored.updatedAt = ARGV[2]
local encoded = cjson.encode(stored)
redis.call("SET", KEYS[1], encoded)
return encoded
`;

type PatchOperation = {
  path: (string | number)[];
  value: unknown;
};

function firstEnv(names: string[]) {
  return names.map((name) => process.env[name]).find(Boolean);
}

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
  const url = firstEnv([
    "KV_REST_API_URL",
    "UPSTASH_REDIS_REST_URL",
    "UPSTASH_REDIS_REST_KV_REST_API_URL",
    "UPSTASH_REDIS_REST_REDIS_URL",
    "UPSTASH_REDIS_REST_KV_URL",
    "REDIS_REST_API_URL",
  ]);
  const token = firstEnv([
    "KV_REST_API_TOKEN",
    "UPSTASH_REDIS_REST_TOKEN",
    "UPSTASH_REDIS_REST_KV_REST_API_TOKEN",
    "UPSTASH_REDIS_REST_KV_REST_API_READ_ONLY_TOKEN",
    "REDIS_REST_API_TOKEN",
  ]);

  if (!url || !token) return null;

  return { url, token };
}

function roomKey(request: Request) {
  const room =
    new URL(request.url).searchParams.get("room")?.replace(/[^\w-]/g, "").slice(0, 48) ||
    "main";

  return `${KEY_PREFIX}:${room}`;
}

function isPatchOperation(value: unknown): value is PatchOperation {
  if (!value || typeof value !== "object") return false;

  const operation = value as Partial<PatchOperation>;
  return (
    Array.isArray(operation.path) &&
    operation.path.length <= 16 &&
    operation.path.every(
      (segment) =>
        (typeof segment === "string" && segment.length <= 80) ||
        (typeof segment === "number" && Number.isInteger(segment) && segment >= 0),
    ) &&
    Object.hasOwn(operation, "value")
  );
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
    const requestedUpdatedAt = new URL(request.url).searchParams.get("since");

    if (requestedUpdatedAt && requestedUpdatedAt === stored.updatedAt) {
      return responseJson({
        configured: true,
        state: null,
        updatedAt: stored.updatedAt,
        unchanged: true,
      });
    }

    return responseJson({
      configured: true,
      state: stored.state ?? null,
      updatedAt: stored.updatedAt ?? null,
      unchanged: false,
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
    const body = (await request.json()) as {
      state?: unknown;
      patch?: unknown;
    };
    const updatedAt = `${new Date().toISOString()}-${crypto.randomUUID()}`;

    if (Array.isArray(body.patch)) {
      if (
        body.patch.length === 0 ||
        body.patch.length > 512 ||
        !body.patch.every(isPatchOperation)
      ) {
        return responseJson(
          { configured: true, ok: false, error: "Invalid state patch" },
          { status: 400 },
        );
      }

      const { configured, result } = await redisCommand<string>([
        "EVAL",
        APPLY_PATCH_SCRIPT,
        1,
        roomKey(request),
        JSON.stringify(body.patch),
        updatedAt,
      ]);

      if (!configured) {
        return responseJson({ configured: false, ok: false });
      }

      if (!result) {
        return responseJson(
          { configured: true, ok: false, error: "Shared state not found" },
          { status: 409 },
        );
      }

      const stored = JSON.parse(result) as { state?: unknown; updatedAt?: string };
      return responseJson({
        configured: true,
        ok: true,
        state: stored.state ?? null,
        updatedAt: stored.updatedAt ?? updatedAt,
      });
    }

    if (!body || typeof body.state !== "object" || body.state === null) {
      return responseJson(
        { configured: true, ok: false, error: "Missing state" },
        { status: 400 },
      );
    }

    const serialized = JSON.stringify({ state: body.state, updatedAt });
    const { configured } = await redisCommand<string>([
      "SET",
      roomKey(request),
      serialized,
    ]);

    if (!configured) {
      return responseJson({ configured: false, ok: false });
    }

    return responseJson({
      configured: true,
      ok: true,
      state: body.state,
      updatedAt,
    });
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
