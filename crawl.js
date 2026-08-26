const { JSDOM } = require("jsdom");

/**
 * Concurrently crawls a website starting from baseURL, extracts searchable documents,
 * and tracks broken links (404s/errors).
 * @param {string} baseURL - Root URL to crawl.
 * @param {Object} [options] - Crawl options.
 * @param {number} [options.maxConcurrency=5] - Maximum concurrent fetch requests.
 * @param {number} [options.maxPages=100] - Maximum unique pages to fetch.
 * @param {string} [options.allowedPathPrefix] - Optional path prefix to keep crawls scoped.
 * @param {Function} [options.fetchImpl=fetch] - Fetch implementation for tests.
 * @returns {Promise<{pages: Object, brokenLinks: Array<{url: string, status: number|string, sourceURL: string}>, documents: Array, metadata: Object}>}
 */
async function crawlSite(baseURL, options = {}) {
  const maxConcurrency = Math.max(1, options.maxConcurrency || 5);
  const maxPages = Math.max(1, options.maxPages || 100);
  const fetchImpl = options.fetchImpl || fetch;
  const allowedPathPrefix = normalizePathPrefix(options.allowedPathPrefix || "");

  const baseUrlObj = new URL(baseURL);
  const baseHostname = baseUrlObj.hostname;

  const pages = {};
  const brokenLinks = [];
  const documents = [];
  const inboundSources = {};
  const visited = new Set();
  const queue = [{ url: baseURL, sourceURL: null }];
  const startedAt = new Date();
  let skippedNonHtml = 0;

  const initialNormalized = normalizeUrls(baseURL);
  pages[initialNormalized] = 1;
  visited.add(initialNormalized);

  let activeRequests = 0;
  let fetchedCount = 0;
  let finished = false;

  return new Promise((resolve) => {
    function finishCrawl() {
      if (finished) {
        return;
      }
      finished = true;

      const finishedAt = new Date();
      const finalizedDocuments = documents
        .sort((a, b) => a.crawlOrder - b.crawlOrder)
        .map((document, index) => {
          const { crawlOrder, ...publicDocument } = document;
          const normalizedURL = normalizeUrls(publicDocument.url);
          return {
            ...publicDocument,
            id: index + 1,
            inboundLinks: inboundSources[normalizedURL]
              ? inboundSources[normalizedURL].size
              : 0,
          };
        });

      resolve({
        pages,
        brokenLinks,
        documents: finalizedDocuments,
        metadata: {
          seedUrl: canonicalizeURL(baseURL),
          hostname: baseHostname,
          allowedPathPrefix: allowedPathPrefix || null,
          maxConcurrency,
          maxPages,
          fetchedPages: fetchedCount,
          discoveredPages: Object.keys(pages).length,
          indexedDocuments: finalizedDocuments.length,
          brokenLinks: brokenLinks.length,
          skippedNonHtml,
          startedAt: startedAt.toISOString(),
          finishedAt: finishedAt.toISOString(),
          durationSeconds: Number(((finishedAt - startedAt) / 1000).toFixed(2)),
        },
      });
    }

    function processQueue() {
      if (queue.length === 0 && activeRequests === 0) {
        return finishCrawl();
      }

      if (fetchedCount >= maxPages) {
        if (activeRequests === 0) {
          return finishCrawl();
        }
        return;
      }

      while (
        queue.length > 0 &&
        activeRequests < maxConcurrency &&
        fetchedCount < maxPages
      ) {
        const item = queue.shift();
        const { url: currentURL, sourceURL } = item;
        activeRequests++;
        fetchedCount++;
        const crawlOrder = fetchedCount;

        crawlSinglePage(currentURL, sourceURL, crawlOrder)
          .then((nextURLs) => {
            for (const nextURL of nextURLs) {
              try {
                const nextUrlObj = new URL(nextURL);
                if (
                  isURLInCrawlScope(nextUrlObj, baseHostname, allowedPathPrefix)
                ) {
                  const normalizedNext = normalizeUrls(nextURL);
                  pages[normalizedNext] = (pages[normalizedNext] || 0) + 1;
                  if (!inboundSources[normalizedNext]) {
                    inboundSources[normalizedNext] = new Set();
                  }
                  inboundSources[normalizedNext].add(currentURL);

                  if (
                    !visited.has(normalizedNext) &&
                    fetchedCount + queue.length < maxPages
                  ) {
                    visited.add(normalizedNext);
                    queue.push({ url: nextURL, sourceURL: currentURL });
                  }
                }
              } catch {
                // Ignore invalid URLs
              }
            }
          })
          .catch((err) => {
            console.error(`error crawling ${currentURL}: ${err.message}`);
          })
          .finally(() => {
            activeRequests--;
            processQueue();
          });
      }
    }

    async function crawlSinglePage(currentURL, sourceURL, crawlOrder) {
      try {
        const resp = await fetchImpl(currentURL, {
          headers: {
            accept: "text/html,application/xhtml+xml",
            "user-agent": "search-engine-learning-crawler/1.0",
          },
        });
        if (resp.status > 399) {
          brokenLinks.push({
            url: currentURL,
            status: resp.status,
            sourceURL: sourceURL || "Seed URL",
          });
          console.log(
            `⚠️ Broken link [${resp.status}] at: ${currentURL} (Found on: ${sourceURL || "Seed URL"})`,
          );
          return [];
        }
        const contentType = resp.headers.get("content-type");
        if (!contentType || !contentType.includes("text/html")) {
          console.log(`not html response : ${contentType} on page : ${currentURL}`);
          skippedNonHtml++;
          return [];
        }
        const htmlBody = await resp.text();
        documents.push({
          ...extractDocumentFromHTML(htmlBody, currentURL, 0),
          crawlOrder,
        });
        return getURLsFromHTML(htmlBody, currentURL);
      } catch (err) {
        brokenLinks.push({
          url: currentURL,
          status: `Error: ${err.message}`,
          sourceURL: sourceURL || "Seed URL",
        });
        console.error(
          `⚠️ Fetch error at ${currentURL}: ${err.message} (Found on: ${sourceURL || "Seed URL"})`,
        );
        return [];
      }
    }

    processQueue();
  });
}

