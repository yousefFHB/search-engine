const {
  sortPages,
  generateCSV,
  generateBrokenLinksCSV,
  generateHTMLReport,
} = require("./report.js");
const { test, expect } = require("@jest/globals");

test("sortPages sorts pages by count", () => {
  const input = {
    "https://wagslane.dev": 3,
    "https://wagslane.dev/path": 1,
    "https://wagslane.dev/path2": 5,
    "https://wagslane.dev/path3": 6,
    "https://wagslane.dev/path4": 9,
    "https://wagslane.dev/path5": 2
  };
  
  const actual = sortPages(input);
  const expected = [
    ["https://wagslane.dev/path4", 9],
    ["https://wagslane.dev/path3", 6],
    ["https://wagslane.dev/path2", 5],
    ["https://wagslane.dev", 3],
     ["https://wagslane.dev/path5", 2],
    ["https://wagslane.dev/path", 1],
  ];

  expect(actual).toEqual(expected);
});

test("generateCSV produces valid CSV content", () => {
  const input = {
    "https://wagslane.dev": 3,
    "https://wagslane.dev/path": 1,
  };

  const actual = generateCSV(input);
  const expected = "URL,Link Count\nhttps://wagslane.dev,3\nhttps://wagslane.dev/path,1\n";

  expect(actual).toEqual(expected);
});

test("generateBrokenLinksCSV produces valid CSV content", () => {
  const input = [
    {
      url: "https://wagslane.dev/missing",
      status: 404,
      sourceURL: "https://wagslane.dev",
    },
    {
      url: "https://wagslane.dev/error",
      status: "Error: Failed to fetch",
      sourceURL: "https://wagslane.dev/blog",
    },
  ];

  const actual = generateBrokenLinksCSV(input);
  const expected =
    "Broken URL,Status Code / Error,Found On Page\nhttps://wagslane.dev/missing,404,https://wagslane.dev\nhttps://wagslane.dev/error,Error: Failed to fetch,https://wagslane.dev/blog\n";

  expect(actual).toEqual(expected);
});

test("generateHTMLReport produces valid HTML containing charts and metrics", () => {
  const pages = {
    "https://wagslane.dev": 5,
    "https://wagslane.dev/about": 2,
  };
  const brokenLinks = [
    {
      url: "https://wagslane.dev/broken",
      status: 404,
      sourceURL: "https://wagslane.dev",
    },
  ];

  const html = generateHTMLReport(pages, brokenLinks, "https://wagslane.dev");
  expect(html).toContain("<!DOCTYPE html>");
  expect(html).toContain("Crawl Audit Report");
  expect(html).toContain("https://wagslane.dev");
  expect(html).toContain("topPagesChart");
  expect(html).toContain("healthChart");
});

