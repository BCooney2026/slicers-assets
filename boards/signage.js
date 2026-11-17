/*
  SLICERS SIGNAGE PLAYER (shared by every board)
  ------------------------------------------------------------------
  - Reads the same command center feed the website reads (the
    Slicers Availability /exec URL): sold out toggles, the live
    Limited Time sandwich, and holiday ham orders. Refreshes every
    2 minutes, so a tap on Trish's tablet shows up on the TVs fast.
  - The last good feed is kept on the TV, so a Wi-Fi drop never blanks
    the screen or flips everything to Sold Out.
  - Scales the 1920x1080 stage to any screen, drifts a few pixels every
    10 minutes (burn-in), reloads at 4 am to pick up board changes.
  - Menu items and prices live in each board's BOARDS config (menu.html).
*/
(function () {
  "use strict";

  const FEED_URL = "https://script.google.com/macros/s/AKfycbwsgOScbcTzSBVBZ-KJpOvhswBH6XVFUxLeAlT-TeBwVssJn4obPMryXYF71cBR3tA/exec";
  const STORE_KEY = "slicers_signage_feed_v1";
  const TZ = "America/New_York";
  const CLOSED_DAYS = [1]; // Monday (1 = Monday ... 7 = Sunday)

  const RS = window.RS = { feed: null, TZ: TZ };

  RS.esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  };

  /** "$14.25" -> 14<sup>25</sup> ; "$19.00" -> 19 ; "$7.20/dz" -> 7<sup>20</sup>/dz. Words pass through. */
  RS.money = function (str) {
    return RS.esc(str).replace(/\$?(\d+)\.(\d{2})/g, (m, d, c) => c === "00" ? d : d + "<sup>" + c + "</sup>");
  };

  /** 1 = Monday ... 7 = Sunday, in the shop's time zone. */
  RS.weekday = function () {
    const force = Number(new URLSearchParams(location.search).get("day")); // previews only: ?day=5
    if (force >= 1 && force <= 7) return force;
    const d = new Date().toLocaleDateString("en-US", { timeZone: TZ, weekday: "short" });
    return { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }[d] || 1;
  };
  RS.closedToday = function () { return CLOSED_DAYS.indexOf(RS.weekday()) >= 0; };

  /**
   * Is a Sheet item (Stock tab "Item" name) sold out right now?
   * Unknown names count as in stock. Closed days make no stock claims,
   * same rule as the website.
   */
  RS.soldOut = function (sheetItem) {
    if (!sheetItem || !RS.feed || RS.closedToday()) return false;
    const want = String(sheetItem).toLowerCase();
    const row = (RS.feed.items || []).find(it => it.mode !== "lto" && String(it.item).toLowerCase() === want);
    return row ? row.available === false : false;
  };

  /** The Limited Time sandwich the website is showing (live or "Coming ..."), or null. */
  RS.lto = function () {
    const items = (RS.feed && RS.feed.items) || [];
    return items.find(it => it.mode === "lto" && it.hero) || null;
  };

  /** Holiday ham offer while a holiday is taking orders, or null. */
  RS.hams = function () {
    const h = RS.feed && RS.feed.hams;
    return h && h.open && h.open.length ? h : null;
  };

  /* ---------- stage ---------- */
  function scale() {
    const st = document.querySelector(".stage");
    const s = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    st.style.transform = "translate(-50%, -50%) scale(" + s + ")";
  }
  let drift = 0;
  function nudge() {
    const offs = [[0,0],[3,2],[-3,2],[3,-2],[-3,-2],[0,3]];
    drift = (drift + 1) % offs.length;
    const st = document.querySelector(".stage");
    st.style.marginLeft = offs[drift][0] + "px";
    st.style.marginTop = offs[drift][1] + "px";
  }

  /* ---------- feed ---------- */
  function apply(feed) {
    if (!feed || !feed.ok || !Array.isArray(feed.items)) return false;
    RS.feed = feed;
    return true;
  }

  /**
   * RS.start(render): render() draws the board. It runs once right away
   * (last good feed), and again whenever a fresh feed arrives.
   * For previews, ?demo=lto,hams,soldout fakes a feed (no internet needed).
   */
  RS.start = function (render) {
    scale();
    window.addEventListener("resize", scale);
    const demo = new URLSearchParams(location.search).get("demo");
    if (demo !== null && window.RS_DEMO) {
      apply(window.RS_DEMO(demo.split(",")));
      render();
      return;
    }
    try { apply(JSON.parse(localStorage.getItem(STORE_KEY) || "null")); } catch (e) {}
    render();
    const load = () => fetch(FEED_URL, { cache: "no-store" })
      .then(r => r.json())
      .then(feed => {
        if (!apply(feed)) return;
        try { localStorage.setItem(STORE_KEY, JSON.stringify(feed)); } catch (e) {}
        render();
      })
      .catch(() => { /* keep the last good feed */ });
    load();
    setInterval(load, 2 * 60 * 1000);
    setInterval(nudge, 10 * 60 * 1000);
    setInterval(() => {
      const h = Number(new Date().toLocaleString("en-US", { timeZone: TZ, hour: "numeric", hour12: false }));
      if (h === 4 && performance.now() > 2 * 3600 * 1000) location.reload();
    }, 30 * 60 * 1000);
  };
})();