async function crawlPage(currentURL, baseURL, pages) {
  const baseUrlObj = new URL(baseURL);
  const currentUrlObj = new URL(currentURL);
  if (baseUrlObj.hostname !== currentUrlObj.hostname) {
    return pages;
  }
  const normalizedCurrentURL = normalizeUrls(currentURL);
  if (pages[normalizedCurrentURL] > 0) {
    pages[normalizedCurrentURL]++;
    return pages;
  }
  pages[normalizedCurrentURL] = 1;
  try {
    const resp = await fetch(currentURL);
    if (resp.status > 399) {
      console.log(
        `error in fetch with status code : ${resp.status} on page :${currentURL}`,
      );
      return pages;
    }
    const contentType = resp.headers.get("content-type");
    if (!contentType.includes("text/html")) {
      console.log(`not html response : ${contentType} on page :${currentURL}`);
      return pages;
    }
    const htmlBody = await resp.text();
    const nextURLs = getURLsFromHTML(htmlBody, currentURL);
    for (const nextURL of nextURLs) {
      pages = await crawlPage(nextURL, baseURL, pages);
    }
  } catch (error) {
    console.error(
      `error occurred while fetching ${currentURL}: ${error.message}`,
    );
  }
  return pages;
}

function getURLsFromHTML(htmlbody, baseURL) {
  const urls = [];
  const dom = new JSDOM(htmlbody);
  const links = dom.window.document.querySelectorAll("a");
  for (const link of links) {
    const rawHref = link.getAttribute("href");
    if (!isCrawlableHref(rawHref)) {
      continue;
    }

    try {
      const urlObj = new URL(rawHref, baseURL);
      if (urlObj.protocol !== "http:" && urlObj.protocol !== "https:") {
        continue;
      }
      urlObj.hash = "";
      urlObj.search = "";
      urls.push(urlObj.href);
    } catch (error) {
      console.log(`error with url : ${error.message}`);
    }
  }
  return urls;
}

