import { useState, useRef, useEffect, useCallback } from "react";

// ═══════════════════════════════════════════════════════════════
//  COORDINATE SYSTEM  viewBox="0 0 860 780"
//
//  Reading from sketch 1 + sketch 2 together:
//
//  ROADS (sketch 2 graph, positioned on sketch 1 layout):
//    Top road:      I(60,55) ──────────────── H(530,55)
//    West perim:    I(60,55) │ down │ J(60,450)
//    Spine (right): H(530,55)│down│G(530,140)│F(530,230)│E(530,320)│D(530,410)│C(530,480)│B(530,570)
//    Horiz conn.:   J(60,450)── K(220,450) ── L(390,450) ── D(530,450)*
//    NOTE: D is where spine meets horizontal road → D sits at (530,450) NOT 410
//    Mictu branch:  B(530,570) curve → A(700,640)
//
//  BUILDINGS (sketch 1):
//    Joint Faculty: large rect, LEFT of spine, spans x=70..420, y=65..430
//      (two tall inner windows + lower row)
//    Physics Lab:   RIGHT of spine at G level,  x=545..720, y=55..110
//    Biology Lab:   RIGHT of spine at F level,  x=545..720, y=120..175
//    Chemistry Lab: RIGHT of spine at E level,  x=545..720, y=185..255
//    Phys Sci LH:   RIGHT of spine at between E-D, x=545..720, y=265..330
//    Staff Offices: RIGHT of spine at D level,  x=545..720, y=340..395  (wide rect)
//    ── below horizontal road ──
//    Lecture Hall 3: x=70..210,  y=465..520
//    Jupeb Hall:     x=220..340, y=465..520
//    CS Dept:        x=350..470, y=465..520
//    Canteens:       RIGHT of spine at C level, x=545..720, y=460..520
//    ── Mictu area ──
//    Mictu building: x=625..790, y=580..635  (beside node A)
// ═══════════════════════════════════════════════════════════════

// ── NODE POSITIONS ──────────────────────────────────────────────
const NODES = {
  I: { x: 60,  y: 55  },   // top-left perimeter corner
  H: { x: 530, y: 55  },   // top-right / spine start
  G: { x: 530, y: 140 },   // Physics lab junction
  F: { x: 530, y: 230 },   // Biology lab junction
  E: { x: 530, y: 320 },   // Chemistry lab junction
  D: { x: 530, y: 450 },   // Spine/horizontal intersection
  C: { x: 530, y: 500 },   // Canteen junction
  B: { x: 530, y: 570 },   // Mictu branch junction
  A: { x: 700, y: 640 },   // Mictu
  J: { x: 60,  y: 450 },   // bottom-left corner
  K: { x: 220, y: 450 },   // Horizontal road mid
  L: { x: 390, y: 450 },   // Horizontal road near spine
} as const;

type NodeId = keyof typeof NODES;

// ── ROAD EDGES (the ONLY paths the route can travel) ────────────
const EDGES: [NodeId, NodeId, number][] = [
  // Top perimeter road
  ["I", "H", 235],
  // West perimeter (vertical)
  ["I", "J", 198],
  // Spine (vertical, right side)
  ["H", "G", 43],
  ["G", "F", 45],
  ["F", "E", 45],
  ["E", "D", 65],
  ["D", "C", 25],
  ["C", "B", 35],
  // Mictu branch (diagonal)
  ["B", "A", 93],
  // Horizontal connector
  ["J", "K", 80],
  ["K", "L", 85],
  ["L", "D", 70],
];

// Build adjacency map
// function buildGraph(): Record<NodeId, [NodeId, number][]> {
//   const g = {} as Record<NodeId, [NodeId, number][]>;
//   (Object.keys(NODES) as NodeId[]).forEach(id => { g[id] = []; });
//   EDGES.forEach(([a, b, w]) => {
//     g[a].push([b, w]);
//     g[b].push([a, w]);
//   });
//   return g;
// }
function buildGraph(): Record<string, [string, number][]> {
  const g: Record<string, [string, number][]> = {};
  (Object.keys(NODES) as NodeId[]).forEach(id => { g[id] = []; });
  EDGES.forEach(([a, b, w]) => {
    g[a].push([b, w]);
    g[b].push([a, w]);
  });
  return g;
}
const GRAPH = buildGraph();

