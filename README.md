# Search Engine

This project builds on a custom concurrent web crawler and turns crawled pages
into a searchable local corpus.

i have used my own webcrawler project and impleneted it into this .
## Pipeline

```text
MDN Web Docs
  -> crawler
  -> structured documents
  -> inverted index
  -> TF-IDF search
```

The crawler saves the search data in:

```text
data/
  documents.json
  inverted-index.json
  crawl-metadata.json
```

Each document looks like this:

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

## Commands

Install dependencies:

```bash
npm install
```

Start the search UI:

```bash
npm start
```

Then open:

```text
http://localhost:3000
```

Crawl the default MDN JavaScript section:

```bash
npm run crawl:mdn
```

That command is the same as:

```bash
node main.js crawl https://developer.mozilla.org/en-US/docs/Web/JavaScript 50 5 data
```

Arguments are:

```text
node main.js crawl [seedURL] [maxPages] [concurrency] [dataDir]
```

Search the saved corpus:

```bash
npm run search -- javascript array --limit 5
```

Or directly:

```bash
node main.js search javascript array --limit 5 --data data
```

Run tests:

```bash
npm test
```

Use a different UI port:

```bash
$env:PORT=4000; npm start
```

## Notes

- MDN crawls are scoped to the seed path by default. Starting at
  `/en-US/docs/Web/JavaScript` keeps the corpus focused on JavaScript pages
  instead of wandering across the whole MDN site.
- The inverted index uses tokenization, stop-word filtering, normalized term
  frequency, and smoothed inverse document frequency.
- The search command reads `documents.json` and `inverted-index.json`; it does
  not query live websites.
