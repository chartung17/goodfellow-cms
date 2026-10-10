import { describe, expect, it } from "vitest";
import {
  checkRecords,
  type DnsFetch,
  type DnsRecord,
  domainZone,
  normalizeDomain,
  recordsInPlace,
  registrarName,
} from "./domains.js";

const TYPE_NUMBERS: Record<string, number> = { A: 1, CNAME: 5, SOA: 6, TXT: 16, AAAA: 28 };

/** A fake of Google Public DNS's JSON API, answering from `zone` (name → type → values). */
function fakeDns(zone: Record<string, Record<string, string[]>>, soa: string[] = []): DnsFetch {
  return async (url) => {
    const name = decodeURIComponent(/[?&]name=([^&]*)/.exec(url)?.[1] ?? "");
    const type = /[?&]type=([^&]*)/.exec(url)?.[1] ?? "A";
    const answers = (zone[name]?.[type] ?? []).map((data) => ({ name: `${name}.`, type: TYPE_NUMBERS[type], data }));
    const apex = soa.find((candidate) => name === candidate || name.endsWith(`.${candidate}`));
    const body =
      type === "SOA"
        ? apex === name
          ? { Status: 0, Answer: [{ name: `${name}.`, type: 6, data: "ns1. host. 1 2 3 4 5" }] }
          : { Status: 0, Authority: apex ? [{ name: `${apex}.`, type: 6, data: "ns1. host. 1 2 3 4 5" }] : [] }
        : { Status: 0, Answer: answers };
    return { ok: true, status: 200, json: async () => body };
  };
}

const githubApex: DnsRecord[] = ["185.199.108.153", "185.199.109.153"].map((value) => ({
  type: "A",
  name: "example.org",
  value,
  purpose: "site",
}));

describe("normalizeDomain", () => {
  it("takes a domain from what someone typed", () => {
    expect(normalizeDomain(" https://www.Example.org/about ")).toBe("www.example.org");
    expect(normalizeDomain("example.co.uk.")).toBe("example.co.uk");
    expect(normalizeDomain("localhost")).toBeUndefined();
    expect(normalizeDomain("not a domain.org")).toBeUndefined();
    expect(normalizeDomain("192.168.0.1")).toBeUndefined();
    expect(normalizeDomain("example.org?from=a#top")).toBe("example.org");
    expect(normalizeDomain("example.org#a\nb")).toBe("example.org");
  });
});

describe("registrarName", () => {
  it("says what to type in a registrar's name field", () => {
    const record = (name: string): DnsRecord => ({ type: "TXT", name, value: "x", purpose: "verification" });
    expect(registrarName(record("example.org"), "example.org")).toBe("@");
    expect(registrarName(record("www.example.org"), "example.org")).toBe("www");
    expect(registrarName(record("_gitlab-pages-verification-code.www.example.org"), "example.org")).toBe(
      "_gitlab-pages-verification-code.www",
    );
  });
});

describe("domainZone", () => {
  it("finds the zone a domain belongs to, whatever its length", async () => {
    const dns = fakeDns({}, ["example.org", "example.co.uk"]);
    expect(await domainZone("example.org", dns)).toBe("example.org");
    expect(await domainZone("www.example.org", dns)).toBe("example.org");
    expect(await domainZone("example.co.uk", dns)).toBe("example.co.uk");
    expect(await domainZone("news.example.co.uk", dns)).toBe("example.co.uk");
  });
});

describe("checkRecords", () => {
  it("finds records in place, missing, or with something else instead", async () => {
    const records: DnsRecord[] = [
      ...githubApex,
      { type: "CNAME", name: "www.example.org", value: "someone.github.io", purpose: "www", optional: true },
      { type: "TXT", name: "_check.example.org", value: "code=123", purpose: "verification" },
    ];
    const checks = await checkRecords(
      records,
      fakeDns({
        "example.org": { A: ["185.199.108.153", "185.199.109.153"] },
        "_check.example.org": { TXT: ['"code=123"', '"v=spf1 -all"'] },
      }),
    );
    expect(checks.map((check) => check.state)).toEqual(["ok", "ok", "missing", "ok"]);
    expect(recordsInPlace(checks)).toBe(true);
  });

  it("counts a registrar's parked address left beside the host's as wrong", async () => {
    const checks = await checkRecords(
      githubApex,
      fakeDns({ "example.org": { A: ["185.199.108.153", "203.0.113.7"] } }),
    );
    expect(checks.map((check) => [check.state, check.found])).toEqual([
      ["wrong", ["203.0.113.7"]],
      ["wrong", ["203.0.113.7"]],
    ]);
    expect(recordsInPlace(checks)).toBe(false);
  });
});
