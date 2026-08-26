const form = document.querySelector("#searchForm");
const input = document.querySelector("#searchInput");
const button = document.querySelector("#searchButton");
const resultsElement = document.querySelector("#results");
const resultCountElement = document.querySelector("#resultCount");
const queryTimeElement = document.querySelector("#queryTime");
const statsLineElement = document.querySelector("#statsLine");
const API_ORIGIN = getAPIOrigin();

let debounceTimer = null;
let activeRequest = null;

form.addEventListener("submit", (event) => {
  event.preventDefault();
  runSearch(input.value);
});

input.addEventListener("input", () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => runSearch(input.value), 250);
});

loadStats();
runSearch(input.value);

async function loadStats() {
  try {
    const response = await fetch(getAPIURL("/api/stats"));
    const stats = await response.json();
    statsLineElement.textContent = `${formatNumber(stats.documentCount)} documents / ${formatNumber(stats.termCount)} terms`;
  } catch {
    statsLineElement.textContent = "Corpus unavailable";
  }
}

async function runSearch(rawQuery) {
  const query = rawQuery.trim();

  if (!query) {
    resultCountElement.textContent = "";
    queryTimeElement.textContent = "";
    renderEmpty("No query yet");
    return;
  }

  if (activeRequest) {
    activeRequest.abort();
  }

  const startedAt = performance.now();
  const controller = new AbortController();
  activeRequest = controller;
  setLoading(true);

  try {
    const response = await fetch(
      getAPIURL(`/api/search?q=${encodeURIComponent(query)}&limit=10`),
      { signal: controller.signal },
    );

    if (!response.ok) {
      throw new Error(`Search failed with status ${response.status}`);
    }

    const data = await response.json();
    const elapsed = Math.round(performance.now() - startedAt);
    resultCountElement.textContent = `${data.count} result${data.count === 1 ? "" : "s"}`;
    queryTimeElement.textContent = `${elapsed} ms`;
    renderResults(data.results);
  } catch (error) {
    if (error.name !== "AbortError") {
      resultCountElement.textContent = "";
      queryTimeElement.textContent = "";
      renderEmpty("Search failed");
    }
  } finally {
    if (activeRequest === controller) {
      activeRequest = null;
      setLoading(false);
    }
  }
}

function renderResults(results) {
  resultsElement.replaceChildren();

  if (results.length === 0) {
    renderEmpty("No results found");
    return;
  }

  const fragment = document.createDocumentFragment();

  for (const result of results) {
    fragment.appendChild(createResultCard(result));
  }

  resultsElement.appendChild(fragment);
}

function createResultCard(result) {
  const card = document.createElement("article");
  card.className = "result-card";

  const header = document.createElement("div");
  header.className = "result-header";

  const title = document.createElement("a");
  title.className = "result-title";
  title.href = result.url || "#";
  title.target = "_blank";
  title.rel = "noopener noreferrer";
  title.textContent = result.title || result.url || `Document ${result.id}`;

  const score = document.createElement("span");
  score.className = "score";
  score.textContent = formatScore(result.score);

  header.append(title, score);
  card.appendChild(header);

  if (result.url) {
    const url = document.createElement("a");
    url.className = "result-url";
    url.href = result.url;
    url.target = "_blank";
    url.rel = "noopener noreferrer";
    url.textContent = result.url;
    card.appendChild(url);
  }

  const snippet = document.createElement("p");
  snippet.className = "snippet";
  snippet.textContent = result.snippet || result.description || "";
  card.appendChild(snippet);

  if (result.matchedTerms && result.matchedTerms.length > 0) {
    const terms = document.createElement("div");
    terms.className = "terms";

    for (const matchedTerm of result.matchedTerms) {
      const term = document.createElement("span");
      term.className = "term";
      term.textContent = matchedTerm;
      terms.appendChild(term);
    }

    card.appendChild(terms);
  }

  return card;
}

function renderEmpty(message) {
  const empty = document.createElement("div");
  empty.className = "empty-state";
  empty.textContent = message;
  resultsElement.replaceChildren(empty);
}

function setLoading(isLoading) {
  button.disabled = isLoading;
  button.textContent = isLoading ? "Searching" : "Search";
}

function formatScore(score) {
  return Number(score || 0).toFixed(4);
}

function formatNumber(value) {
  return new Intl.NumberFormat().format(value || 0);
}

function getAPIOrigin() {
  if (window.location.port === "5500") {
    return "http://localhost:3000";
  }
  return "";
}

function getAPIURL(path) {
  return `${API_ORIGIN}${path}`;
}
