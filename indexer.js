const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "but",
  "by",
  "can",
  "for",
  "from",
  "has",
  "have",
  "if",
  "in",
  "into",
  "is",
  "it",
  "its",
  "of",
  "on",
  "or",
  "that",
  "the",
  "their",
  "then",
  "there",
  "this",
  "to",
  "was",
  "were",
  "will",
  "with",
  "you",
  "your",
]);

function tokenize(text) {
  return normalizeText(text)
    .split(" ")
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

function normalizeText(text = "") {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildInvertedIndex(documents, options = {}) {
  const createdAt = options.createdAt || new Date().toISOString();
  const documentCount = documents.length;
  const documentStats = new Map();
  const documentFrequency = {};
  const documentLengths = {};

  for (const document of documents) {
    const documentId = String(document.id);
    const tokens = tokenize(getWeightedDocumentText(document));
    const termCounts = {};

    for (const token of tokens) {
      termCounts[token] = (termCounts[token] || 0) + 1;
    }

    for (const term of Object.keys(termCounts)) {
      documentFrequency[term] = (documentFrequency[term] || 0) + 1;
    }

    documentLengths[documentId] = tokens.length;
    documentStats.set(documentId, {
      termCounts,
      totalTerms: tokens.length || 1,
    });
  }

  const terms = {};
  const sortedTerms = Object.keys(documentFrequency).sort();

  for (const term of sortedTerms) {
    const df = documentFrequency[term];
    const idf = calculateIDF(documentCount, df);
    const postings = [];

    for (const document of documents) {
      const documentId = String(document.id);
      const stats = documentStats.get(documentId);
      const count = stats.termCounts[term] || 0;

      if (count === 0) {
        continue;
      }

      const termFrequency = count / stats.totalTerms;
      postings.push({
        documentId: document.id,
        count,
        termFrequency: roundNumber(termFrequency),
        weight: roundNumber(termFrequency * idf),
      });
    }

    terms[term] = {
      documentFrequency: df,
      idf: roundNumber(idf),
      postings,
    };
  }

  return {
    schemaVersion: 1,
    createdAt,
    algorithm: "tf-idf",
    documentCount,
    termCount: sortedTerms.length,
    documentLengths,
    terms,
  };
}

function searchDocuments(query, documents, invertedIndex, options = {}) {
  const limit = Math.max(1, options.limit || 10);
  const queryTokens = tokenize(query);

  if (queryTokens.length === 0) {
    return [];
  }

  const queryCounts = countTerms(queryTokens);
  const scores = new Map();
  const matchedTerms = new Map();

  for (const [term, count] of Object.entries(queryCounts)) {
    const termEntry = invertedIndex.terms[term];
    if (!termEntry) {
      continue;
    }

    const queryTermFrequency = count / queryTokens.length;
    const queryWeight = queryTermFrequency * termEntry.idf;

    for (const posting of termEntry.postings) {
      const documentId = String(posting.documentId);
      const score = (scores.get(documentId) || 0) + queryWeight * posting.weight;
      scores.set(documentId, score);

      if (!matchedTerms.has(documentId)) {
        matchedTerms.set(documentId, new Set());
      }
      matchedTerms.get(documentId).add(term);
    }
  }

  const documentsById = new Map(
    documents.map((document) => [String(document.id), document]),
  );

  return Array.from(scores.entries())
    .map(([documentId, score]) => {
      const document = documentsById.get(documentId);
      return {
        id: document.id,
        score: roundNumber(score),
        title: document.title,
        url: document.url,
        description: document.description,
        snippet: createSnippet(document, queryTokens),
        matchedTerms: Array.from(matchedTerms.get(documentId) || []).sort(),
      };
    })
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score || a.id - b.id)
    .slice(0, limit);
}

function getWeightedDocumentText(document) {
  const title = repeatField(document.title, 4);
  const description = repeatField(document.description, 3);
  const headings = repeatField((document.headings || []).join(" "), 2);
  return [title, description, headings, document.content || ""].join(" ");
}

function repeatField(value = "", times = 1) {
  return Array(times).fill(value).join(" ");
}

function calculateIDF(totalDocuments, documentsWithTerm) {
  if (totalDocuments === 0 || documentsWithTerm === 0) {
    return 0;
  }
  return Math.log((1 + totalDocuments) / (1 + documentsWithTerm)) + 1;
}

function countTerms(tokens) {
  const counts = {};
  for (const token of tokens) {
    counts[token] = (counts[token] || 0) + 1;
  }
  return counts;
}

function createSnippet(document, queryTokens, maxLength = 220) {
  const source = document.content || document.description || "";
  if (source.length <= maxLength) {
    return source;
  }

  const lowerSource = source.toLowerCase();
  let firstMatch = -1;

  for (const token of [...new Set(queryTokens)]) {
    const index = lowerSource.indexOf(token);
    if (index !== -1 && (firstMatch === -1 || index < firstMatch)) {
      firstMatch = index;
    }
  }

  if (firstMatch === -1) {
    return `${source.slice(0, maxLength).trim()}...`;
  }

  const start = Math.max(0, firstMatch - Math.floor(maxLength / 3));
  const end = Math.min(source.length, start + maxLength);
  const prefix = start > 0 ? "..." : "";
  const suffix = end < source.length ? "..." : "";

  return `${prefix}${source.slice(start, end).trim()}${suffix}`;
}

function roundNumber(value, digits = 6) {
  return Number(value.toFixed(digits));
}

module.exports = {
  STOP_WORDS,
  tokenize,
  normalizeText,
  buildInvertedIndex,
  searchDocuments,
  calculateIDF,
  createSnippet,
};
