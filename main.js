const path = require("path");
const { crawlSite } = require("./crawl.js");
const { buildInvertedIndex, searchDocuments } = require("./indexer.js");
const { loadSearchData, saveSearchData } = require("./storage.js");

const DEFAULT_MDN_SEED =
  "https://developer.mozilla.org/en-US/docs/Web/JavaScript";
const DEFAULT_DATA_DIR = path.join(__dirname, "data");

async function main() {
  const [commandOrURL, ...args] = process.argv.slice(2);

  if (!commandOrURL) {
    printUsage();
    process.exit(1);
  }

  if (commandOrURL === "crawl") {
    await runCrawl(args);
    return;
  }

  if (commandOrURL === "search") {
    runSearch(args);
    return;
  }

  if (commandOrURL.startsWith("http://") || commandOrURL.startsWith("https://")) {
    await runLegacyCrawl(commandOrURL, args);
    return;
  }

  console.log(`unknown command: ${commandOrURL}`);
  printUsage();
  process.exit(1);
}

async function runCrawl(args) {
  const seedURL = args[0] || DEFAULT_MDN_SEED;
  const maxPages = parsePositiveInteger(args[1], "max-pages", 50);
  const maxConcurrency = parsePositiveInteger(args[2], "concurrency", 5);
  const dataDir = resolveDataDir(args[3]);

  await crawlAndSave({ seedURL, maxPages, maxConcurrency, dataDir });
}

async function runLegacyCrawl(seedURL, args) {
  const maxConcurrency = parsePositiveInteger(args[0], "concurrency", 5);
  const maxPages = parsePositiveInteger(args[1], "max-pages", 100);
  await crawlAndSave({
    seedURL,
    maxPages,
    maxConcurrency,
    dataDir: DEFAULT_DATA_DIR,
  });
}

async function crawlAndSave({ seedURL, maxPages, maxConcurrency, dataDir }) {
  const allowedPathPrefix = getDefaultAllowedPathPrefix(seedURL);

  console.log(`Starting crawl of ${seedURL}`);
  console.log(
    `Configuration: Concurrency = ${maxConcurrency}, Max Pages = ${maxPages}`,
  );
  if (allowedPathPrefix) {
    console.log(`Scope: ${new URL(seedURL).hostname}${allowedPathPrefix}`);
  }

  const { pages, brokenLinks, documents, metadata } = await crawlSite(seedURL, {
    maxConcurrency,
    maxPages,
    allowedPathPrefix,
  });

  const invertedIndex = buildInvertedIndex(documents);
  const files = saveSearchData(dataDir, documents, invertedIndex, {
    ...metadata,
    pageLinkCounts: pages,
    brokenLinks,
  });

  console.log("Crawl complete.");
  console.log(`Documents: ${documents.length}`);
  console.log(`Index terms: ${invertedIndex.termCount}`);
  console.log(`Broken links: ${brokenLinks.length}`);
  console.log(`Wrote ${files.documents}`);
  console.log(`Wrote ${files.invertedIndex}`);
  console.log(`Wrote ${files.crawlMetadata}`);
}

function runSearch(args) {
  const { query, limit, dataDir } = parseSearchArgs(args);

  if (!query) {
    console.log("no search query provided");
    printUsage();
    process.exit(1);
  }

  const { documents, invertedIndex } = loadSearchData(dataDir);
  const results = searchDocuments(query, documents, invertedIndex, { limit });

  console.log(`Found ${results.length} result(s) for "${query}"`);

  for (const [index, result] of results.entries()) {
    console.log("");
    console.log(`${index + 1}. ${result.title}`);
    console.log(`   Score: ${result.score}`);
    console.log(`   URL: ${result.url}`);
    console.log(`   Matched: ${result.matchedTerms.join(", ")}`);
    console.log(`   ${result.snippet}`);
  }
}

function parseSearchArgs(args) {
  const queryParts = [];
  let limit = 10;
  let dataDir = DEFAULT_DATA_DIR;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--limit") {
      limit = parsePositiveInteger(args[i + 1], "limit", 10);
      i++;
      continue;
    }

    if (arg.startsWith("--limit=")) {
      limit = parsePositiveInteger(arg.slice("--limit=".length), "limit", 10);
      continue;
    }

    if (arg === "--data") {
      dataDir = resolveDataDir(args[i + 1]);
      i++;
      continue;
    }

    if (arg.startsWith("--data=")) {
      dataDir = resolveDataDir(arg.slice("--data=".length));
      continue;
    }

    queryParts.push(arg);
  }

  return {
    query: queryParts.join(" ").trim(),
    limit,
    dataDir,
  };
}

function getDefaultAllowedPathPrefix(seedURL) {
  const urlObj = new URL(seedURL);
  if (urlObj.hostname !== "developer.mozilla.org") {
    return "";
  }
  return urlObj.pathname.endsWith("/")
    ? urlObj.pathname.slice(0, -1)
    : urlObj.pathname;
}

function resolveDataDir(dataDir = DEFAULT_DATA_DIR) {
  return path.isAbsolute(dataDir)
    ? dataDir
    : path.join(__dirname, dataDir || "data");
}

function parsePositiveInteger(value, name, defaultValue) {
  if (value === undefined || value === "") {
    return defaultValue;
  }

  const number = Number.parseInt(value, 10);
  if (Number.isNaN(number) || number < 1) {
    console.log(`invalid ${name} value, must be a positive integer`);
    process.exit(1);
  }

  return number;
}

function printUsage() {
  console.log("Usage:");
  console.log("  node main.js crawl [seedURL] [maxPages] [concurrency] [dataDir]");
  console.log("  node main.js search <query words> [--limit 10] [--data data]");
  console.log("");
  console.log("Examples:");
  console.log("  node main.js crawl");
  console.log(
    "  node main.js crawl https://developer.mozilla.org/en-US/docs/Web/JavaScript 100 5 data",
  );
  console.log("  node main.js search javascript array --limit 5");
}

main();
