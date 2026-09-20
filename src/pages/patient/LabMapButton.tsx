import { useState } from "react";
import { createPortal } from "react-dom";
import { MapPin } from "lucide-react";
import HospitalMapModal from "../../components/hospital/HospitalMapModal";
import type { Lab } from "../../api";

export default function LabMapButton({ lab }: { lab: Lab }) {
  const [open, setOpen] = useState(false);
  if (!lab.map_location) return null;

  return (
    <span className="shrink-0" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      <button
        type="button"
        title="View on map"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 bg-teal-50 hover:bg-teal-100 text-teal-600 border border-teal-100 text-xs font-semibold px-2.5 py-1.5 rounded-full shadow-sm transition-all hover:scale-105"
      >
        <MapPin className="w-3.5 h-3.5" /> Map
      </button>
      {open &&
        createPortal(
          <HospitalMapModal
            hospital={{ name: lab.name, area: lab.area, address: lab.map_location ?? undefined }}
            onClose={() => setOpen(false)}
          />,
          document.body,
        )}
    </span>
  );
}