function dijkstra(from: NodeId, to: NodeId): { path: NodeId[]; dist: number } | null {
  const dist: Record<string, number> = {};
  const prev: Record<string, NodeId | null> = {};
  const visited = new Set<string>();
  (Object.keys(NODES) as NodeId[]).forEach(id => { dist[id] = Infinity; prev[id] = null; });
  dist[from] = 0;
  while (true) {
    let u: NodeId | null = null;
    (Object.keys(dist) as NodeId[]).forEach(id => {
      if (!visited.has(id) && (u === null || dist[id] < dist[u!])) u = id;
    });
    if (!u || dist[u] === Infinity || u === to) break;
    visited.add(u);
    GRAPH[u].forEach(([v, w]) => {
      const nd = dist[u!] + w;
      if (nd < dist[v]) { dist[v] = nd; prev[v] = u; }
    });
  }
  const path: NodeId[] = [];
  let cur: NodeId | null = to;
  while (cur) { path.unshift(cur); cur = prev[cur]; }
  return path[0] === from ? { path, dist: dist[to] } : null;
}

// ── BUILDINGS ───────────────────────────────────────────────────
interface Building {
  id: string;
  name: string;
  full: string;
  type: string;
  node: NodeId;      // which road node this building is accessed from
  x: number; y: number; w: number; h: number;
  fill: string; stroke: string;
}

const BUILDINGS: Building[] = [
  // ── LEFT SIDE: Joint Faculty (large, LEFT of spine) ──
  {
    id: "joint_faculty",
    name: "Joint Faculty",
    full: "Joint Faculty of Biosciences & Physical Sciences",
    type: "Academic",
    node: "I",
    x: 70, y: 65, w: 350, h: 370,
    fill: "#dbeafe", stroke: "#3b82f6",
  },
  // ── RIGHT SIDE: Labs (RIGHT of spine, accessed from spine nodes) ──
  {
    id: "physics_lab",
    name: "Physics Lab",
    full: "Physics Laboratory",
    type: "Laboratory",
    node: "G",
    x: 548, y: 58, w: 175, h: 52,
    fill: "#d1fae5", stroke: "#059669",
  },
  {
    id: "biology_lab",
    name: "Biology Lab",
    full: "Biology Laboratory",
    type: "Laboratory",
    node: "F",
    x: 548, y: 123, w: 175, h: 52,
    fill: "#d1fae5", stroke: "#059669",
  },
  {
    id: "chemistry_lab",
    name: "Chemistry Lab",
    full: "Chemistry Laboratory",
    type: "Laboratory",
    node: "E",
    x: 548, y: 188, w: 175, h: 62,
    fill: "#d1fae5", stroke: "#059669",
  },
  {
    id: "phys_sci_lh",
    name: "Phys. Sci. L/H",
    full: "Physical Sciences Lecture Halls / Deans Office",
    type: "Academic",
    node: "E",
    x: 548, y: 263, w: 175, h: 60,
    fill: "#ede9fe", stroke: "#7c3aed",
  },
  {
    id: "staff_office",
    name: "Staff Offices",
    full: "Faculty of Physical Sciences — Staff Offices",
    type: "Admin",
    node: "D",
    x: 548, y: 336, w: 175, h: 60,
    fill: "#fce7f3", stroke: "#be185d",
  },
  // ── BELOW HORIZONTAL ROAD ──
  {
    id: "lh3",
    name: "Lecture Hall 3",
    full: "Lecture Hall 3 — Physical Sciences",
    type: "Academic",
    node: "J",
    x: 70, y: 463, w: 145, h: 55,
    fill: "#dbeafe", stroke: "#3b82f6",
  },
  {
    id: "jupeb",
    name: "Jupeb Hall",
    full: "Jupeb Hall",
    type: "Academic",
    node: "K",
    x: 222, y: 463, w: 115, h: 55,
    fill: "#dbeafe", stroke: "#3b82f6",
  },
  {
    id: "cs_dept",
    name: "Computer Science",
    full: "Computer Science Department",
    type: "Academic",
    node: "L",
    x: 344, y: 463, w: 130, h: 55,
    fill: "#dbeafe", stroke: "#3b82f6",
  },
  {
    id: "canteen",
    name: "Canteens",
    full: "Campus Canteens",
    type: "Amenity",
    node: "C",
    x: 548, y: 463, w: 175, h: 55,
    fill: "#fef9c3", stroke: "#ca8a04",
  },
  // ── MICTU AREA ──
  {
    id: "mictu",
    name: "Mictu",
    full: "Mictu — South Campus",
    type: "Landmark",
    node: "A",
    x: 625, y: 583, w: 165, h: 52,
    fill: "#fef9c3", stroke: "#ca8a04",
  },
];

