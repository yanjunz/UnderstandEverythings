"use strict";

(() => {
  const site = new URL("https://yanjunz.github.io/UnderstandEverythings/");
  const api = "https://abacus.jasoncameron.dev";
  const namespace = "yanjunz-understandeverythings";
  const summary = document.querySelector("[data-pageviews]");
  const value = summary?.querySelector("[data-pv-value]");
  if (!value) return;

  function pageKey(url) {
    if (url.origin !== site.origin || !url.pathname.startsWith(site.pathname)) return null;

    const relativePath = url.pathname.slice(site.pathname.length);
    if (relativePath === "" || relativePath === "index.html") return "home";

    const topic = /^topics\/([a-z0-9-]+)(?:\/(?:index\.html)?)?$/.exec(relativePath);
    return topic ? `topic-${topic[1]}` : null;
  }

  async function getCount(key, action, signal) {
    const response = await fetch(`${api}/${action}/${namespace}/${encodeURIComponent(key)}`, {
      signal,
      cache: "no-store",
      credentials: "omit",
      referrerPolicy: "no-referrer",
      keepalive: action === "hit",
    });
    const data = await response.json();

    if (action === "get" && response.status === 404 && data.error === "Key not found") {
      return 0;
    }
    if (!response.ok || !Number.isSafeInteger(data.value) || data.value < 0) {
      throw new Error("Page view counter returned an invalid response");
    }
    return data.value;
  }

  async function updatePageviews() {
    const currentKey = pageKey(new URL(location.href));
    if (!currentKey) {
      value.textContent = "仅线上统计";
      return;
    }

    const keys = new Set([currentKey]);
    if (summary.dataset.pageviews === "site") {
      for (const link of document.querySelectorAll("#topic-list a[href]")) {
        const key = pageKey(new URL(link.href));
        if (key) keys.add(key);
      }
    }

    value.textContent = "统计中…";
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const counts = await Promise.all(
        Array.from(keys, (key) => getCount(key, key === currentKey ? "hit" : "get", controller.signal)),
      );
      const total = counts.reduce((sum, count) => sum + count, 0);
      value.textContent = `${new Intl.NumberFormat("zh-CN").format(total)} 次`;
    } catch {
      // An increment may already have reached the service, so do not retry it.
      value.textContent = "暂不可用";
    } finally {
      clearTimeout(timeout);
    }
  }

  if (document.prerendering) {
    document.addEventListener("prerenderingchange", updatePageviews, { once: true });
  } else {
    updatePageviews();
  }
})();
