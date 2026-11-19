// Untrap for Instagram: keep DMs, stories, and posts/reels opened from a link
// (e.g. one sent in a DM). Everything else is hidden or bounces to the inbox.
(() => {
  const INBOX = "/direct/inbox/";
  const HIDDEN = "data-untrap-hidden";

  // Pages you're allowed to be on.
  const ALLOWED = [
    /^\/$/, // home, trimmed down to the stories tray
    /^\/direct(\/|$)/, // DMs
    /^\/stories\//, // story viewer
    /^\/(?:[\w.]+\/)?(?:p|reel)\/[\w-]+/, // a single post or reel
    /^\/accounts\//, // login, settings, logout
    /^\/(?:challenge|two_factor|auth_platform|oauth|session|emails|legal|privacy)(\/|$)/,
  ];

  // Where a path should go instead, or null if it's fine.
  function redirectFor(path) {
    // /reels/<id>/ is the endless reels feed starting at <id>; show just that reel.
    const feed = path.match(/^\/reels\/([\w-]{5,})/);
    if (feed && feed[1] !== "audio") return `/reel/${feed[1]}/`;
    if (path.startsWith("/accounts/activity")) return INBOX; // notifications
    return ALLOWED.some((re) => re.test(path)) ? null : INBOX;
  }

  function pageType(path) {
    if (path === "/") return "home";
    if (path.startsWith("/direct")) return "direct";
    if (path.startsWith("/stories/")) return "stories";
    if (/\/(?:p|reel)\/[\w-]+/.test(path)) return "post";
    return "other";
  }

  // ---- Navigation ---------------------------------------------------------

  let lastHref = "";
  let lastPage = "";

  function enforce() {
    if (location.href === lastHref) return;
    lastHref = location.href;

    const to = redirectFor(location.pathname);
    if (to) {
      location.replace(to);
      return;
    }

    const page = pageType(location.pathname);
    document.documentElement.setAttribute("data-untrap", page);
    if (page !== lastPage) {
      // Instagram reuses layout containers across routes, so start clean.
      for (const el of document.querySelectorAll(`[${HIDDEN}]`)) el.removeAttribute(HIDDEN);
      lastPage = page;
    }
    scheduleTidy();
  }

  // Stop clicks on blocked links before Instagram's router sees them.
  window.addEventListener(
    "click",
    (e) => {
      const a = e.target.closest?.("a[href]");
      if (!a) return;
      const url = new URL(a.getAttribute("href"), location.href);
      if (url.origin !== location.origin) return;
      const to = redirectFor(url.pathname);
      if (!to) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (to === INBOX) toast("Not here. Untrap only allows DMs and stories.");
      else location.assign(to);
    },
    true,
  );

  // Instagram navigates with pushState, which content scripts can't hook from
  // the isolated world, so poll the URL. It's a string compare, so it's cheap.
  setInterval(enforce, 250);
  window.addEventListener("popstate", enforce);

  // ---- Hiding -------------------------------------------------------------

  function hide(el) {
    if (el && !el.hasAttribute(HIDDEN)) el.setAttribute(HIDDEN, "");
  }

  // Hide everything inside `root` except `keep` and its ancestors.
  function isolate(keep, root) {
    if (!keep || !root || !root.contains(keep)) return;
    for (let node = keep; node !== root; node = node.parentElement) {
      node.removeAttribute(HIDDEN);
      for (const sib of node.parentElement.children) if (sib !== node) hide(sib);
    }
  }

  // Left sidebar (or bottom bar on narrow windows): keep only Home and Messages.
  function tidyNav() {
    const dm = [...document.querySelectorAll('a[href^="/direct/inbox"]')].find(
      (a) => !a.closest("main, [role=dialog]"),
    );
    if (!dm) return;
    let item = dm;
    while (item.parentElement && !item.parentElement.querySelector('a[href="/"]')) {
      item = item.parentElement;
    }
    const list = item.parentElement;
    // Climbed too far (no Home link nearby); don't touch the page layout.
    if (!list || list.querySelector("main")) return;
    for (const child of list.children) {
      if (!child.querySelector('a[href="/"], a[href^="/direct/"]')) hide(child);
    }
  }

  // Home: find the stories tray and hide the feed, suggestions, and footer.
  function tidyHome() {
    const main = document.querySelector("main");
    if (!main) return;

    // Story rings are drawn on <canvas>. The tray is the list holding the most
    // of them; posts (<article>) also have rings, so skip those.
    const canvases = [...main.querySelectorAll("canvas")].filter((c) => !c.closest("article"));
    if (!canvases.length) return; // logged out, or nobody has a story up

    let tray = null;
    let best = 0;
    for (const list of main.querySelectorAll("ul, [role=list], [role=menu]")) {
      if (list.querySelector("article")) continue;
      const n = canvases.filter((c) => list.contains(c)).length;
      if (n > best) [tray, best] = [list, n];
    }
    tray ??= commonAncestor(canvases);
    if (!tray) return;

    // Widen to include the tray's scroll arrows, but never the feed.
    while (
      tray.parentElement &&
      tray.parentElement !== main &&
      !tray.parentElement.querySelector('article, a[href^="/explore/"]')
    ) {
      tray = tray.parentElement;
    }
    isolate(tray, main);
  }

  // A post or reel page: keep the post, drop "More posts from ..." below it.
  function tidyPost() {
    const main = document.querySelector("main");
    const code = location.pathname.match(/\/(?:p|reel)\/([\w-]+)/)?.[1];
    if (!main || !code) return;
    // Opened as a popup over the page behind it; the popup has nothing extra.
    if (document.querySelector("[role=dialog] article, [role=dialog] video")) return;

    let post = main.querySelector("article") || main.querySelector("video");
    if (!post) return;
    const linksElsewhere = (el) =>
      [...el.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]')].some(
        (a) => new URL(a.getAttribute("href"), location.href).pathname.match(/\/(?:p|reel)\/([\w-]+)/)?.[1] !== code,
      );
    while (post.parentElement && post.parentElement !== main && !linksElsewhere(post.parentElement)) {
      post = post.parentElement;
    }
    isolate(post, main);
  }

  function commonAncestor(nodes) {
    let anc = nodes[0]?.parentElement;
    while (anc && !nodes.every((n) => anc.contains(n))) anc = anc.parentElement;
    return anc;
  }

  let tidyQueued = false;
  function scheduleTidy() {
    if (tidyQueued) return;
    tidyQueued = true;
    requestAnimationFrame(() => {
      tidyQueued = false;
      tidyNav();
      if (lastPage === "home") tidyHome();
      if (lastPage === "post") tidyPost();
    });
  }

  // ---- Toast --------------------------------------------------------------

  let toastTimer;
  function toast(text) {
    let el = document.getElementById("untrap-toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "untrap-toast";
      document.body.append(el);
    }
    el.textContent = text;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 2200);
  }

  // ---- Start --------------------------------------------------------------

  enforce();
  new MutationObserver(scheduleTidy).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
})();
