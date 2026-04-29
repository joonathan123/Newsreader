const STORAGE_KEY = "rss-dashboard-webapp-feeds-v1";

const defaultFeeds = [
  { title: "SVT Nyheter", url: "https://rss.svt.se/rss/nyheter.rss", limit: 6 },
  { title: "BBC News", url: "https://feeds.bbci.co.uk/news/rss.xml", limit: 6 },
  { title: "The Verge", url: "https://www.theverge.com/rss/index.xml", limit: 6 },
  { title: "TechCrunch", url: "https://feeds.feedburner.com/TechCrunch/", limit: 6 }
];

let feeds = loadFeeds();
let allItems = [];
let editing = false;
let currentView = "widgets";

const $ = (id) => document.getElementById(id);

function loadFeeds() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || defaultFeeds; }
  catch { return defaultFeeds; }
}
function saveFeeds() { localStorage.setItem(STORAGE_KEY, JSON.stringify(feeds)); }
function stripHtml(html = "") { const el = document.createElement("div"); el.innerHTML = html; return (el.textContent || el.innerText || "").trim(); }
function firstImageFromHtml(html = "") { const el = document.createElement("div"); el.innerHTML = html; return el.querySelector("img")?.src || ""; }
function imageFromJsonItem(item) { return item.thumbnail || item.enclosure?.link || item.enclosure?.url || firstImageFromHtml(item.description || item.content || "") || ""; }
function imageFromXmlItem(item) { const media = item.querySelector("media\\:content, content, enclosure, media\\:thumbnail"); const url = media?.getAttribute("url"); if (url && /\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(url)) return url; return firstImageFromHtml(item.querySelector("description, summary, content\\:encoded")?.textContent || ""); }

async function fetchWithRss2Json(feed) {
  const api = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feed.url)}`;
  const response = await fetch(api);
  if (!response.ok) throw new Error(`rss2json HTTP ${response.status}`);
  const json = await response.json();
  if (json.status !== "ok" || !Array.isArray(json.items)) throw new Error(json.message || "rss2json kunde inte lÃ¤sa flÃ¶det");
  return json.items.map((item) => ({
    title: item.title || "Utan rubrik",
    link: item.link || "",
    description: stripHtml(item.description || item.content || "").slice(0, 260),
    bodyHtml: item.content || item.description || "",
    image: imageFromJsonItem(item),
    date: item.pubDate ? new Date(item.pubDate) : new Date(),
    source: feed.title,
    feedUrl: feed.url
  }));
}

async function fetchWithAllOrigins(feed) {
  const api = `https://api.allorigins.win/raw?url=${encodeURIComponent(feed.url)}`;
  const response = await fetch(api);
  if (!response.ok) throw new Error(`AllOrigins HTTP ${response.status}`);
  const xmlText = await response.text();
  const doc = new DOMParser().parseFromString(xmlText, "text/xml");
  if (doc.querySelector("parsererror")) throw new Error("Kunde inte tolka RSS-flÃ¶det");
  return [...doc.querySelectorAll("item, entry")].map((item) => {
    const title = item.querySelector("title")?.textContent?.trim() || "Utan rubrik";
    const link = item.querySelector("link")?.getAttribute("href") || item.querySelector("link")?.textContent?.trim() || "";
    const rawDescription = item.querySelector("description")?.textContent || item.querySelector("summary")?.textContent || item.querySelector("content\\:encoded")?.textContent || "";
    const date = item.querySelector("pubDate")?.textContent || item.querySelector("updated")?.textContent || item.querySelector("published")?.textContent || "";
    return { title, link, description: stripHtml(rawDescription).slice(0, 260), bodyHtml: rawDescription, image: imageFromXmlItem(item), date: date ? new Date(date) : new Date(), source: feed.title, feedUrl: feed.url };
  });
}

async function fetchFeed(feed) {
  try { return await fetchWithRss2Json(feed); }
  catch (e1) {
    console.warn("rss2json failed, trying AllOrigins", feed.url, e1);
    try { return await fetchWithAllOrigins(feed); }
    catch (e2) { console.warn("AllOrigins failed", feed.url, e2); throw new Error("Kunde inte lÃ¤sa RSS-flÃ¶det via proxy"); }
  }
}

async function refresh() {
  $("refreshBtn").textContent = "Uppdaterarâ¦";
  const results = await Promise.allSettled(feeds.map(fetchFeed));
  allItems = [];
  results.forEach((result, index) => {
    if (result.status === "fulfilled") { allItems.push(...result.value); feeds[index].error = ""; }
    else { feeds[index].error = result.reason?.message || "Kunde inte lÃ¤sa flÃ¶det"; }
  });
  allItems.sort((a, b) => b.date - a.date);
  $("updatedText").textContent = `Senast uppdaterad: ${new Date().toLocaleString("sv-SE", { dateStyle: "medium", timeStyle: "short" })}`;
  $("refreshBtn").textContent = "Uppdatera";
  render();
}

