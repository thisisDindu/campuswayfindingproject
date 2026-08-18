import { useState } from "react";

// ── CONFIG — change this to your deployed URL ──────────────────
// const BASE_URL = window.location.origin + window.location.pathname.replace(/\/$/, "");
const BASE_URL = "https://campuswayfindingproject.vercel.app";
// ── Building list (must match NAUWayfinding.tsx ids) ───────────
const BUILDINGS = [
  { id: "joint_faculty",  name: "Joint Faculty",            full: "Joint Faculty of Biosciences & Physical Sciences", type: "Academic"    },
  { id: "physics_lab",    name: "Physics Lab",              full: "Physics Laboratory",                               type: "Laboratory"  },
  { id: "biology_lab",    name: "Biology Lab",              full: "Biology Laboratory",                               type: "Laboratory"  },
  { id: "chemistry_lab",  name: "Chemistry Lab",            full: "Chemistry Laboratory",                             type: "Laboratory"  },
  { id: "phys_sci_lh",    name: "Phys. Sci. L/H",          full: "Physical Sciences Lecture Halls / Deans Office",   type: "Academic"    },
  { id: "staff_office",   name: "Staff Offices",            full: "Faculty of Physical Sciences — Staff Offices",     type: "Admin"       },
  { id: "lh3",            name: "Lecture Hall 3",           full: "Lecture Hall 3 — Physical Sciences",               type: "Academic"    },
  { id: "jupeb",          name: "Jupeb Hall",               full: "Jupeb Hall",                                       type: "Academic"    },
  { id: "cs_dept",        name: "Computer Science",         full: "Computer Science Department",                      type: "Academic"    },
  { id: "canteen",        name: "Canteens",                 full: "Campus Canteens",                                  type: "Amenity"     },
  { id: "mictu",          name: "Mictu",                    full: "Mictu — South Campus",                             type: "Landmark"    },
];

const TYPE_ICONS: Record<string, string> = {
  Academic: "🏛", Laboratory: "🔬", Admin: "📋", Amenity: "🍽", Landmark: "🚪",
};

const TYPE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  Academic:    { bg: "#eff6ff", border: "#bfdbfe", text: "#1d4ed8" },
  Laboratory:  { bg: "#f0fdf4", border: "#bbf7d0", text: "#15803d" },
  Admin:       { bg: "#fdf2f8", border: "#fbcfe8", text: "#be185d" },
  Amenity:     { bg: "#fffbeb", border: "#fde68a", text: "#b45309" },
  Landmark:    { bg: "#fffbeb", border: "#fde68a", text: "#b45309" },
};

// ── QR code generator using Google Charts API (no npm needed) ──
function QRCode({ url, size = 160 }: { url: string; size?: number }) {
  const src = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(url)}&margin=4&color=1a1a1a`;
  return (
    <img
      src={src}
      alt="QR Code"
      width={size}
      height={size}
      className="block"
      style={{ imageRendering: "pixelated" }}
    />
  );
}

export default function QRAdmin() {
  const [copied, setCopied] = useState<string | null>(null);

  const copyUrl = (url: string, id: string) => {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(id);
      setTimeout(() => setCopied(null), 1800);
    });
  };

  const handlePrint = () => window.print();

  return (
    <div
      className="min-h-screen bg-gray-50"
      style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
    >
      {/* ── Header ── */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm print:hidden">
        <div>
          <h1 className="text-lg font-bold text-gray-900">QR Code Admin</h1>
          <p className="text-xs text-gray-400">NAU Science Village — Wayfinding Checkpoints</p>
        </div>
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 bg-emerald-700 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-emerald-800 transition-colors"
        >
          🖨 Print All QR Codes
        </button>
      </div>

      {/* ── Info banner ── */}
      <div className="print:hidden mx-6 mt-5 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-[13px] text-blue-800">
        <strong>How to use:</strong> Print this page and cut out each QR card. Post each card at its
        physical building entrance. When a visitor scans it, their phone browser opens the app with
        that building automatically set as their location.
      </div>

      {/* ── Grid ── */}
      <div className="px-6 py-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 print:grid-cols-3 print:gap-3 print:px-2 print:py-2">
        {BUILDINGS.map(bld => {
          const url = `${BASE_URL}?from=${bld.id}`;
          const colors = TYPE_COLORS[bld.type] ?? TYPE_COLORS.Academic;

          return (
            <div
              key={bld.id}
              className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm print:rounded-xl print:shadow-none print:border print:break-inside-avoid"
            >
              {/* Card top — coloured header */}
              <div
                className="px-4 pt-4 pb-3"
                style={{ background: colors.bg, borderBottom: `1px solid ${colors.border}` }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-base">{TYPE_ICONS[bld.type]}</span>
                      <span
                        className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                        style={{ background: colors.border, color: colors.text }}
                      >
                        {bld.type}
                      </span>
                    </div>
                    <h2 className="text-[15px] font-bold text-gray-900 leading-tight">{bld.name}</h2>
                    <p className="text-[10px] text-gray-500 mt-0.5 leading-snug">{bld.full}</p>
                  </div>
                </div>
              </div>

              {/* Card body — QR + YOU ARE HERE label */}
              <div className="px-4 py-4 flex flex-col items-center">
                {/* YOU ARE HERE label */}
                <div
                  className="w-full rounded-xl py-2 mb-3 text-center"
                  style={{ background: "#1a3d2b" }}
                >
                  <p className="text-white text-[11px] font-bold tracking-widest uppercase">You Are Here</p>
                  <p className="text-emerald-300 text-[10px] mt-0.5">Scan for campus map & directions</p>
                </div>

                {/* QR code */}
                <div className="bg-white border-2 border-gray-200 rounded-xl p-2.5">
                  <QRCode url={url} size={150} />
                </div>

                {/* URL + copy button */}
                <div className="mt-3 w-full flex items-center gap-2 print:hidden">
                  <code className="flex-1 text-[9px] text-gray-400 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 truncate">
                    {url}
                  </code>
                  <button
                    onClick={() => copyUrl(url, bld.id)}
                    className="flex-shrink-0 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border transition-colors"
                    style={
                      copied === bld.id
                        ? { background: "#f0fdf4", borderColor: "#bbf7d0", color: "#15803d" }
                        : { background: "white", borderColor: "#e5e7eb", color: "#374151" }
                    }
                  >
                    {copied === bld.id ? "✓ Copied" : "Copy"}
                  </button>
                </div>

                {/* Building ID badge */}
                <p className="mt-2 text-[9px] text-gray-300 font-mono print:text-gray-400">
                  ID: {bld.id}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Print styles ── */}
      <style>{`
        @media print {
          @page { margin: 12mm; size: A4; }
          body { background: white !important; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </div>
  );
}
