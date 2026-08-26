const fs = require("fs");
const path = require("path");

const DOCUMENTS_FILENAME = "documents.json";
const INVERTED_INDEX_FILENAME = "inverted-index.json";
const CRAWL_METADATA_FILENAME = "crawl-metadata.json";

function saveSearchData(dataDir, documents, invertedIndex, metadata = {}) {
  fs.mkdirSync(dataDir, { recursive: true });

  const files = {
    documents: path.join(dataDir, DOCUMENTS_FILENAME),
    invertedIndex: path.join(dataDir, INVERTED_INDEX_FILENAME),
    crawlMetadata: path.join(dataDir, CRAWL_METADATA_FILENAME),
  };

  writeJSON(files.documents, documents);
  writeJSON(files.invertedIndex, invertedIndex);
  writeJSON(files.crawlMetadata, {
    ...metadata,
    termCount: invertedIndex.termCount,
    documentCount: documents.length,
    generatedFiles: {
      documents: DOCUMENTS_FILENAME,
      invertedIndex: INVERTED_INDEX_FILENAME,
      crawlMetadata: CRAWL_METADATA_FILENAME,
    },
  });

  return files;
}

function loadSearchData(dataDir = "data") {
  return {
    documents: readJSON(path.join(dataDir, DOCUMENTS_FILENAME)),
    invertedIndex: readJSON(path.join(dataDir, INVERTED_INDEX_FILENAME)),
    crawlMetadata: readJSON(path.join(dataDir, CRAWL_METADATA_FILENAME)),
  };
}

function writeJSON(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function readJSON(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

module.exports = {
  DOCUMENTS_FILENAME,
  INVERTED_INDEX_FILENAME,
  CRAWL_METADATA_FILENAME,
  saveSearchData,
  loadSearchData,
};