function render() { document.body.classList.toggle("editing", editing); $("widgetsView").classList.toggle("hidden", currentView !== "widgets"); $("flowView").classList.toggle("hidden", currentView !== "flow"); renderWidgets(); renderFlow(); }
function articleMarkup(item) { return `<img class="thumb" src="${item.image || ""}" alt="" onerror="this.style.visibility='hidden'"><div><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.description || "Ingen ingress tillgÃ¤nglig.")}</p><p class="muted">${escapeHtml(item.source)} Â· ${formatDate(item.date)}</p></div>`; }

function renderWidgets() {
  const root = $("widgetsView"); root.innerHTML = "";
  feeds.forEach((feed, feedIndex) => {
    const widget = document.createElement("article"); widget.className = "widget";
    const items = allItems.filter((item) => item.feedUrl === feed.url).slice(0, feed.limit || 6);
    widget.innerHTML = `<header class="widget-header"><div><p class="eyebrow">${items.length ? `${items.length} artiklar` : feed.error ? "Fel" : "RSS"}</p><h2>${escapeHtml(feed.title)}</h2>${feed.error ? `<p class="muted">${escapeHtml(feed.error)}</p>` : ""}</div><div class="widget-actions"><button data-action="up">â</button><button data-action="down">â</button><button data-action="minus">â</button><button data-action="plus">+</button><button data-action="delete">Ta bort</button></div></header>`;
    widget.querySelectorAll("[data-action]").forEach((button) => button.addEventListener("click", () => handleWidgetAction(button.dataset.action, feedIndex)));
    items.forEach((item) => { const row = document.createElement("section"); row.className = "article"; row.innerHTML = articleMarkup(item); row.addEventListener("click", () => openReader(item)); widget.appendChild(row); });
    root.appendChild(widget);
  });
}

function renderFlow() {
  const root = $("flowView"); root.innerHTML = "";
  allItems.forEach((item) => {
    const row = document.createElement("article"); row.className = "flow-item";
    row.innerHTML = `<img src="${item.image || ""}" alt="" onerror="this.style.display='none'"><div><p class="eyebrow">${escapeHtml(item.source)} Â· ${formatDate(item.date)}</p><h2>${escapeHtml(item.title)}</h2><p class="muted">${escapeHtml(item.description || "")}</p></div>`;
    row.addEventListener("click", () => openReader(item)); root.appendChild(row);
  });
}

function handleWidgetAction(action, index) {
  if (action === "delete") feeds.splice(index, 1);
  if (action === "plus") feeds[index].limit = Math.min((feeds[index].limit || 6) + 1, 15);
  if (action === "minus") feeds[index].limit = Math.max((feeds[index].limit || 6) - 1, 3);
  if (action === "up" && index > 0) [feeds[index - 1], feeds[index]] = [feeds[index], feeds[index - 1]];
  if (action === "down" && index < feeds.length - 1) [feeds[index + 1], feeds[index]] = [feeds[index], feeds[index + 1]];
  saveFeeds(); render();
}

function openReader(item) { $("readerSource").textContent = item.source; $("readerTitle").textContent = item.title; $("readerMeta").textContent = formatDate(item.date); $("readerBody").innerHTML = item.bodyHtml || `<p>${escapeHtml(item.description || "")}</p>`; $("readerLink").href = item.link; $("readerDialog").showModal(); }
function formatDate(date) { try { return new Intl.DateTimeFormat("sv-SE", { dateStyle: "medium", timeStyle: "short" }).format(date); } catch { return ""; } }
function escapeHtml(str = "") { return str.replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m])); }

$("refreshBtn").addEventListener("click", refresh);
$("editBtn").addEventListener("click", () => { editing = !editing; $("editBtn").textContent = editing ? "Klar" : "Redigera"; render(); });
$("addBtn").addEventListener("click", () => $("addPanel").classList.toggle("hidden"));
$("saveFeedBtn").addEventListener("click", async () => { const title = $("feedTitle").value.trim(); const url = $("feedUrl").value.trim(); if (!title || !url) return; feeds.push({ title, url, limit: 6 }); saveFeeds(); $("feedTitle").value = ""; $("feedUrl").value = ""; $("addPanel").classList.add("hidden"); await refresh(); });
document.querySelectorAll(".segmented button").forEach((button) => button.addEventListener("click", () => { currentView = button.dataset.view; document.querySelectorAll(".segmented button").forEach((b) => b.classList.toggle("active", b === button)); render(); }));
$("closeReader").addEventListener("click", () => $("readerDialog").close());
refresh();
