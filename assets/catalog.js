"use strict";

const searchForm = document.getElementById("topic-search");
const queryInput = document.getElementById("query");
const clearButton = document.getElementById("clear-search");
const resultCount = document.getElementById("result-count");
const noResults = document.getElementById("no-results");

function normalize(text) {
  return text.normalize("NFKC").toLowerCase().trim();
}

const topics = Array.from(document.querySelectorAll("#topic-list > li"), (item) => {
  const title = item.querySelector("h3").textContent;
  const summary = item.querySelector("p").textContent;
  const keywords = item.dataset.keywords ?? "";
  return { item, searchText: normalize(`${title} ${summary} ${keywords}`) };
});

function filterTopics() {
  const query = normalize(queryInput.value);
  const terms = query ? query.split(/\s+/u) : [];
  let matches = 0;

  for (const { item, searchText } of topics) {
    const visible = terms.every((term) => searchText.includes(term));
    item.hidden = !visible;
    if (visible) matches += 1;
  }

  noResults.hidden = !query || matches > 0;
  clearButton.hidden = queryInput.value.length === 0;
  resultCount.textContent = query ? `找到 ${matches} 个主题` : `共 ${topics.length} 个主题`;
}

queryInput.addEventListener("input", (event) => {
  if (!event.isComposing) filterTopics();
});
queryInput.addEventListener("compositionend", filterTopics);
searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  filterTopics();
});
searchForm.addEventListener("reset", (event) => {
  event.preventDefault();
  queryInput.value = "";
  queryInput.focus();
  filterTopics();
});
window.addEventListener("pageshow", filterTopics);

filterTopics();
searchForm.hidden = false;
