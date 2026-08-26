const {
  normalizeUrls,
  getURLsFromHTML,
  crawlSite,
  extractDocumentFromHTML,
} = require('./crawl.js');
const { test, expect } = require("@jest/globals");

test("normalizeUrls strip protocal", () => {
  const input = "https://blog.boot.dev/path";
  const actual = normalizeUrls(input);
  const expected = "blog.boot.dev/path";
  expect(actual).toEqual(expected);
});

test("normalizeUrls strip trailing slash", () => {
  const input = "https://blog.boot.dev/path/";
  const actual = normalizeUrls(input);
  const expected = "blog.boot.dev/path";
  expect(actual).toEqual(expected);
});

test("normalizeUrls strip http", () => {
  const input = "http://blog.boot.dev/path/";
  const actual = normalizeUrls(input);
  const expected = "blog.boot.dev/path";
  expect(actual).toEqual(expected);
});

test("normalizeUrls capitals", () => {
  const input = "https://BLOG.BOOT.DEV/PATH";
  const actual = normalizeUrls(input);
  const expected = "blog.boot.dev/path";
  expect(actual).toEqual(expected);
});

test("getURLsFromHTML absolute", () => {
  const inpuut = `
    <html>
     <body>
     <a href='https://blog.boot.dev/path'>Link</a>
     </body>
    </html>
  `;
  const inputBaseURL = "https://blog.boot.dev";
  const actual = getURLsFromHTML(inpuut, inputBaseURL);
  const expected = ["https://blog.boot.dev/path"];
  expect(actual).toEqual(expected);
});

test("getURLsFromHTML relative", () => {
  const inpuut = `
    <html>
     <body>
     <a href='/path/'>Link</a>
     </body>
    </html>
  `;
  const inputBaseURL = "https://blog.boot.dev";
  const actual = getURLsFromHTML(inpuut, inputBaseURL);
  const expected = ["https://blog.boot.dev/path/"];
  expect(actual).toEqual(expected);
});

test("getURLsFromHTML both", () => {
  const inpuut = `
    <html>
     <body>
     <a href='https://blog.boot.dev/path1'>Link1</a>
     <a href='/path2/'>Link2</a>
     </body>
    </html>
  `;
  const inputBaseURL = "https://blog.boot.dev";
  const actual = getURLsFromHTML(inpuut, inputBaseURL);
  const expected = [
    "https://blog.boot.dev/path1",
    "https://blog.boot.dev/path2/",
  ];
  expect(actual).toEqual(expected);
});

test("getURLsFromHTML invalid", () => {
  const inpuut = `
    <html>
     <body>
     <a href='invalid'>invalid Link</a>
     </body>
    </html>
  `;
  const inputBaseURL = "https://blog.boot.dev";
  const actual = getURLsFromHTML(inpuut, inputBaseURL);
  const expected = [];
  expect(actual).toEqual(expected);
});

test("extractDocumentFromHTML creates a searchable document", () => {
  const html = `
    <html>
      <head>
        <title>JavaScript | MDN</title>
        <meta name="description" content="JavaScript language reference">
      </head>
      <body>
        <main>
          <h1>JavaScript</h1>
          <h2>Guides</h2>
          <script>window.noisy = true;</script>
          <p>JavaScript is a programming language for the web.</p>
        </main>
      </body>
    </html>
  `;

  const actual = extractDocumentFromHTML(
    html,
    "https://developer.mozilla.org/en-US/docs/Web/JavaScript?x=1#overview",
    42,
    3,
  );

  expect(actual).toEqual({
    id: 42,
    url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript",
    title: "JavaScript",
    description: "JavaScript language reference",
    headings: ["JavaScript", "Guides"],
    content: "JavaScript Guides JavaScript is a programming language for the web.",
    inboundLinks: 3,
  });
});

