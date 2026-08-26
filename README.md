# Mini Search Engine

A JavaScript search engine built from scratch using a custom web crawler,
document extraction, an inverted index, TF-IDF ranking, and a simple browser UI.

The project currently crawls MDN Web Docs and saves the crawled pages as a local
search corpus. Searches run against local JSON files, not live websites.

i have used my own webcrawler project and impleneted it into this .


## Features

- Concurrent web crawler built with Node.js
- URL normalization and same-site crawl scoping
- HTML parsing and text extraction with JSDOM
- Structured document collection saved as JSON
- Inverted index saved as JSON
- Tokenization, stop-word filtering, and TF-IDF ranking
- Command-line search
- Simple web UI with a local search API
- Jest tests for crawler, indexer, server, and report helpers

## Project Structure

```text
search-engine/
  crawl.js               # Crawler, URL parsing, document extraction
  indexer.js             # Tokenizer, inverted index, TF-IDF search
  storage.js             # Reads and writes search JSON files
  server.js              # Local web server and search API
  main.js                # CLI for crawling and searching
  public/
    index.html           # Search UI
    styles.css
    app.js
  data/
    documents.json
    inverted-index.json
    crawl-metadata.json
```

## How It Works

```text
MDN Web Docs
  -> crawler
  -> extracted documents
  -> inverted index
  -> TF-IDF ranking
  -> search API
  -> browser UI
```

Each crawled page becomes a document like this:

```json
{
  "id": 1,
  "url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript",
  "title": "JavaScript",
  "description": "JavaScript is a scripting language...",
  "headings": ["JavaScript", "Guides", "References"],
  "content": "JavaScript is a programming language...",
  "inboundLinks": 4
}
```

## Requirements

- Node.js 18 or newer
- npm

## Setup

Install dependencies:

```bash
npm install
```

## Crawl MDN And Build The Index

Run the default MDN JavaScript crawl:

```bash
npm run crawl:mdn
```

This creates or updates:

```text
data/documents.json
data/inverted-index.json
data/crawl-metadata.json
```

The default script crawls 50 pages from the MDN JavaScript section:

```bash
node main.js crawl https://developer.mozilla.org/en-US/docs/Web/JavaScript 50 5 data
```

The crawl command format is:

```text
node main.js crawl [seedURL] [maxPages] [concurrency] [dataDir]
```

Example with more pages:

```bash
node main.js crawl https://developer.mozilla.org/en-US/docs/Web/JavaScript 100 5 data
```

## Start The Search UI

Start the local server:

```bash
npm start
```

Open the UI:

```text
http://localhost:3000
```

The UI calls these local API endpoints:

```text
GET /api/search?q=javascript%20array&limit=10
GET /api/stats
```

Use a different port in PowerShell:

```bash
$env:PORT=4000; npm start
```

Then open:

```text
http://localhost:4000
```

## Search From The Command Line

Search the saved corpus:

```bash
npm run search -- javascript array --limit 5
```

Or run the CLI directly:

```bash
node main.js search javascript array --limit 5 --data data
```

## Important UI Note

Do not open `public/index.html` as a plain file if you want search to work.
The app needs the Node server because the browser UI calls `/api/search`.

Recommended:

```text
http://localhost:3000
```

If you use VS Code Live Server on port `5500`, keep `npm start` running too.
The frontend can load from Live Server, but the search API still comes from the
Node server.

## Run Tests

```bash
npm test
```

## Useful Scripts

```text
npm start       # Start the web UI and search API
npm run ui      # Same as npm start
npm run crawl:mdn
npm run search -- <query>
npm test
```

## Notes

- MDN crawls are scoped to the seed path by default. Starting at
  `/en-US/docs/Web/JavaScript` keeps the corpus focused on JavaScript pages.
- The inverted index uses normalized term frequency and smoothed inverse
  document frequency.
- Search results are ranked locally from `documents.json` and
  `inverted-index.json`.