// ── HELPERS ─────────────────────────────────────────────────────
function polyline(path: NodeId[]) {
  return path.map(id => `${NODES[id].x},${NODES[id].y}`).join(" ");
}
function fmtDist(m: number) {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}
function walkMins(m: number) { return Math.max(1, Math.round(m / 80)); }
function arrivalTime(mins: number) {
  const d = new Date();
  d.setMinutes(d.getMinutes() + mins);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// ── TYPES ───────────────────────────────────────────────────────
type SheetState = "hidden" | "info" | "directions";
interface ViewBox { x: number; y: number; w: number; h: number }
const INITIAL_VB: ViewBox = { x: 0, y: 0, w: 860, h: 780 };

// ═══════════════════════════════════════════════════════════════
export default function NAUWayfinding() {
  const [origin, setOrigin]           = useState<string | null>(null);
  const [destination, setDestination] = useState<string | null>(null);
  const [selected, setSelected]       = useState<string | null>(null);
  const [route, setRoute]             = useState<{ path: NodeId[]; dist: number } | null>(null);
  const [sheet, setSheet]             = useState<SheetState>("hidden");
  const [dashOffset, setDashOffset]   = useState(0);
  const [vb, setVb]                   = useState<ViewBox>(INITIAL_VB);

  // Search state
  const [searchQuery, setSearchQuery]     = useState("");
  const [searchOpen, setSearchOpen]       = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // Sheet drag state
  const [sheetDragY, setSheetDragY]   = useState(0);
  const sheetDragStart = useRef<{ y: number; state: SheetState } | null>(null);

  const svgRef   = useRef<SVGSVGElement>(null);
  const dragRef  = useRef<{ sx: number; sy: number; vb: ViewBox } | null>(null);
  const touchRef = useRef<Record<number, { x: number; y: number }>>({});
  const animRef  = useRef<number>(0);

  // Search suggestions — filter all buildings by query
  const suggestions = searchQuery.trim().length > 0
    ? BUILDINGS.filter(b =>
        b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.full.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.type.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : BUILDINGS; // show all when box is open but empty

  // Select a building from search → set as destination if origin exists, else set as origin
  const handleSearchSelect = (bld: Building) => {
    setSearchQuery("");
    setSearchOpen(false);
    if (!origin) {
      // No origin set yet — treat this as "I'm here"
      setOrigin(bld.id);
      setSelected(bld.id);
      setSheet("info");
    } else if (bld.id === origin) {
      // Tapped the same building as origin — just show info
      setSelected(bld.id);
      setSheet("info");
    } else {
      // Origin already set — treat search pick as destination
      setSelected(bld.id);
      setDestination(bld.id);
      setSheet("directions");
    }
  };

  // Animate route dashes
  useEffect(() => {
    if (!route) { cancelAnimationFrame(animRef.current); return; }
    const tick = () => {
      setDashOffset(v => v - 1.4);
      animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
  }, [route]);

  // Recompute route
  useEffect(() => {
    if (!origin || !destination || origin === destination) { setRoute(null); return; }
    const fromNode = BUILDINGS.find(b => b.id === origin)?.node;
    const toNode   = BUILDINGS.find(b => b.id === destination)?.node;
    if (!fromNode || !toNode) { setRoute(null); return; }
    setRoute(dijkstra(fromNode, toNode));
  }, [origin, destination]);

  // ── QR scan: read ?from= param on load ──
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromId = params.get("from");
    if (fromId) {
      const bld = BUILDINGS.find(b => b.id === fromId);
      if (bld) {
        setOrigin(bld.id);
        setSelected(bld.id);
        setSheet("info");   // open info sheet so user sees "You are here" + can pick destination
      }
    }
  }, []);

  // ── Building tap ──
  const tapBuilding = useCallback((bld: Building) => {
    setSelected(bld.id);
    setSheet("info");
  }, []);

  const handleSetOrigin = () => {
    setOrigin(selected);
    setDestination(null);
    setRoute(null);
    setSheet("hidden");
  };

  const handleGetDirections = () => {
    if (!origin || !selected) return;
    setDestination(selected);
    setSheet("directions");
  };

  const handleClearRoute = () => {
    setDestination(null);
    setRoute(null);
    setSelected(null);
    setSheet("hidden");
  };

  // ── Pan / zoom ──
  const onMouseDown = (e: React.MouseEvent) => {
    if ((e.target as Element).closest("[data-bld]")) return;
    dragRef.current = { sx: e.clientX, sy: e.clientY, vb: { ...vb } };
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragRef.current || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const sx = vb.w / rect.width, sy = vb.h / rect.height;
    setVb(v => ({
      ...v,
      x: dragRef.current!.vb.x - (e.clientX - dragRef.current!.sx) * sx,
      y: dragRef.current!.vb.y - (e.clientY - dragRef.current!.sy) * sy,
    }));
  };
  const onMouseUp = () => { dragRef.current = null; };

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (!svgRef.current) return;
    const factor = e.deltaY < 0 ? 0.82 : 1.22;
    const rect = svgRef.current.getBoundingClientRect();
    const mx = (e.clientX - rect.left) / rect.width * vb.w + vb.x;
    const my = (e.clientY - rect.top)  / rect.height * vb.h + vb.y;
    setVb(v => {
      const nw = Math.max(280, Math.min(1800, v.w * factor));
      const nh = nw * (780 / 860);
      return { x: mx - (mx - v.x) * nw / v.w, y: my - (my - v.y) * nh / v.h, w: nw, h: nh };
    });
  };

  const onTouchStart = (e: React.TouchEvent) => {
    Array.from(e.touches).forEach(t => { touchRef.current[t.identifier] = { x: t.clientX, y: t.clientY }; });
  };
  const onTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    if (!svgRef.current) return;
    if (e.touches.length === 1) {
      const t = e.touches[0], prev = touchRef.current[t.identifier];
      if (!prev) return;
      const rect = svgRef.current.getBoundingClientRect();
      const sx = vb.w / rect.width, sy = vb.h / rect.height;
      setVb(v => ({ ...v, x: v.x - (t.clientX - prev.x) * sx, y: v.y - (t.clientY - prev.y) * sy }));
      touchRef.current[t.identifier] = { x: t.clientX, y: t.clientY };
    } else if (e.touches.length === 2) {
      const [t1, t2] = Array.from(e.touches);
      const p1 = touchRef.current[t1.identifier], p2 = touchRef.current[t2.identifier];
      if (!p1 || !p2) return;
      const prevD = Math.hypot(p1.x - p2.x, p1.y - p2.y);
      const curD  = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      const factor = prevD / curD;
      const cx = (t1.clientX + t2.clientX) / 2, cy = (t1.clientY + t2.clientY) / 2;
      const rect = svgRef.current.getBoundingClientRect();
      const mx = (cx - rect.left) / rect.width * vb.w + vb.x;
      const my = (cy - rect.top)  / rect.height * vb.h + vb.y;
      setVb(v => {
        const nw = Math.max(280, Math.min(1800, v.w * factor));
        const nh = nw * (780 / 860);
        return { x: mx - (mx - v.x) * nw / v.w, y: my - (my - v.y) * nh / v.h, w: nw, h: nh };
      });
      touchRef.current[t1.identifier] = { x: t1.clientX, y: t1.clientY };
      touchRef.current[t2.identifier] = { x: t2.clientX, y: t2.clientY };
    }
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    Array.from(e.changedTouches).forEach(t => delete touchRef.current[t.identifier]);
  };

  const zoomIn  = () => setVb(v => { const nw = Math.max(280, v.w * 0.75); const nh = nw * 780/860; return { x: v.x + (v.w - nw)/2, y: v.y + (v.h - nh)/2, w: nw, h: nh }; });
  const zoomOut = () => setVb(v => { const nw = Math.min(1800, v.w * 1.33); const nh = nw * 780/860; return { x: v.x + (v.w - nw)/2, y: v.y + (v.h - nh)/2, w: nw, h: nh }; });
  const fitView = () => setVb(INITIAL_VB);

  // ── Sheet drag handlers (on the handle bar only) ──
  const onHandleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    sheetDragStart.current = { y: e.clientY, state: sheet };
    setSheetDragY(0);
  };
  const onHandleMouseMove = useCallback((e: MouseEvent) => {
    if (!sheetDragStart.current) return;
    setSheetDragY(Math.max(0, e.clientY - sheetDragStart.current.y));
  }, []);
  const onHandleMouseUp = useCallback((e: MouseEvent) => {
    if (!sheetDragStart.current) return;
    const delta = e.clientY - sheetDragStart.current.y;
    if (delta > 60) setSheet("hidden");
    sheetDragStart.current = null;
    setSheetDragY(0);
  }, []);
  const onHandleTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation();
    sheetDragStart.current = { y: e.touches[0].clientY, state: sheet };
    setSheetDragY(0);
  };
  const onHandleTouchMove = (e: React.TouchEvent) => {
    if (!sheetDragStart.current) return;
    setSheetDragY(Math.max(0, e.touches[0].clientY - sheetDragStart.current.y));
  };
  const onHandleTouchEnd = (e: React.TouchEvent) => {
    if (!sheetDragStart.current) return;
    const delta = e.changedTouches[0].clientY - sheetDragStart.current.y;
    if (delta > 60) setSheet("hidden");
    sheetDragStart.current = null;
    setSheetDragY(0);
  };

  useEffect(() => {
    window.addEventListener("mousemove", onHandleMouseMove);
    window.addEventListener("mouseup", onHandleMouseUp);
    return () => {
      window.removeEventListener("mousemove", onHandleMouseMove);
      window.removeEventListener("mouseup", onHandleMouseUp);
    };
  }, [onHandleMouseMove, onHandleMouseUp]);

  // ── Derived ──
  const selectedBld = BUILDINGS.find(b => b.id === selected);
  const originBld   = BUILDINGS.find(b => b.id === origin);
  const destBld     = BUILDINGS.find(b => b.id === destination);
  const routeNodes  = new Set(route?.path ?? []);

  // Sheet: fixed pixel heights so map is always visible
  // hidden = only 52px peek (handle + hint text)
  // info   = 220px (building name + 2 buttons)
  // directions = 55% of screen
  const SHEET_H = {
    hidden:     "calc(100% - 52px)",
    info:       "calc(100% - 230px)",
    directions: "45%",
  };
  const sheetTranslate = `translateY(${SHEET_H[sheet]}) translateY(${sheetDragY}px)`;

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#e8ede8]" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* ── TOP BAR ── */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-4 py-2.5 flex items-center gap-3 shadow-sm z-30">
        <div className="flex-shrink-0">
          <p className="text-[13px] font-bold text-gray-900 leading-tight">NAU Science Village</p>
          <p className="text-[10px] text-gray-400 leading-none mt-0.5">Nnamdi Azikiwe University</p>
        </div>

        {/* Search bar + dropdown */}
        <div className="flex-1 relative">
          <div className={`flex items-center gap-2 bg-gray-100 rounded-full px-3 py-2 transition-all ${searchOpen ? "ring-2 ring-emerald-400 bg-white" : ""}`}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.5">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              ref={searchRef}
              type="text"
              value={searchQuery}
              placeholder={origin ? "Search destination…" : "Search building…"}
              className="flex-1 bg-transparent text-[12px] text-gray-800 placeholder-gray-400 outline-none min-w-0"
              onFocus={() => setSearchOpen(true)}
              onChange={e => { setSearchQuery(e.target.value); setSearchOpen(true); }}
              onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
            />
            {searchQuery.length > 0 && (
              <button
                onMouseDown={e => e.preventDefault()}
                onClick={() => { setSearchQuery(""); searchRef.current?.focus(); }}
                className="text-gray-400 hover:text-gray-600 flex-shrink-0 text-sm leading-none"
              >✕</button>
            )}
          </div>

          {/* Suggestions dropdown */}
          {searchOpen && (
            <div className="absolute top-full left-0 right-0 mt-1.5 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50 max-h-64 overflow-y-auto">
              {suggestions.length === 0 ? (
                <p className="px-4 py-3 text-[12px] text-gray-400">No buildings found</p>
              ) : (
                suggestions.map(bld => {
                  const typeColors: Record<string, string> = {
                    Academic: "bg-blue-50 text-blue-600",
                    Laboratory: "bg-emerald-50 text-emerald-600",
                    Admin: "bg-pink-50 text-pink-600",
                    Amenity: "bg-amber-50 text-amber-600",
                    Landmark: "bg-amber-50 text-amber-600",
                  };
                  const isOriginBld = bld.id === origin;
                  return (
                    <button
                      key={bld.id}
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => handleSearchSelect(bld)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 active:bg-gray-100 border-b border-gray-50 last:border-0 text-left"
                    >
                      <div className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0 text-base">
                        {{ Academic: "🏛", Laboratory: "🔬", Admin: "📋", Amenity: "🍽", Landmark: "🚪" }[bld.type] ?? "🏢"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-gray-900 truncate">{bld.name}</p>
                        <p className="text-[10px] text-gray-400 truncate">{bld.full}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${typeColors[bld.type] ?? "bg-gray-100 text-gray-500"}`}>
                          {bld.type}
                        </span>
                        {isOriginBld && (
                          <span className="text-[9px] text-emerald-600 font-semibold">📍 Here</span>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* You are here chip */}
        {originBld && (
          <div className="flex-shrink-0 flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-semibold text-emerald-700 whitespace-nowrap max-w-[70px] truncate">{originBld.name}</span>
          </div>
        )}
      </div>

      {/* ── MAP ── */}
      <div className="flex-1 relative overflow-hidden">
        <svg
          ref={svgRef}
          viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
          className="w-full h-full cursor-grab active:cursor-grabbing touch-none"
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          onWheel={onWheel}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          {/* ── Terrain base ── */}
          <rect x={0} y={0} width={860} height={780} fill="#edf2ed" />

          {/* ── Main compound green area (everything above horizontal road) ── */}
          <rect x={45} y={42} width={510} height={418} rx={4} fill="#daeada" stroke="#b5cfb5" strokeWidth={1.5} />

          {/* ── ROADS — drawn as thick bands BEFORE buildings ── */}

          {/* Top perimeter road: I(60,55) → H(530,55) */}
          <line x1={60} y1={55} x2={530} y2={55} stroke="#c2d4bb" strokeWidth={24} strokeLinecap="round" />
          <line x1={60} y1={55} x2={530} y2={55} stroke="#d8e8d0" strokeWidth={19} strokeLinecap="round" />

          {/* West perimeter road: I(60,55) → J(60,450) */}
          <line x1={60} y1={55} x2={60} y2={450} stroke="#c2d4bb" strokeWidth={24} strokeLinecap="round" />
          <line x1={60} y1={55} x2={60} y2={450} stroke="#d8e8d0" strokeWidth={19} strokeLinecap="round" />

          {/* Right spine: H(530,55) → B(530,570) */}
          <line x1={530} y1={55} x2={530} y2={570} stroke="#c2d4bb" strokeWidth={24} strokeLinecap="round" />
          <line x1={530} y1={55} x2={530} y2={570} stroke="#d8e8d0" strokeWidth={19} strokeLinecap="round" />

          {/* Horizontal connector: J(60,450) → D(530,450) */}
          <line x1={60} y1={450} x2={530} y2={450} stroke="#c2d4bb" strokeWidth={24} strokeLinecap="round" />
          <line x1={60} y1={450} x2={530} y2={450} stroke="#d8e8d0" strokeWidth={19} strokeLinecap="round" />

          {/* Mictu branch: B(530,570) → A(700,640) */}
          <line x1={530} y1={570} x2={700} y2={640} stroke="#c2d4bb" strokeWidth={24} strokeLinecap="round" />
          <line x1={530} y1={570} x2={700} y2={640} stroke="#d8e8d0" strokeWidth={19} strokeLinecap="round" />

          {/* ── ROUTE OVERLAY ── */}
          {route && (
            <>
              {/* Glow */}
              <polyline points={polyline(route.path)} fill="none" stroke="#3b82f6" strokeWidth={12} strokeLinecap="round" strokeLinejoin="round" opacity={0.18} />
              {/* Solid base */}
              <polyline points={polyline(route.path)} fill="none" stroke="#1d4ed8" strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" opacity={0.4} />
              {/* Animated dots */}
              <polyline
                points={polyline(route.path)}
                fill="none"
                stroke="#2563eb"
                strokeWidth={5}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="9 12"
                strokeDashoffset={dashOffset}
                opacity={0.95}
              />
            </>
          )}

          {/* ── BUILDINGS ── */}
          {BUILDINGS.map(bld => {
            const isOrigin  = bld.id === origin;
            const isDest    = bld.id === destination;
            const isSel     = bld.id === selected;
            const highlight = isOrigin || isDest || isSel;
            const strokeColor = isDest ? "#f59e0b" : isOrigin ? "#16a34a" : bld.stroke;
            const strokeW     = highlight ? 2.5 : 1.5;

            return (
              <g key={bld.id} data-bld={bld.id} style={{ cursor: "pointer" }} onClick={() => tapBuilding(bld)}>
                {/* Drop shadow */}
                <rect x={bld.x + 2} y={bld.y + 3} width={bld.w} height={bld.h} rx={5} fill="rgba(0,0,0,0.09)" />

                {/* Building body */}
                <rect x={bld.x} y={bld.y} width={bld.w} height={bld.h} rx={5}
                  fill={bld.fill} stroke={strokeColor} strokeWidth={strokeW} />

                {/* Joint Faculty inner courtyard detail */}
                {bld.id === "joint_faculty" && (
                  <>
                    <rect x={90}  y={85}  width={90} height={110} rx={3} fill="rgba(147,197,253,0.4)" stroke="#93c5fd" strokeWidth={1} />
                    <rect x={230} y={85}  width={90} height={110} rx={3} fill="rgba(147,197,253,0.4)" stroke="#93c5fd" strokeWidth={1} />
                    <rect x={90}  y={215} width={230} height={100} rx={3} fill="rgba(147,197,253,0.4)" stroke="#93c5fd" strokeWidth={1} />
                    <rect x={90}  y={330} width={230} height={90}  rx={3} fill="rgba(147,197,253,0.4)" stroke="#93c5fd" strokeWidth={1} />
                  </>
                )}

                {/* Label */}
                <text
                  x={bld.x + bld.w / 2}
                  y={bld.y + bld.h / 2 + (bld.id === "joint_faculty" ? -10 : 0)}
                  textAnchor="middle" dominantBaseline="middle"
                  fontSize={bld.id === "joint_faculty" ? 13 : 10}
                  fontWeight="600"
                  fill="#1e3a5f"
                  style={{ pointerEvents: "none", userSelect: "none" }}
                >
                  {bld.name}
                </text>
                {bld.id === "joint_faculty" && (
                  <text x={bld.x + bld.w / 2} y={bld.y + bld.h / 2 + 10}
                    textAnchor="middle" dominantBaseline="middle"
                    fontSize={9} fill="#3b82f6" style={{ pointerEvents: "none" }}>
                    Biosciences &amp; Physical Sciences
                  </text>
                )}

                {/* Destination flag */}
                {isDest && (
                  <text x={bld.x + bld.w / 2} y={bld.y - 6} textAnchor="middle" fontSize={18} style={{ pointerEvents: "none" }}>🚩</text>
                )}
              </g>
            );
          })}

          {/* ── ROAD NODE DOTS ── */}
          {(Object.entries(NODES) as [NodeId, { x: number; y: number }][]).map(([id, n]) => {
            const onRoute = routeNodes.has(id) && route;
            return (
              <circle
                key={id}
                cx={n.x} cy={n.y}
                r={onRoute ? 5 : 3}
                fill={onRoute ? "#2563eb" : "#8aab82"}
                stroke="white"
                strokeWidth={onRoute ? 2 : 1.5}
                style={{ pointerEvents: "none" }}
              />
            );
          })}

          {/* ── YOU ARE HERE PIN ── */}
          {originBld && (() => {
            const px = originBld.x + originBld.w / 2;
            const py = originBld.y;
            return (
              <g style={{ pointerEvents: "none" }}>
                <circle cx={px} cy={py} r={14} fill="none" stroke="#ea580c" strokeWidth={2} opacity={0.35}>
                  <animate attributeName="r" from="8" to="20" dur="1.6s" repeatCount="indefinite" />
                  <animate attributeName="opacity" from="0.5" to="0" dur="1.6s" repeatCount="indefinite" />
                </circle>
                <circle cx={px} cy={py} r={9} fill="white" stroke="#ea580c" strokeWidth={2.5} />
                <circle cx={px} cy={py} r={4.5} fill="#ea580c" />
              </g>
            );
          })()}
        </svg>

        {/* ── MAP CONTROLS ── */}
        <div className="absolute top-3 left-3 flex flex-col gap-1 z-10">
          {[
            { label: "+", action: zoomIn },
            { label: "−", action: zoomOut },
            { label: "⊡", action: fitView, small: true },
          ].map(btn => (
            <button
              key={btn.label}
              onClick={btn.action}
              className="w-8 h-8 bg-white border border-gray-200 rounded-md shadow-sm flex items-center justify-center text-gray-600 hover:bg-gray-50 active:bg-gray-100 font-bold text-base leading-none"
            >{btn.label}</button>
          ))}
        </div>

        {/* ── BOTTOM SHEET ── */}
        <div
          className="absolute inset-x-0 bottom-0 bg-white rounded-t-2xl shadow-[0_-6px_32px_rgba(0,0,0,0.13)] z-20"
          style={{
            height: "92%",
            transform: sheetTranslate,
            transition: sheetDragStart.current ? "none" : "transform 0.32s cubic-bezier(0.32,0.72,0,1)",
          }}
        >
          {/* Drag handle — touch/click to dismiss */}
          <div
            className="flex justify-center pt-3 pb-2 cursor-pointer select-none"
            onMouseDown={onHandleMouseDown}
            onTouchStart={onHandleTouchStart}
            onTouchMove={onHandleTouchMove}
            onTouchEnd={onHandleTouchEnd}
            onClick={() => { if (sheet !== "hidden") setSheet("hidden"); }}
          >
            <div className="w-10 h-[5px] bg-gray-300 rounded-full" />
          </div>

          {/* ── INFO STATE ── */}
          {sheet === "info" && selectedBld && (
            <div className="px-4 pt-3 pb-8">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0 pr-2">
                  <p className="text-[15px] font-bold text-gray-900 leading-snug">{selectedBld.full}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">{selectedBld.type}</p>
                </div>
                <button onClick={() => setSheet("hidden")}
                  className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 text-sm flex-shrink-0">✕</button>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleGetDirections}
                  disabled={!origin || selected === origin}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-700 disabled:bg-gray-200 disabled:text-gray-400 text-white text-[13px] font-semibold py-2.5 rounded-xl"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 12h18M13 6l6 6-6 6"/></svg>
                  Directions
                </button>
                <button
                  onClick={handleSetOrigin}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-gray-100 text-gray-800 text-[13px] font-semibold py-2.5 rounded-xl"
                >
                  📍 I'm here
                </button>
              </div>
              {!origin && (
                <p className="text-[11px] text-gray-400 text-center mt-2.5">Tap "I'm here" on any building first.</p>
              )}
            </div>
          )}

          {/* ── DIRECTIONS STATE ── */}
          {sheet === "directions" && route && destBld && originBld && (
            <div className="px-4 pt-3 pb-10 overflow-y-auto max-h-[78vh]">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[14px] font-bold text-gray-900">Directions</p>
                <button onClick={handleClearRoute}
                  className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 text-sm">✕</button>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                {[
                  { label: "Travel time", value: `< ${walkMins(route.dist) + 1}`, unit: "min" },
                  { label: "Distance",   value: fmtDist(route.dist), unit: "" },
                  { label: "Est. arrival", value: arrivalTime(walkMins(route.dist)), unit: "" },
                ].map(s => (
                  <div key={s.label} className="bg-gray-50 rounded-xl py-2.5 px-2 text-center">
                    <p className="text-[9px] text-gray-400 uppercase tracking-wide mb-1">{s.label}</p>
                    <p className="text-[13px] font-bold text-gray-900 leading-tight">{s.value}</p>
                    {s.unit && <p className="text-[9px] text-gray-400">{s.unit}</p>}
                  </div>
                ))}
              </div>

              {/* Step list */}
              <div className="divide-y divide-gray-50">
                {/* Start */}
                <div className="flex items-start gap-3 py-2.5">
                  <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center text-base flex-shrink-0">📍</div>
                  <div>
                    <p className="text-[13px] font-semibold text-gray-900">{originBld.name}</p>
                    <p className="text-[11px] text-gray-400">Start here</p>
                  </div>
                </div>

                {/* Turns — show direction changes at intersections */}
                {route.path.slice(1, -1).reduce<{ nid: NodeId; dir: string }[]>((acc, nid, i) => {
                  const prev = NODES[route.path[i]];
                  const cur  = NODES[nid];
                  const next = NODES[route.path[i + 2]];
                  if (!next) return acc;
                  const d1 = Math.atan2(cur.y - prev.y, cur.x - prev.x);
                  const d2 = Math.atan2(next.y - cur.y, next.x - cur.x);
                  if (Math.abs(d1 - d2) > 0.15) {
                    const dx = next.x - cur.x, dy = next.y - cur.y;
                    const dir = Math.abs(dx) > Math.abs(dy)
                      ? (dx > 0 ? "Turn right →" : "Turn left ←")
                      : (dy > 0 ? "Head south ↓" : "Head north ↑");
                    acc.push({ nid, dir });
                  }
                  return acc;
                }, []).map(({ nid, dir }, i) => (
                  <div key={nid} className="flex items-start gap-3 py-2.5">
                    <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-[11px] font-bold text-gray-500 flex-shrink-0">{i + 1}</div>
                    <div>
                      <p className="text-[13px] font-semibold text-gray-900">{dir}</p>
                      <p className="text-[11px] text-gray-400">Continue on path</p>
                    </div>
                  </div>
                ))}

                {/* End */}
                <div className="flex items-start gap-3 py-2.5">
                  <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center text-base flex-shrink-0">🏁</div>
                  <div>
                    <p className="text-[13px] font-semibold text-gray-900">{destBld.name}</p>
                    <p className="text-[11px] text-gray-400">Your destination</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Always-visible hint when hidden */}
          {sheet === "hidden" && (
            <div className="px-4 py-1 flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
              <span className="text-[12px] text-gray-400">Tap any building to explore</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
