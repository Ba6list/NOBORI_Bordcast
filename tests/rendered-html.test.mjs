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

test("server-renders registered team logo presets", async () => {
  const response = await render("/");
  assert.equal(response.status, 200);

  const html = await response.text();
  assert.match(html, /<optgroup label="N1">/);
  assert.match(html, /<optgroup label="N2">/);
  assert.match(html, /Konamono Gaming/);
  assert.match(html, /U\.M\.A Seekers/);
  assert.match(html, /Killer-Bee/);
  assert.match(html, /\/assets\/team-logos\/U\.M\.A_Seekers\.png/);
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

test("server-renders team-colored map pick borders", async () => {
  const response = await render("/obs/map");
  assert.equal(response.status, 200);

  const html = await response.text();
  assert.match(html, /\/assets\/maps\/lijiang-tower\.png/);
  assert.match(html, /\/assets\/maps\/kings-row\.png/);
  assert.match(html, /map-card[^>]+background-image:url\(&quot;\/assets\/maps\//);
  assert.doesNotMatch(html, /map-visual[^>]+background-image:url/);
  assert.doesNotMatch(html, /winner-ribbon|>WIN</);
  assert.doesNotMatch(html, /MAP <!-- -->1/);
  assert.match(html, /1<!-- --> - <!-- -->0<\/em><strong>FT3<\/strong>/);
  assert.match(html, /--map-border-color:#17bdc1/);
  assert.match(html, /--map-border-color:#c01679/);
  assert.match(html, /--map-border-color:rgba\(150, 160, 165, 0\.55\)/);
  assert.match(html, /3rd/);
  assert.match(html, /4th/);
  assert.match(html, /5th/);
});

test("server-renders five-player rosters without flex slots", async () => {
  const response = await render("/obs/roster");
  assert.equal(response.status, 200);

  const html = await response.text();
  assert.match(html, /AKARI/);
  assert.match(html, /RIO/);
  assert.doesNotMatch(html, /FLEX|KAI|ACE/);
});

test("server-renders the selected map hero ban stage", async () => {
  const response = await render("/obs/ban");
  assert.equal(response.status, 200);

  const html = await response.text();
  const normalizedHtml = html.replaceAll("<!-- -->", "");

  assert.match(normalizedHtml, /SELECTED MAP/);
  assert.match(normalizedHtml, /INITIAL BAN/);
  assert.match(normalizedHtml, /FOLLOW-UP BAN/);
  assert.match(normalizedHtml, /King&#x27;s Row/);
  assert.match(normalizedHtml, /\/assets\/maps\/kings-row\.png/);
  assert.match(normalizedHtml, /Lucio/);
  assert.match(normalizedHtml, /Mauga/);
  assert.match(normalizedHtml, /\/assets\/heroes\/lucio_png\.png/);
  assert.match(normalizedHtml, /\/assets\/heroes\/mauga_png\.png/);
  assert.doesNotMatch(
    normalizedHtml,
    /MAP 1-3 BAN|MAP 4-5 BAN/,
  );
});
