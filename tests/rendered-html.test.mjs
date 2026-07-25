import assert from "node:assert/strict";
import test from "node:test";

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${path}`, {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the NOBORI control room", async () => {
  const response = await render("/");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>NOBORI Broadcast Control<\/title>/i);
  assert.match(html, /NOBORI BROADCAST CONTROL/);
  assert.match(html, /OBS/);
  assert.match(html, /\/obs\/map/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});

test("server-renders each OBS overlay route", async () => {
  const cases = [
    ["/obs/map", /MAP PICK/],
    ["/obs/roster", /ROSTER/],
    ["/obs/ban", /HERO BAN/],
  ];

  for (const [path, pattern] of cases) {
    const response = await render(path);
    assert.equal(response.status, 200);

    const html = await response.text();
    assert.match(html, pattern);
    assert.match(html, /scene-canvas/);
  }
});