test("crawlSite crawls pages and tracks link counts concurrently", async () => {
  const originalFetch = global.fetch;
  global.fetch = async (url) => {
    if (url === "https://blog.boot.dev") {
      return {
        status: 200,
        headers: { get: () => "text/html" },
        text: async () => `
          <html>
            <body>
              <a href="/path1">Path 1</a>
              <a href="/path2">Path 2</a>
            </body>
          </html>
        `,
      };
    }
    if (url === "https://blog.boot.dev/path1") {
      return {
        status: 200,
        headers: { get: () => "text/html" },
        text: async () => `
          <html>
            <body>
              <a href="/path2">Path 2 again</a>
            </body>
          </html>
        `,
      };
    }
    if (url === "https://blog.boot.dev/path2") {
      return {
        status: 200,
        headers: { get: () => "text/html" },
        text: async () => `<html><body><h1>No links</h1></body></html>`,
      };
    }
    return { status: 404, headers: { get: () => "text/html" } };
  };

  try {
    const { pages, brokenLinks } = await crawlSite("https://blog.boot.dev", {
      maxConcurrency: 3,
      maxPages: 10,
    });
    expect(pages).toEqual({
      "blog.boot.dev": 1,
      "blog.boot.dev/path1": 1,
      "blog.boot.dev/path2": 2,
    });
    expect(brokenLinks).toEqual([]);
  } finally {
    global.fetch = originalFetch;
  }
});

test("crawlSite returns extracted documents with inbound link counts", async () => {
  const originalFetch = global.fetch;
  global.fetch = async (url) => {
    if (url === "https://blog.boot.dev") {
      return {
        status: 200,
        headers: { get: () => "text/html" },
        text: async () => `
          <html>
            <head><title>Home</title></head>
            <body>
              <main>
                <h1>Home</h1>
                <p>Welcome to the docs.</p>
                <a href="/guide">Guide</a>
              </main>
            </body>
          </html>
        `,
      };
    }
    if (url === "https://blog.boot.dev/guide") {
      return {
        status: 200,
        headers: { get: () => "text/html" },
        text: async () => `
          <html>
            <head><title>Guide</title></head>
            <body><main><h1>Guide</h1><p>Docs guide content.</p></main></body>
          </html>
        `,
      };
    }
    return { status: 404, headers: { get: () => "text/html" } };
  };

  try {
    const { documents, metadata } = await crawlSite("https://blog.boot.dev", {
      maxConcurrency: 1,
      maxPages: 10,
    });

    expect(documents).toHaveLength(2);
    expect(documents[0].id).toBe(1);
    expect(documents[0].title).toBe("Home");
    expect(documents[1].id).toBe(2);
    expect(documents[1].title).toBe("Guide");
    expect(documents[1].inboundLinks).toBe(1);
    expect(metadata.indexedDocuments).toBe(2);
  } finally {
    global.fetch = originalFetch;
  }
});

test("crawlSite respects maxPages limit", async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => {
    return {
      status: 200,
      headers: { get: () => "text/html" },
      text: async () => `
        <html>
          <body>
            <a href="/p1">P1</a>
            <a href="/p2">P2</a>
            <a href="/p3">P3</a>
          </body>
        </html>
      `,
    };
  };

  try {
    const { pages } = await crawlSite("https://blog.boot.dev", {
      maxConcurrency: 2,
      maxPages: 2,
    });
    expect(Object.keys(pages).length).toBeGreaterThanOrEqual(1);
  } finally {
    global.fetch = originalFetch;
  }
});

test("crawlSite detects broken 404 links and tracks source URLs", async () => {
  const originalFetch = global.fetch;
  global.fetch = async (url) => {
    if (url === "https://blog.boot.dev") {
      return {
        status: 200,
        headers: { get: () => "text/html" },
        text: async () => `
          <html>
            <body>
              <a href="/broken-page">Broken Page</a>
            </body>
          </html>
        `,
      };
    }
    if (url === "https://blog.boot.dev/broken-page") {
      return {
        status: 404,
        headers: { get: () => "text/html" },
      };
    }
    return { status: 500, headers: { get: () => "text/html" } };
  };

  try {
    const { brokenLinks } = await crawlSite("https://blog.boot.dev", {
      maxConcurrency: 2,
      maxPages: 10,
    });
    expect(brokenLinks).toHaveLength(1);
    expect(brokenLinks[0]).toEqual({
      url: "https://blog.boot.dev/broken-page",
      status: 404,
      sourceURL: "https://blog.boot.dev",
    });
  } finally {
    global.fetch = originalFetch;
  }
});

