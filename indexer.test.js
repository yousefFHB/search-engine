const {
  tokenize,
  buildInvertedIndex,
  searchDocuments,
  calculateIDF,
} = require("./indexer.js");
const { test, expect } = require("@jest/globals");

test("tokenize normalizes text and removes stop words", () => {
  const actual = tokenize("The JavaScript Array.map() method is useful!");
  expect(actual).toEqual(["javascript", "array", "map", "method", "useful"]);
});

test("buildInvertedIndex stores TF-IDF postings", () => {
  const documents = [
    {
      id: 1,
      title: "JavaScript Arrays",
      description: "",
      headings: ["Array methods"],
      content: "Arrays store ordered lists of values.",
    },
    {
      id: 2,
      title: "Fetch API",
      description: "",
      headings: ["Requests"],
      content: "Fetch makes network requests from JavaScript.",
    },
  ];

  const index = buildInvertedIndex(documents, {
    createdAt: "2026-08-26T00:00:00.000Z",
  });

  expect(index.algorithm).toBe("tf-idf");
  expect(index.documentCount).toBe(2);
  expect(index.terms.javascript.documentFrequency).toBe(2);
  expect(index.terms.array.documentFrequency).toBe(1);
  expect(index.terms.array.idf).toBeCloseTo(calculateIDF(2, 1));
  expect(index.terms.array.postings[0]).toEqual(
    expect.objectContaining({
      documentId: 1,
      count: expect.any(Number),
      termFrequency: expect.any(Number),
      weight: expect.any(Number),
    }),
  );
});

test("searchDocuments ranks matching documents", () => {
  const documents = [
    {
      id: 1,
      title: "JavaScript Arrays",
      description: "Array reference",
      headings: ["Array methods"],
      content: "Array map creates a new array by calling a function.",
    },
    {
      id: 2,
      title: "Promises",
      description: "Async JavaScript",
      headings: ["Promise guide"],
      content: "Promises represent asynchronous operations.",
    },
  ];
  const index = buildInvertedIndex(documents);

  const results = searchDocuments("array map", documents, index, { limit: 5 });

  expect(results).toHaveLength(1);
  expect(results[0]).toEqual(
    expect.objectContaining({
      id: 1,
      title: "JavaScript Arrays",
      url: undefined,
      matchedTerms: ["array", "map"],
    }),
  );
});
