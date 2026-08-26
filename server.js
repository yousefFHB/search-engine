const fs = require("fs");
const http = require("http");
const path = require("path");
const { searchDocuments } = require("./indexer.js");
const { loadSearchData } = require("./storage.js");

const DEFAULT_PORT = 3000;
const DEFAULT_DATA_DIR = path.join(__dirname, "data");
const DEFAULT_PUBLIC_DIR = path.join(__dirname, "public");

function createServer(options = {}) {
  const dataDir = options.dataDir || DEFAULT_DATA_DIR;
  const publicDir = path.resolve(options.publicDir || DEFAULT_PUBLIC_DIR);
  const searchData = options.searchData || loadSearchData(dataDir);

  return http.createServer((request, response) => {
    const requestURL = new URL(
      request.url,
      `http://${request.headers.host || "localhost"}`,
    );

    if (request.method === "OPTIONS") {
      sendEmpty(response, 204);
      return;
    }

    if (requestURL.pathname === "/api/search") {
      handleSearch(requestURL, response, searchData);
      return;
    }

    if (requestURL.pathname === "/api/stats") {
      handleStats(response, searchData);
      return;
    }

    serveStaticFile(requestURL.pathname, response, publicDir);
  });
}

function handleSearch(requestURL, response, searchData) {
  const query = (requestURL.searchParams.get("q") || "").trim();
  const limit = parsePositiveInteger(requestURL.searchParams.get("limit"), 10);
  const results = query
    ? searchDocuments(query, searchData.documents, searchData.invertedIndex, {
        limit,
      })
    : [];

  sendJSON(response, 200, {
    query,
    count: results.length,
    results,
  });
}

function handleStats(response, searchData) {
  const metadata = searchData.crawlMetadata || {};
  sendJSON(response, 200, {
    documentCount: metadata.documentCount || searchData.documents.length,
    termCount: metadata.termCount || searchData.invertedIndex.termCount || 0,
    seedUrl: metadata.seedUrl || "",
    finishedAt: metadata.finishedAt || "",
  });
}

function serveStaticFile(pathname, response, publicDir) {
  const staticPath = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.resolve(publicDir, `.${decodeURIComponent(staticPath)}`);

  if (!isPathInside(filePath, publicDir)) {
    sendText(response, 403, "Forbidden");
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      sendText(response, 404, "Not found");
      return;
    }

    response.writeHead(200, {
      "content-type": getContentType(filePath),
      "cache-control": "no-cache",
    });
    response.end(content);
  });
}

function isPathInside(filePath, parentDir) {
  return filePath === parentDir || filePath.startsWith(`${parentDir}${path.sep}`);
}

function sendJSON(response, statusCode, body) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, OPTIONS",
    "access-control-allow-headers": "content-type",
  });
  response.end(JSON.stringify(body));
}

function sendEmpty(response, statusCode) {
  response.writeHead(statusCode, {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, OPTIONS",
    "access-control-allow-headers": "content-type",
  });
  response.end();
}

function sendText(response, statusCode, body) {
  response.writeHead(statusCode, {
    "content-type": "text/plain; charset=utf-8",
  });
  response.end(body);
}

function getContentType(filePath) {
  const extension = path.extname(filePath);
  const types = {
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
  };
  return types[extension] || "application/octet-stream";
}

function parsePositiveInteger(value, defaultValue) {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) || parsed < 1 ? defaultValue : parsed;
}

if (require.main === module) {
  const port = parsePositiveInteger(process.env.PORT, DEFAULT_PORT);

  try {
    const server = createServer();
    server.listen(port, () => {
      console.log(`Search UI running at http://localhost:${port}`);
    });
  } catch (error) {
    console.error(`Failed to start search UI: ${error.message}`);
    console.error("Run npm run crawl:mdn before starting the UI.");
    process.exit(1);
  }
}

module.exports = {
  createServer,
};
