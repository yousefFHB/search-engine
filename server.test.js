const http = require("http");
const { test, expect } = require("@jest/globals");
const { buildInvertedIndex } = require("./indexer.js");
const { createServer } = require("./server.js");

function createTestSearchData() {
  const documents = [
    {
      id: 1,
      url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array",
      title: "Array",
      description: "JavaScript Array reference",
      headings: ["Array"],
      content: "Array objects store ordered collections and support map.",
    },
    {
      id: 2,
      url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise",
      title: "Promise",
      description: "JavaScript Promise reference",
      headings: ["Promise"],
      content: "Promise objects represent asynchronous work.",
    },
  ];
  const invertedIndex = buildInvertedIndex(documents, {
    createdAt: "2026-08-26T00:00:00.000Z",
  });

  return {
    documents,
    invertedIndex,
    crawlMetadata: {
      documentCount: documents.length,
      termCount: invertedIndex.termCount,
    },
  };
}

test("server returns ranked search results", async () => {
  const server = createServer({ searchData: createTestSearchData() });
  await listen(server);

  try {
    const response = await getJSON(server, "/api/search?q=array%20map&limit=5");

    expect(response.statusCode).toBe(200);
    expect(response.body.count).toBe(1);
    expect(response.body.results[0].title).toBe("Array");
  } finally {
    server.close();
  }
});

test("server returns corpus stats", async () => {
  const server = createServer({ searchData: createTestSearchData() });
  await listen(server);

  try {
    const response = await getJSON(server, "/api/stats");

    expect(response.statusCode).toBe(200);
    expect(response.body.documentCount).toBe(2);
    expect(response.body.termCount).toBeGreaterThan(0);
  } finally {
    server.close();
  }
});

test("server serves the search UI", async () => {
  const server = createServer({ searchData: createTestSearchData() });
  await listen(server);

  try {
    const response = await getText(server, "/");

    expect(response.statusCode).toBe(200);
    expect(response.body).toContain("MDN JavaScript Search");
  } finally {
    server.close();
  }
});

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });
}

function getJSON(server, path) {
  return getText(server, path).then((response) => ({
    ...response,
    body: JSON.parse(response.body),
  }));
}

function getText(server, path) {
  const { port } = server.address();

  return new Promise((resolve, reject) => {
    const request = http.get(
      {
        hostname: "127.0.0.1",
        port,
        path,
      },
      (response) => {
        let body = "";

        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          body += chunk;
        });
        response.on("end", () => {
          resolve({
            statusCode: response.statusCode,
            body,
          });
        });
      },
    );

    request.on("error", reject);
  });
}
