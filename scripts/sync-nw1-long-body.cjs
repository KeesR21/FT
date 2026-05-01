/**
 * Copies LONG_TRIALS_ARTICLE_HTML from src/lib/long-sample-post-body.ts into data/site-content.json (nw-1).
 * Run after editing the .ts file: node scripts/sync-nw1-long-body.cjs
 */
const fs = require("fs");
const path = require("path");

const tsPath = path.join(__dirname, "../src/lib/long-sample-post-body.ts");
const ts = fs.readFileSync(tsPath, "utf8");
const match = ts.match(/export const LONG_TRIALS_ARTICLE_HTML = `([\s\S]*)`;/);
if (!match) {
  console.error("Could not parse LONG_TRIALS_ARTICLE_HTML from", tsPath);
  process.exit(1);
}
const html = match[1];
const sitePath = path.join(__dirname, "../data/site-content.json");
const site = JSON.parse(fs.readFileSync(sitePath, "utf8"));
const post = site.newsPosts.find((p) => p.id === "nw-1");
if (!post) {
  console.error("nw-1 not found");
  process.exit(1);
}
post.content = html;
fs.writeFileSync(sitePath, JSON.stringify(site, null, 2), "utf8");
console.log("Updated nw-1 content, chars:", html.length);