function normalizeUrls(urlString) {
  const urlObj = new URL(urlString);
  urlObj.hash = "";
  urlObj.search = "";
  const hostpath = `${urlObj.hostname}${urlObj.pathname}`;
  if (hostpath.length > 0 && hostpath.slice(-1) === "/") {
    return hostpath.slice(0, -1).toLocaleLowerCase();
  }
  return hostpath.toLocaleLowerCase();
}

function extractDocumentFromHTML(htmlBody, url, id = 0, inboundLinks = 0) {
  const dom = new JSDOM(htmlBody);
  const document = dom.window.document;
  const contentRoot =
    document.querySelector("main") ||
    document.querySelector("article") ||
    document.body ||
    document.documentElement;

  if (contentRoot) {
    contentRoot
      .querySelectorAll(
        "script, style, noscript, svg, nav, footer, header, form, button, input, select, textarea, aside",
      )
      .forEach((node) => node.remove());
  }

  const title =
    cleanTitle(
      getMetaContent(document, [
        'meta[property="og:title"]',
        'meta[name="twitter:title"]',
      ]) || document.title,
    ) || canonicalizeURL(url);

  const description =
    getMetaContent(document, [
      'meta[name="description"]',
      'meta[property="og:description"]',
      'meta[name="twitter:description"]',
    ]) || "";

  const headings = Array.from(
    (contentRoot || document).querySelectorAll("h1, h2, h3"),
  )
    .map((heading) => normalizeWhitespace(heading.textContent))
    .filter(Boolean);

  const content = normalizeWhitespace(
    (contentRoot || document.body || document.documentElement).textContent,
  );

  return {
    id,
    url: canonicalizeURL(url),
    title,
    description: normalizeWhitespace(description),
    headings: [...new Set(headings)],
    content,
    inboundLinks,
  };
}

function getMetaContent(document, selectors) {
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    const content = element ? normalizeWhitespace(element.getAttribute("content")) : "";
    if (content) {
      return content;
    }
  }
  return "";
}

function cleanTitle(title) {
  return normalizeWhitespace(title)
    .replace(/\s*\|\s*MDN\s*$/i, "")
    .replace(/\s*-\s*MDN Web Docs\s*$/i, "");
}

function normalizeWhitespace(value = "") {
  return String(value).replace(/\s+/g, " ").trim();
}

function canonicalizeURL(urlString) {
  const urlObj = new URL(urlString);
  urlObj.hash = "";
  urlObj.search = "";
  return urlObj.href;
}

function isCrawlableHref(rawHref) {
  if (!rawHref) {
    return false;
  }

  const href = rawHref.trim();
  return (
    href.startsWith("/") ||
    href.startsWith("./") ||
    href.startsWith("../") ||
    href.startsWith("http://") ||
    href.startsWith("https://")
  );
}

function isURLInCrawlScope(urlObj, baseHostname, allowedPathPrefix = "") {
  if (urlObj.hostname !== baseHostname) {
    return false;
  }
  return !allowedPathPrefix || urlObj.pathname.startsWith(allowedPathPrefix);
}

function normalizePathPrefix(pathPrefix) {
  if (!pathPrefix) {
    return "";
  }
  const normalized = pathPrefix.startsWith("/") ? pathPrefix : `/${pathPrefix}`;
  if (normalized === "/") {
    return "";
  }
  return normalized.endsWith("/") ? normalized.slice(0, -1) : normalized;
}

module.exports = {
  normalizeUrls,
  getURLsFromHTML,
  crawlPage,
  crawlSite,
  extractDocumentFromHTML,
  canonicalizeURL,
  isURLInCrawlScope,
};
