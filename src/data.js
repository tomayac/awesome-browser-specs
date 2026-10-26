// SPDX-FileCopyrightText: 2026 Thomas Steiner
// SPDX-License-Identifier: Apache-2.0

// browser-specs.github.io serves its data with `Access-Control-Allow-Origin: *`,
// so the demo reads the live file on every load. The snapshot in this repo only
// stands in when the live fetch fails.
export const LIVE_URL = 'https://browser-specs.github.io/data/specs.json';
const SNAPSHOT_URL = 'data/specs.json';

export const ENGINES = ['blink', 'gecko', 'webkit'];
export const BUCKETS = ['3', '2', '1', 'none', 'nodata'];
export const BROWSERS = ['chrome', 'firefox', 'safari'];

async function fetchJson(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }
  const json = await response.json();
  if (!Array.isArray(json?.rows)) {
    throw new Error(`${url} has no rows`);
  }
  return json;
}

export async function loadSpecs() {
  try {
    return { ...(await fetchJson(LIVE_URL)), origin: 'live' };
  } catch (error) {
    console.warn('Live fetch failed, using the snapshot.', error);
    return { ...(await fetchJson(SNAPSHOT_URL)), origin: 'snapshot' };
  }
}

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = sorted.length >> 1;
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
};

const countBy = (items, key) => {
  const counts = new Map();
  for (const item of items) {
    for (const value of [key(item)].flat()) {
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
  }
  return [...counts]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
};

// Everything the demo shows, worked out once from the rows
export function deriveStats({ rows, sources, origin }) {
  const specs = rows.map((row) => ({ ...row, engines: row.engines ?? [] }));
  const inBucket = (bucket) => specs.filter((spec) => spec.bucket === bucket);

  const buckets = Object.fromEntries(
    BUCKETS.map((bucket) => [bucket, inBucket(bucket).length]),
  );

  const only = Object.fromEntries(
    ENGINES.map((engine) => [
      engine,
      specs.filter(
        (spec) => spec.engines.length === 1 && spec.engines[0] === engine,
      ),
    ]),
  );

  const pairs = [];
  ENGINES.forEach((a, i) => {
    for (const b of ENGINES.slice(i + 1)) {
      pairs.push({
        engines: [a, b],
        count: specs.filter(
          (spec) =>
            spec.engines.length === 2 &&
            spec.engines.includes(a) &&
            spec.engines.includes(b),
        ).length,
      });
    }
  });

  const shippedBy = Object.fromEntries(
    ENGINES.map((engine) => [
      engine,
      specs.filter((spec) => spec.engines.includes(engine)).length,
    ]),
  );

  const categories = countBy(specs, (spec) => spec.category).map(
    ({ name, count }) => {
      const members = specs.filter((spec) => spec.category === name);
      return {
        name,
        count,
        buckets: Object.fromEntries(
          BUCKETS.map((bucket) => [
            bucket,
            members.filter((spec) => spec.bucket === bucket).length,
          ]),
        ),
      };
    },
  );

  const tested = specs
    .filter((spec) => typeof spec.interop === 'number' && spec.wpt)
    .sort((a, b) => a.interop - b.interop);

  const wpt = {
    tested,
    medianInterop: median(tested.map((spec) => spec.interop)),
    median: Object.fromEntries(
      BROWSERS.map((browser) => [
        browser,
        median(tested.map((spec) => spec.wpt[browser] ?? 0)),
      ]),
    ),
    perfect: tested.filter((spec) => spec.interop === 100).length,
    worst: tested[0],
  };

  const referenced = [...specs]
    .sort((a, b) => b.footprint - a.footprint || b.mdn - a.mdn)
    .slice(0, 8);

  const dated = specs
    .filter((spec) => spec.updated)
    .sort(
      (a, b) =>
        a.updated.localeCompare(b.updated) || a.title.localeCompare(b.title),
    );
  const years = countBy(dated, (spec) => spec.updated.slice(0, 4)).sort(
    (a, b) => a.name.localeCompare(b.name),
  );

  return {
    specs,
    total: specs.length,
    sources,
    origin,
    buckets,
    only,
    pairs,
    shippedBy,
    categories,
    wpt,
    referenced,
    dated,
    undated: specs.length - dated.length,
    years,
    orgs: countBy(specs, (spec) => spec.org),
    groups: countBy(specs, (spec) => spec.groups),
  };
}
