// =====================================================================
// atlas-sample-world.jsx — "Conjure a demo world" seeder.
//
// Builds a complete, cohesive fantasy world out of real location
// entities so the Atlas exercises every element at once: drawn regions
// (countries / mountains / forests / marsh / sea), rivers and roads as
// open-stroke paths, the full object-stamp catalogue (castles, towns,
// mines, windmills, dungeons, mountains, forests, lakes, …), road + sea
// connections between settlements, and a drilled-down castle interior
// (floor-plan rooms + interior stamps). Exposed as window.AtlasSampleWorld
// and triggered from the editor's empty-map prompt.
//
// Rows use stable "loc-demo-*" ids so re-conjuring is idempotent (it
// updates the same places rather than duplicating them) and the whole
// world is written in a single EntityService.saveMany() batch.
// =====================================================================
(function () {
  const PREFIX = "loc-demo-";
  const slug = (name) => PREFIX + String(name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const poly = (points) => ({ type: "polygon", points });
  const free = (points) => ({ type: "freehand", points });
  const path = (points) => ({ type: "path", points });
  const circ = (cx, cy, r) => ({ type: "circle", cx, cy, r });
  const rect = (x, y, w, h) => ({ type: "rect", x, y, w, h });
  const kindOf = (sym) => (window.AtlasSymbolLib ? window.AtlasSymbolLib.kind(sym) : "building");

  function buildRows() {
    const rows = [];
    const add = (name, data) => { rows.push({ id: slug(name), name, data: { ...data } }); return rows[rows.length - 1]; };

    // ---- World regions (drawn shapes) -----------------------------
    add("Aldermark", { kind: "country", atlasMap: "world", shape: free([[8,18],[18,13],[30,15],[42,24],[46,40],[42,58],[30,70],[16,68],[7,52],[5,34]]) });
    add("Hessreach", { kind: "country", atlasMap: "world", shape: free([[56,16],[70,13],[84,16],[92,30],[93,50],[86,68],[72,74],[58,66],[54,46],[54,30]]) });
    add("The Sundering Sea", { kind: "waterway", atlasMap: "world", shape: poly([[46,26],[55,28],[54,66],[50,84],[44,82],[45,52]]) });
    add("Frostfell Hills", { kind: "mountain", atlasMap: "world", parentId: slug("Aldermark"), shape: poly([[24,15],[40,16],[44,26],[32,30],[22,26]]) });
    add("Mosswood", { kind: "forest", atlasMap: "world", parentId: slug("Aldermark"), shape: circ(15, 58, 10) });
    add("Dragonspine Mountains", { kind: "mountain", atlasMap: "world", parentId: slug("Hessreach"), shape: poly([[60,15],[88,16],[90,28],[72,30],[60,26]]) });
    add("Black Marsh", { kind: "waterway", atlasMap: "world", parentId: slug("Hessreach"), shape: poly([[64,50],[80,52],[80,62],[66,64],[62,56]]) });
    add("Kingswood", { kind: "forest", atlasMap: "world", parentId: slug("Hessreach"), shape: circ(84, 60, 9) });

    // ---- Rivers + roads (open-stroke paths) -----------------------
    add("Silverflow", { kind: "river", atlasMap: "world", parentId: slug("Aldermark"), shape: path([[34,16],[33,24],[30,32],[29,40],[31,48],[38,52],[45,50]]) });
    add("Emberflow", { kind: "river", atlasMap: "world", parentId: slug("Hessreach"), shape: path([[85,23],[81,30],[77,38],[71,46],[65,53]]) });
    add("King's Road", { kind: "road", atlasMap: "world", parentId: slug("Aldermark"), shape: path([[20,38],[26,30],[31,25],[34,21],[39,26]]) });
    add("Hess Road", { kind: "road", atlasMap: "world", parentId: slug("Hessreach"), shape: path([[78,37],[76,30],[74,25]]) });

    // ---- Object stamps --------------------------------------------
    // [name, symbol, x, y, size, parentRegionName]
    const stamps = [
      ["Aldercrown", "castle", 20, 37, 1.6, "Aldermark"],
      ["Saltmere Bay", "town", 12, 50, 1.2, "Aldermark"],
      ["Kelp Run", "village", 9, 62, 1.1, "Aldermark"],
      ["North Watch", "fort", 34, 19, 1.2, "Aldermark"],
      ["Mage Spire", "tower", 30, 43, 1.1, "Aldermark"],
      ["Gull Point", "lighthouse", 7, 41, 1.1, "Aldermark"],
      ["Irondeep", "mine", 40, 27, 1.0, "Frostfell Hills"],
      ["Greenmill", "windmill", 16, 43, 1.0, "Aldermark"],
      ["Riverwheel", "watermill", 27, 51, 1.0, "Aldermark"],
      ["The Salted Anchor", "tavern", 13, 45, 0.95, "Aldermark"],
      ["Temple of the Tide", "temple", 23, 63, 1.05, "Aldermark"],
      ["Black Hollow", "dungeon", 42, 47, 1.05, "Aldermark"],
      ["The Eldstones", "ruins", 44, 35, 1.0, "Aldermark"],
      ["Finger of Ald", "obelisk", 36, 31, 0.95, "Frostfell Hills"],
      ["Old Well", "well", 17, 39, 0.85, "Aldercrown"],
      ["Market Fountain", "fountain", 23, 41, 0.9, "Aldercrown"],
      ["Crossroads", "signpost", 28, 49, 0.85, "Aldermark"],
      ["Pinebarrow", "pineforest", 37, 57, 1.3, "Aldermark"],
      ["Hangman's Oak", "tree", 32, 59, 1.0, "Aldermark"],
      ["The Tumble", "rocks", 41, 61, 1.0, "Aldermark"],
      ["Barrow Downs", "hill", 31, 25, 1.3, "Frostfell Hills"],
      ["Hesshold", "castle", 78, 36, 1.5, "Hessreach"],
      ["Rivermouth", "town", 89, 51, 1.2, "Hessreach"],
      ["Ash Croft", "village", 71, 67, 1.1, "Hessreach"],
      ["Watchspire", "tower", 65, 33, 1.1, "Hessreach"],
      ["Goldvein", "mine", 74, 24, 1.0, "Dragonspine Mountains"],
      ["Hess Mill", "watermill", 86, 44, 1.0, "Hessreach"],
      ["Highfall", "waterfall", 90, 38, 1.2, "Hessreach"],
      ["Emberpeak", "volcano", 85, 21, 1.5, "Dragonspine Mountains"],
      ["The Teeth", "mountains", 72, 21, 1.4, "Dragonspine Mountains"],
      ["Lonely Peak", "mountain", 62, 25, 1.3, "Hessreach"],
      ["Kingswood Oak", "tree", 80, 62, 1.1, "Kingswood"],
      ["Thornwood", "pineforest", 87, 60, 1.3, "Kingswood"],
      ["Mirror Lake", "lake", 64, 55, 1.5, "Hessreach"],
      ["Frog Pond", "pond", 59, 62, 1.1, "Hessreach"],
      ["The Maw", "whirlpool", 50, 82, 1.4, null],
      ["The Fae Gate", "portal", 57, 44, 1.1, "Hessreach"],
      ["Warhost Camp", "camp", 62, 50, 1.0, "Hessreach"],
      ["Stonespan", "bridge", 55, 53, 1.1, null],
      ["Mirecroak", "swamp", 70, 56, 1.3, "Black Marsh"],
      ["Bog Hollow", "swamp", 76, 59, 1.0, "Black Marsh"],
    ];
    for (const [name, symbol, x, y, size, parent] of stamps) {
      add(name, { placed: true, symbol, symbolSize: size, coords: { x, y }, kind: kindOf(symbol), atlasMap: "world", parentId: parent ? slug(parent) : undefined });
    }

    // ---- Aldercrown interior (drill-down floor-plan) --------------
    const cap = slug("Aldercrown");
    const rooms = [
      ["Great Hall", rect(32, 34, 36, 22)],
      ["Throne Room", rect(42, 14, 20, 16)],
      ["Armoury", rect(16, 38, 14, 18)],
      ["Kitchens", rect(70, 38, 16, 18)],
      ["Solar", rect(66, 16, 16, 14)],
      ["Dungeon Cells", rect(30, 60, 22, 14)],
      ["Barracks", rect(56, 60, 22, 14)],
    ];
    for (const [name, shape] of rooms) add(name, { kind: "room", atlasMap: cap, parentId: cap, shape });
    add("Castle Well", { placed: true, symbol: "well", symbolSize: 0.8, coords: { x: 24, y: 30 }, kind: "building", atlasMap: cap, parentId: cap });
    add("Court Fountain", { placed: true, symbol: "fountain", symbolSize: 0.85, coords: { x: 62, y: 58 }, kind: "building", atlasMap: cap, parentId: cap });

    // ---- Road / sea connections (embedded as data.routes) ---------
    const link = (from, to, kind) => {
      const r = rows.find((x) => x.name === from);
      if (!r) return;
      (r.data.routes = r.data.routes || []).push({ to: slug(to), kind });
    };
    link("Aldercrown", "North Watch", "road");
    link("Aldercrown", "Saltmere Bay", "road");
    link("Saltmere Bay", "Kelp Run", "road");
    link("Hesshold", "Rivermouth", "road");
    link("Hesshold", "Goldvein", "road");
    link("Aldercrown", "Hesshold", "river"); // sea lane (dotted)

    return rows;
  }

  async function seed() {
    const B = window.LoomwrightBackend;
    if (!B || !B.EntityService) return { ok: false, error: "backend unavailable" };
    const rows = buildRows();
    if (B.EntityService.saveMany) {
      await B.EntityService.saveMany("locations", rows, { status: "active", skipAudit: true });
    } else {
      for (const r of rows) await B.EntityService.save("locations", r, { status: "active", skipAudit: true });
    }
    window.dispatchEvent(new CustomEvent("lw:entity-store-updated"));
    return { ok: true, count: rows.length };
  }

  // Remove the demo world (every loc-demo-* place, world + interiors).
  async function clear() {
    const B = window.LoomwrightBackend;
    if (!B || !B.EntityService) return { ok: false, error: "backend unavailable" };
    const ids = B.EntityService.listSync("locations").filter((l) => String(l.id).startsWith(PREFIX)).map((l) => l.id);
    if (ids.length) {
      if (B.EntityService.deleteMany) await B.EntityService.deleteMany("locations", ids, { hard: true });
      else for (const id of ids) await B.EntityService.delete("locations", id, { hard: true });
    }
    window.dispatchEvent(new CustomEvent("lw:entity-store-updated"));
    return { ok: true, count: ids.length };
  }
  // Is the demo world currently present?
  function exists() {
    const B = window.LoomwrightBackend;
    if (!B || !B.EntityService) return false;
    return B.EntityService.listSync("locations").some((l) => String(l.id).startsWith(PREFIX));
  }

  window.AtlasSampleWorld = { seed, clear, exists, slug, PREFIX };
})();
