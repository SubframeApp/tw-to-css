import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { before, describe, it } from "node:test";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import { buildConfig } from "../src/build-config.ts";

const readJson = async (name) =>
  JSON.parse(await readFile(new URL(`./fixtures/${name}`, import.meta.url), "utf8"));

const bundle = async (outDir, name) => {
  const outfile = join(outDir, `${name}.mjs`);
  await build({
    ...buildConfig,
    entryPoints: [new URL(`./entries/${name}.ts`, import.meta.url).pathname],
    bundle: true,
    logLevel: "silent",
    outfile,
    format: "esm",
  });
  return import(pathToFileURL(outfile).href);
};

// Seeded so a failure reproduces with the same order.
const shuffle = (items, seed) => {
  let state = seed;
  const random = () => (state = (state * 1664525 + 1013904223) >>> 0) / 2 ** 32;
  return items
    .map((item) => [random(), item])
    .sort((a, b) => a[0] - b[0])
    .map(([, item]) => item);
};

describe("tailwind context reuse", () => {
  let reuse;
  let fresh;
  let classStrings;
  let config;
  let expected;

  const run = (impl, content) => impl.processTailwindCSS({ config, content });

  before(async () => {
    const outDir = await mkdtemp(join(tmpdir(), "tw-to-css-test-"));
    reuse = await bundle(outDir, "reuse");
    fresh = await bundle(outDir, "fresh-context");
    classStrings = await readJson("class-strings.json");
    const theme = await readJson("theme.json");
    // optimizeUniversalDefaults makes one class's CSS depend on its siblings in the same string.
    config = {
      theme,
      experimental: { optimizeUniversalDefaults: true },
      corePlugins: { preflight: false },
    };
    expected = new Map();
    for (const content of classStrings) expected.set(content, await run(fresh, content));
  });

  it("matches a fresh context per call over the whole corpus in shuffled order", async () => {
    const diffs = [];
    for (const content of shuffle(classStrings, 12345)) {
      const css = await run(reuse, content);
      if (css !== expected.get(content)) diffs.push(content);
    }
    assert.ok(classStrings.length > 2000);
    assert.deepEqual(diffs, []);
  });

  it("gives a string the same output whichever strings ran before it", async () => {
    // `shadow` and `ring` register universal defaults and `blur`/`translate` add filter and transform ones.
    const polluters = [
      "shadow-lg ring-2 blur-sm translate-x-2 rotate-45",
      "bg-gradient-to-r from-[#ff0000] to-[#00ff00]",
      "hover:bg-[#fff] [&_p]:flex !flex -mt-2",
    ];
    const probes = ["flex", "p-4 text-[14px]", "border", "shadow", "transform"];
    for (const probe of probes) {
      for (const polluter of polluters) {
        await run(reuse, polluter);
        assert.equal(await run(reuse, probe), await run(fresh, probe), `${probe} after ${polluter}`);
      }
    }
  });

  it("is unaffected by concurrent calls", async () => {
    const batch = shuffle(classStrings, 777).slice(0, 200);
    const results = await Promise.all(batch.map((content) => run(reuse, content)));
    const diffs = batch.filter((content, index) => results[index] !== expected.get(content));
    assert.deepEqual(diffs, []);
  });

  it("keeps separate contexts for different configs", async () => {
    const plain = { ...config, theme: { extend: { colors: { "brand-test": "#123456" } } } };
    const other = { ...config, theme: { extend: { colors: { "brand-test": "#abcdef" } } } };
    const content = "bg-brand-test";
    const first = await reuse.processTailwindCSS({ config: plain, content });
    const second = await reuse.processTailwindCSS({ config: other, content });
    assert.match(first, /#123456|18 52 86/);
    assert.match(second, /#abcdef|171 205 239/);
    assert.equal(first, await fresh.processTailwindCSS({ config: plain, content }));
    assert.equal(second, await fresh.processTailwindCSS({ config: other, content }));
  });
});
