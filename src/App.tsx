import React, { useEffect, useMemo, useState } from "react";
import { jsPDF } from "jspdf";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ClipboardList,
  Download,
  FileText,
  RotateCcw,
  Save,
  Settings2,
  Shield,
  ShipWheel,
  Smartphone,
  Upload,
  Waves,
} from "lucide-react";

type Family = "core" | "wb" | "frb" | "transfer";
type RowMode = "scored" | "emergency";
type ColumnKey =
  | "windGt16"
  | "windGt20"
  | "windGt27"
  | "waveGt1_5"
  | "waveGt2_0"
  | "waveGt3_0"
  | "visibility1_2"
  | "visibilityLt1"
  | "recoveryBeforeDarknessNotAssured"
  | "recoveryWindowNotAssured"
  | "forecastStabilityLt6h"
  | "distanceGt0_3"
  | "distanceGt10"
  | "reducedSpeedTowInterface"
  | "closePassSpreadHazard"
  | "electricalStorm"
  | "floatingDebrisFouling"
  | "escortUnavailable"
  | "frbStandbyUnavailable"
  | "wbUnavailable"
  | "commsDegraded"
  | "commsLost"
  | "boatMechanicalConcern";

type BarrierRequirementKey = "escortUnavailable" | "frbStandbyUnavailable" | "wbUnavailable";

type RowConfig = {
  id: string;
  label: string;
  family: Family;
  mode: RowMode;
  base?: number;
  description?: string;
  rules?: Partial<Record<ColumnKey, number>>;
  hardStops?: ColumnKey[];
  defaultBarrierRequirements?: Partial<Record<BarrierRequirementKey, boolean>>;
};

type BarrierRequirementsState = Record<string, Partial<Record<BarrierRequirementKey, boolean>>>;

type StoredState = {
  selectedRows?: string[];
  barrierRequirements?: BarrierRequirementsState;
  assessmentAt?: string;
  vesselName?: string;
  operationArea?: string;
  assessor?: string;
  bridgeOfficer?: string;
  approvalStatus?: string;
  notes?: string;
  windBand?: "normal" | "gt16" | "gt20" | "gt27";
  waveBand?: "normal" | "gt1_5" | "gt2_0" | "gt3_0";
  visibilityBand?: "normal" | "vis1_2" | "visLt1";
  distanceBand?: "normal" | "gt0_3" | "gt10";
  recoveryBeforeDarknessNotAssured?: boolean;
  recoveryWindowNotAssured?: boolean;
  forecastStabilityLt6h?: boolean;
  reducedSpeedTowInterface?: boolean;
  closePassSpreadHazard?: boolean;
  electricalStorm?: boolean;
  floatingDebrisFouling?: boolean;
  escortUnavailable?: boolean;
  frbStandbyUnavailable?: boolean;
  wbUnavailable?: boolean;
  commsStatus?: "normal" | "degraded" | "lost";
  boatMechanicalConcern?: boolean;
  lastDocumentNo?: string;
};

const COLUMN_LABELS: Record<ColumnKey, string> = {
  windGt16: "Wind >16 kn",
  windGt20: "Wind >20 kn",
  windGt27: "Wind >27 kn",
  waveGt1_5: "Wave >1.5 m",
  waveGt2_0: "Wave >2.0 m",
  waveGt3_0: "Wave >3.0 m",
  visibility1_2: "Visibility 1–2 NM",
  visibilityLt1: "Visibility <1 NM",
  recoveryBeforeDarknessNotAssured: "Recovery before darkness not assured",
  recoveryWindowNotAssured: "Recovery weather window not assured",
  forecastStabilityLt6h: "Forecast stability <6 h",
  distanceGt0_3: "Distance >0.3 NM",
  distanceGt10: "Distance >10 NM",
  reducedSpeedTowInterface: "Reduced-speed tow interface",
  closePassSpreadHazard: "Close pass / spread hazard proximity",
  electricalStorm: "Electrical storm",
  floatingDebrisFouling: "Floating debris / fouling risk",
  escortUnavailable: "Escort / support unavailable",
  frbStandbyUnavailable: "FRB standby unavailable",
  wbUnavailable: "WB unavailable",
  commsDegraded: "Critical operational communication degraded",
  commsLost: "Critical operational communication lost",
  boatMechanicalConcern: "Boat mechanical readiness concern",
};

const FAMILY_LABELS: Record<Family, string> = {
  core: "Core Vessel / Seismic",
  wb: "WB Annex",
  frb: "FRB Annex",
  transfer: "Transfer Interface",
};

function makeCoreRow(id: string, label: string, base: number, rules: Partial<Record<ColumnKey, number>>, hardStops: ColumnKey[] = [], defaults: Partial<Record<BarrierRequirementKey, boolean>> = {}) {
  return { id, label, family: "core" as Family, mode: "scored" as RowMode, base, rules, hardStops, defaultBarrierRequirements: defaults };
}

function makeWBRow(id: string, label: string, base: number, rules: Partial<Record<ColumnKey, number>>, hardStops: ColumnKey[] = [], defaults: Partial<Record<BarrierRequirementKey, boolean>> = {}) {
  return { id, label, family: "wb" as Family, mode: "scored" as RowMode, base, rules, hardStops, defaultBarrierRequirements: defaults };
}

function makeFRBRow(id: string, label: string, base: number, rules: Partial<Record<ColumnKey, number>>, hardStops: ColumnKey[] = [], defaults: Partial<Record<BarrierRequirementKey, boolean>> = {}) {
  return { id, label, family: "frb" as Family, mode: "scored" as RowMode, base, rules, hardStops, defaultBarrierRequirements: defaults };
}

function makeTransferRow(id: string, label: string, base: number, rules: Partial<Record<ColumnKey, number>>, hardStops: ColumnKey[] = [], defaults: Partial<Record<BarrierRequirementKey, boolean>> = {}) {
  return { id, label, family: "transfer" as Family, mode: "scored" as RowMode, base, rules, hardStops, defaultBarrierRequirements: defaults };
}

const ROWS: RowConfig[] = [
  makeCoreRow("transit_normal_seismic", "In Transit / Normal Seismic Operations", 0, {
    electricalStorm: 1,
    commsDegraded: 1,
    commsLost: 4,
  }),
  makeCoreRow("special_seismic_ops", "Special Seismic Operations", 1, {
    electricalStorm: 4,
    commsDegraded: 3,
    commsLost: 9,
    wbUnavailable: 1,
    frbStandbyUnavailable: 1,
  }),
  makeCoreRow("streamer_deploy_recovery", "Streamer Deployment / Recovery", 1, {
    electricalStorm: 9,
    commsDegraded: 3,
    commsLost: 9,
    wbUnavailable: 1,
    frbStandbyUnavailable: 1,
  }),
  makeCoreRow("gun_array_deploy_recovery", "Gun Array Deployment / Recovery", 1, {
    electricalStorm: 9,
    commsDegraded: 3,
    commsLost: 9,
    wbUnavailable: 1,
    frbStandbyUnavailable: 1,
  }),
  makeCoreRow("monowing_barovane_recovery", "Monowing / Barovane / Deflector Deployment / Recovery", 1, {
    electricalStorm: 9,
    commsDegraded: 3,
    commsLost: 9,
    wbUnavailable: 1,
    frbStandbyUnavailable: 1,
  }),
  makeCoreRow("non_routine_recovery_gt2_5", "Non-Routine Equipment Recovery >2.5 kn", 3, {
    electricalStorm: 9,
    commsDegraded: 3,
    commsLost: 9,
    wbUnavailable: 3,
    frbStandbyUnavailable: 2,
  }),
  makeCoreRow("non_routine_recovery_lt2_5", "Non-Routine Equipment Recovery <2.5 kn", 2, {
    electricalStorm: 9,
    commsDegraded: 3,
    commsLost: 9,
    wbUnavailable: 3,
    frbStandbyUnavailable: 2,
  }),
  makeCoreRow("support_vessel_approach", "Support / Supply Vessel Approach", 1, {
    electricalStorm: 4,
    commsDegraded: 3,
    escortUnavailable: 3,
  }, ["commsLost"]),
  makeCoreRow("support_vessel_departure", "Support / Supply Vessel Departure", 1, {
    electricalStorm: 4,
    commsDegraded: 3,
    escortUnavailable: 3,
  }, ["commsLost"]),
  makeCoreRow("resupply_bunkering_crane_interface", "Resupply at Sea / Bunkering / Crane Interface", 2, {
    electricalStorm: 9,
    commsDegraded: 3,
    wbUnavailable: 1,
    frbStandbyUnavailable: 1,
  }, ["commsLost"]),
  makeCoreRow("crane_operations", "Crane Operations", 1, {
    electricalStorm: 9,
    commsDegraded: 2,
    wbUnavailable: 1,
    frbStandbyUnavailable: 1,
  }, ["commsLost"]),
  makeCoreRow("helicopter_operations", "Helicopter Operations", 2, {
    electricalStorm: 8,
    commsDegraded: 3,
    escortUnavailable: 1,
    frbStandbyUnavailable: 1,
  }, ["commsLost"], { escortUnavailable: true, frbStandbyUnavailable: true }),
  makeCoreRow("emergency_drills", "Emergency Drills", 1, {
    electricalStorm: 5,
    commsDegraded: 2,
    commsLost: 4,
  }),
  makeCoreRow("offshore_gangway_transfers", "Offshore Gangway Transfers", 1, {
    electricalStorm: 9,
    commsDegraded: 4,
    wbUnavailable: 3,
    escortUnavailable: 3,
  }, ["commsLost"]),

  makeWBRow("wb_launch", "WB Launch", 2, {
    windGt16: 1,
    windGt20: 2,
    windGt27: 9,
    waveGt1_5: 1,
    waveGt2_0: 2,
    waveGt3_0: 9,
    visibility1_2: 2,
    visibilityLt1: 9,
    recoveryBeforeDarknessNotAssured: 3,
    recoveryWindowNotAssured: 2,
    distanceGt0_3: 1,
    distanceGt10: 2,
    reducedSpeedTowInterface: 2,
    closePassSpreadHazard: 2,
    electricalStorm: 9,
    floatingDebrisFouling: 1,
    commsDegraded: 3,
    boatMechanicalConcern: 9,
  }, ["commsLost", "windGt27", "waveGt3_0", "visibilityLt1", "electricalStorm", "boatMechanicalConcern", "escortUnavailable", "frbStandbyUnavailable"], { escortUnavailable: true, frbStandbyUnavailable: true, wbUnavailable: true }),
  makeWBRow("wb_recovery", "WB Recovery", 3, {
    windGt16: 1,
    windGt20: 3,
    windGt27: 9,
    waveGt1_5: 1,
    waveGt2_0: 3,
    waveGt3_0: 9,
    visibility1_2: 3,
    visibilityLt1: 9,
    recoveryBeforeDarknessNotAssured: 4,
    recoveryWindowNotAssured: 3,
    distanceGt0_3: 1,
    distanceGt10: 2,
    reducedSpeedTowInterface: 2,
    closePassSpreadHazard: 3,
    electricalStorm: 9,
    floatingDebrisFouling: 1,
    commsDegraded: 4,
    boatMechanicalConcern: 9,
  }, ["commsLost", "windGt27", "waveGt3_0", "visibilityLt1", "electricalStorm", "boatMechanicalConcern", "escortUnavailable", "frbStandbyUnavailable"], { escortUnavailable: true, frbStandbyUnavailable: true, wbUnavailable: true }),
  makeWBRow("wb_visual_inspection", "WB In-Sea Visual Inspection", 2, {
    windGt16: 1,
    windGt20: 2,
    windGt27: 9,
    waveGt1_5: 1,
    waveGt2_0: 2,
    waveGt3_0: 9,
    visibility1_2: 2,
    visibilityLt1: 9,
    recoveryBeforeDarknessNotAssured: 3,
    recoveryWindowNotAssured: 2,
    distanceGt0_3: 1,
    distanceGt10: 2,
    reducedSpeedTowInterface: 2,
    closePassSpreadHazard: 2,
    electricalStorm: 9,
    floatingDebrisFouling: 1,
    escortUnavailable: 4,
    frbStandbyUnavailable: 4,
    commsDegraded: 3,
    boatMechanicalConcern: 9,
  }, ["commsLost", "windGt27", "waveGt3_0", "visibilityLt1", "electricalStorm", "boatMechanicalConcern"]),
  makeWBRow("wb_cleaning", "WB Cleaning Task", 3, {
    windGt16: 1,
    windGt20: 3,
    windGt27: 9,
    waveGt1_5: 1,
    waveGt2_0: 3,
    waveGt3_0: 9,
    visibility1_2: 2,
    visibilityLt1: 9,
    recoveryBeforeDarknessNotAssured: 3,
    recoveryWindowNotAssured: 2,
    distanceGt0_3: 1,
    distanceGt10: 2,
    reducedSpeedTowInterface: 2,
    closePassSpreadHazard: 3,
    electricalStorm: 9,
    floatingDebrisFouling: 2,
    commsDegraded: 4,
    boatMechanicalConcern: 9,
  }, ["commsLost", "windGt27", "waveGt3_0", "visibilityLt1", "electricalStorm", "boatMechanicalConcern", "escortUnavailable", "frbStandbyUnavailable"], { escortUnavailable: true, frbStandbyUnavailable: true, wbUnavailable: true }),
  makeWBRow("wb_equipment_change", "WB Equipment Change / Light Component Replacement", 3, {
    windGt16: 1,
    windGt20: 3,
    windGt27: 9,
    waveGt1_5: 1,
    waveGt2_0: 3,
    waveGt3_0: 9,
    visibility1_2: 2,
    visibilityLt1: 9,
    recoveryBeforeDarknessNotAssured: 3,
    recoveryWindowNotAssured: 2,
    distanceGt0_3: 1,
    distanceGt10: 2,
    reducedSpeedTowInterface: 2,
    closePassSpreadHazard: 3,
    electricalStorm: 9,
    floatingDebrisFouling: 1,
    commsDegraded: 4,
    boatMechanicalConcern: 9,
  }, ["commsLost", "windGt27", "waveGt3_0", "visibilityLt1", "electricalStorm", "boatMechanicalConcern", "escortUnavailable", "frbStandbyUnavailable"], { escortUnavailable: true, frbStandbyUnavailable: true, wbUnavailable: true }),
  makeWBRow("wb_personnel_transfer", "WB Personnel Transfer", 3, {
    windGt16: 1,
    windGt20: 3,
    windGt27: 9,
    waveGt1_5: 1,
    waveGt2_0: 3,
    waveGt3_0: 9,
    visibility1_2: 3,
    visibilityLt1: 9,
    recoveryBeforeDarknessNotAssured: 4,
    recoveryWindowNotAssured: 3,
    distanceGt0_3: 1,
    distanceGt10: 3,
    reducedSpeedTowInterface: 2,
    closePassSpreadHazard: 3,
    electricalStorm: 9,
    floatingDebrisFouling: 1,
    commsDegraded: 4,
    boatMechanicalConcern: 9,
  }, ["commsLost", "windGt27", "waveGt3_0", "visibilityLt1", "recoveryBeforeDarknessNotAssured", "electricalStorm", "boatMechanicalConcern", "escortUnavailable", "frbStandbyUnavailable"], { escortUnavailable: true, frbStandbyUnavailable: true, wbUnavailable: true }),
  makeWBRow("wb_stores_transfer", "WB Small Equipment / Stores Transfer", 2, {
    windGt16: 1,
    windGt20: 2,
    windGt27: 9,
    waveGt1_5: 1,
    waveGt2_0: 2,
    waveGt3_0: 9,
    visibility1_2: 2,
    visibilityLt1: 9,
    recoveryBeforeDarknessNotAssured: 3,
    recoveryWindowNotAssured: 2,
    distanceGt0_3: 1,
    distanceGt10: 2,
    reducedSpeedTowInterface: 2,
    closePassSpreadHazard: 2,
    electricalStorm: 9,
    floatingDebrisFouling: 1,
    escortUnavailable: 3,
    frbStandbyUnavailable: 3,
    commsDegraded: 3,
    boatMechanicalConcern: 9,
  }, ["commsLost", "windGt27", "waveGt3_0", "visibilityLt1", "electricalStorm", "boatMechanicalConcern"]),
  makeWBRow("wb_emergency_assist", "WB Emergency Assist / Debris / Fishing Gear Recovery", 3, {
    windGt16: 1,
    windGt20: 3,
    windGt27: 9,
    waveGt1_5: 1,
    waveGt2_0: 3,
    waveGt3_0: 9,
    visibility1_2: 2,
    visibilityLt1: 9,
    recoveryBeforeDarknessNotAssured: 3,
    recoveryWindowNotAssured: 2,
    distanceGt0_3: 1,
    distanceGt10: 2,
    reducedSpeedTowInterface: 2,
    closePassSpreadHazard: 3,
    electricalStorm: 9,
    floatingDebrisFouling: 3,
    commsDegraded: 4,
    boatMechanicalConcern: 9,
  }, ["commsLost", "windGt27", "waveGt3_0", "visibilityLt1", "electricalStorm", "boatMechanicalConcern", "escortUnavailable", "frbStandbyUnavailable"], { escortUnavailable: true, frbStandbyUnavailable: true, wbUnavailable: true }),

  {
    id: "frb_sar_mob_emergency_mode",
    label: "FRB SAR / MOB Emergency Mode",
    family: "frb",
    mode: "emergency",
    description: "Emergency command mode only. This row does not contribute to total MOPO score.",
  },
  makeFRBRow("frb_exceptional_seismic_support", "FRB Exceptional Seismic Support Task", 3, {
    windGt16: 2,
    windGt20: 4,
    windGt27: 9,
    visibility1_2: 2,
    visibilityLt1: 9,
    forecastStabilityLt6h: 3,
    distanceGt0_3: 1,
    distanceGt10: 2,
    reducedSpeedTowInterface: 2,
    closePassSpreadHazard: 3,
    electricalStorm: 9,
    floatingDebrisFouling: 2,
    commsDegraded: 4,
    boatMechanicalConcern: 9,
  }, ["waveGt1_5", "visibilityLt1", "recoveryBeforeDarknessNotAssured", "escortUnavailable", "commsLost", "electricalStorm", "boatMechanicalConcern"], { escortUnavailable: true }),
  makeFRBRow("frb_exceptional_personnel_transfer", "FRB Exceptional Personnel Transfer", 3, {
    windGt16: 2,
    windGt20: 4,
    windGt27: 9,
    visibility1_2: 3,
    visibilityLt1: 9,
    forecastStabilityLt6h: 3,
    distanceGt0_3: 1,
    distanceGt10: 2,
    reducedSpeedTowInterface: 2,
    closePassSpreadHazard: 3,
    electricalStorm: 9,
    floatingDebrisFouling: 1,
    commsDegraded: 4,
    boatMechanicalConcern: 9,
  }, ["waveGt1_5", "visibilityLt1", "recoveryBeforeDarknessNotAssured", "escortUnavailable", "commsLost", "electricalStorm", "boatMechanicalConcern"], { escortUnavailable: true }),

  makeTransferRow("crew_change_water_taxi", "Crew Change / Water Taxi Transfer", 2, {
    windGt16: 1,
    windGt20: 2,
    windGt27: 9,
    waveGt1_5: 1,
    waveGt2_0: 3,
    waveGt3_0: 9,
    visibility1_2: 2,
    visibilityLt1: 9,
    recoveryBeforeDarknessNotAssured: 3,
    recoveryWindowNotAssured: 2,
    distanceGt0_3: 1,
    distanceGt10: 2,
    reducedSpeedTowInterface: 2,
    closePassSpreadHazard: 2,
    electricalStorm: 9,
    escortUnavailable: 4,
    frbStandbyUnavailable: 3,
    commsDegraded: 4,
    boatMechanicalConcern: 9,
  }, ["commsLost", "windGt27", "waveGt3_0", "visibilityLt1", "electricalStorm", "boatMechanicalConcern"]),
  makeTransferRow("boat_to_boat_personnel_transfer", "Boat-to-Boat Personnel Transfer", 3, {
    windGt16: 1,
    windGt20: 3,
    windGt27: 9,
    waveGt1_5: 1,
    waveGt2_0: 3,
    waveGt3_0: 9,
    visibility1_2: 3,
    visibilityLt1: 9,
    recoveryBeforeDarknessNotAssured: 4,
    recoveryWindowNotAssured: 2,
    distanceGt0_3: 1,
    distanceGt10: 2,
    reducedSpeedTowInterface: 2,
    closePassSpreadHazard: 3,
    electricalStorm: 9,
    escortUnavailable: 4,
    frbStandbyUnavailable: 3,
    commsDegraded: 4,
    boatMechanicalConcern: 9,
  }, ["commsLost", "windGt27", "waveGt3_0", "visibilityLt1", "recoveryBeforeDarknessNotAssured", "electricalStorm", "boatMechanicalConcern"]),
  makeTransferRow("boat_to_vessel_small_equipment", "Boat-to-Vessel Small Equipment Transfer", 2, {
    windGt16: 1,
    windGt20: 2,
    windGt27: 9,
    waveGt1_5: 1,
    waveGt2_0: 2,
    waveGt3_0: 9,
    visibility1_2: 2,
    visibilityLt1: 9,
    recoveryBeforeDarknessNotAssured: 3,
    recoveryWindowNotAssured: 2,
    distanceGt0_3: 1,
    distanceGt10: 2,
    reducedSpeedTowInterface: 2,
    closePassSpreadHazard: 2,
    electricalStorm: 9,
    escortUnavailable: 3,
    frbStandbyUnavailable: 3,
    commsDegraded: 3,
    boatMechanicalConcern: 9,
  }, ["commsLost", "windGt27", "waveGt3_0", "visibilityLt1", "electricalStorm", "boatMechanicalConcern"]),
];

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function toNonNegativeNumber(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return parsed;
}

function formatDateTimeLocal(date: Date = new Date()): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function addHours(datetimeLocalString: string, hours: number): string {
  if (!datetimeLocalString) return "";
  const date = new Date(datetimeLocalString);
  if (Number.isNaN(date.getTime())) return "";
  date.setHours(date.getHours() + hours);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function getAction(total: number, noGo: boolean) {
  if (noGo) {
    return {
      title: "No-Go / Escalation Required",
      detail: "At least one hard stop or +9 trigger is active. The selected activity package shall not proceed without formal re-evaluation or emergency command authority.",
      badge: "bg-red-50 text-red-700 border-red-200",
      ring: "ring-red-200",
      icon: "red" as const,
    };
  }
  if (total <= 4) {
    return {
      title: "No additional action required",
      detail: "Operation may proceed within normal controls.",
      badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
      ring: "ring-emerald-200",
      icon: "green" as const,
    };
  }
  if (total <= 6) {
    return {
      title: "Conduct Risk Assessment",
      detail: "Additional risk assessment shall be carried out and controls implemented to ensure ALARP.",
      badge: "bg-amber-50 text-amber-700 border-amber-200",
      ring: "ring-amber-200",
      icon: "amber" as const,
    };
  }
  if (total <= 8) {
    return {
      title: "Review full Risk Assessment",
      detail: "Review the full risk assessment before proceeding.",
      badge: "bg-orange-50 text-orange-700 border-orange-200",
      ring: "ring-orange-200",
      icon: "orange" as const,
    };
  }
  return {
    title: "Submit MOC",
    detail: "Extended toolbox shall always take place prior to the activity.",
    badge: "bg-rose-50 text-rose-700 border-rose-200",
    ring: "ring-rose-200",
    icon: "red" as const,
  };
}

function RiskIcon({ level }: { level: "green" | "amber" | "orange" | "red" }) {
  if (level === "green") return <CheckCircle2 className="h-5 w-5" />;
  return <AlertTriangle className="h-5 w-5" />;
}

function SectionTitle({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle?: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="rounded-2xl bg-slate-100 p-2 text-slate-700">{icon}</div>
      <div>
        <h2 className="text-lg font-semibold text-slate-900 md:text-xl">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
      </div>
    </div>
  );
}

function buildDefaultBarrierRequirements(): BarrierRequirementsState {
  const result: BarrierRequirementsState = {};
  for (const row of ROWS) {
    result[row.id] = {
      escortUnavailable: Boolean(row.defaultBarrierRequirements?.escortUnavailable),
      frbStandbyUnavailable: Boolean(row.defaultBarrierRequirements?.frbStandbyUnavailable),
      wbUnavailable: Boolean(row.defaultBarrierRequirements?.wbUnavailable),
    };
  }
  return result;
}

function getActiveColumns(state: {
  windBand: "normal" | "gt16" | "gt20" | "gt27";
  waveBand: "normal" | "gt1_5" | "gt2_0" | "gt3_0";
  visibilityBand: "normal" | "vis1_2" | "visLt1";
  distanceBand: "normal" | "gt0_3" | "gt10";
  recoveryBeforeDarknessNotAssured: boolean;
  recoveryWindowNotAssured: boolean;
  forecastStabilityLt6h: boolean;
  reducedSpeedTowInterface: boolean;
  closePassSpreadHazard: boolean;
  electricalStorm: boolean;
  floatingDebrisFouling: boolean;
  escortUnavailable: boolean;
  frbStandbyUnavailable: boolean;
  wbUnavailable: boolean;
  commsStatus: "normal" | "degraded" | "lost";
  boatMechanicalConcern: boolean;
}): ColumnKey[] {
  const keys: ColumnKey[] = [];
  if (state.windBand === "gt16") keys.push("windGt16");
  if (state.windBand === "gt20") keys.push("windGt20");
  if (state.windBand === "gt27") keys.push("windGt27");
  if (state.waveBand === "gt1_5") keys.push("waveGt1_5");
  if (state.waveBand === "gt2_0") keys.push("waveGt2_0");
  if (state.waveBand === "gt3_0") keys.push("waveGt3_0");
  if (state.visibilityBand === "vis1_2") keys.push("visibility1_2");
  if (state.visibilityBand === "visLt1") keys.push("visibilityLt1");
  if (state.distanceBand === "gt0_3") keys.push("distanceGt0_3");
  if (state.distanceBand === "gt10") keys.push("distanceGt10");
  if (state.recoveryBeforeDarknessNotAssured) keys.push("recoveryBeforeDarknessNotAssured");
  if (state.recoveryWindowNotAssured) keys.push("recoveryWindowNotAssured");
  if (state.forecastStabilityLt6h) keys.push("forecastStabilityLt6h");
  if (state.reducedSpeedTowInterface) keys.push("reducedSpeedTowInterface");
  if (state.closePassSpreadHazard) keys.push("closePassSpreadHazard");
  if (state.electricalStorm) keys.push("electricalStorm");
  if (state.floatingDebrisFouling) keys.push("floatingDebrisFouling");
  if (state.escortUnavailable) keys.push("escortUnavailable");
  if (state.frbStandbyUnavailable) keys.push("frbStandbyUnavailable");
  if (state.wbUnavailable) keys.push("wbUnavailable");
  if (state.commsStatus === "degraded") keys.push("commsDegraded");
  if (state.commsStatus === "lost") keys.push("commsLost");
  if (state.boatMechanicalConcern) keys.push("boatMechanicalConcern");
  return keys;
}

function getPreviewDocumentNo(assessmentAt: string): string {
  const year = new Date(assessmentAt || Date.now()).getFullYear();
  const currentCounter = toNonNegativeNumber(window.localStorage.getItem(`mopo-doc-counter-${year}`));
  return `OR-MOPO-${year}-${String(currentCounter + 1).padStart(3, "0")}`;
}

function shouldApplyBarrier(rowId: string, key: BarrierRequirementKey, requirements: BarrierRequirementsState): boolean {
  return Boolean(requirements[rowId]?.[key]);
}

function getBarrierToggleLabel(key: BarrierRequirementKey): string {
  if (key === "escortUnavailable") return "Escort required";
  if (key === "frbStandbyUnavailable") return "FRB standby required";
  return "WB required";
}

export default function OrucReisMopoV5App() {
  const [selectedRows, setSelectedRows] = useState<string[]>(["streamer_deploy_recovery"]);
  const [barrierRequirements, setBarrierRequirements] = useState<BarrierRequirementsState>(buildDefaultBarrierRequirements());
  const [assessmentAt, setAssessmentAt] = useState<string>(formatDateTimeLocal());
  const [vesselName, setVesselName] = useState<string>("RV Oruç Reis");
  const [operationArea, setOperationArea] = useState<string>("Offshore Seismic Operations");
  const [assessor, setAssessor] = useState<string>("");
  const [bridgeOfficer, setBridgeOfficer] = useState<string>("");
  const [approvalStatus, setApprovalStatus] = useState<string>("Draft Assessment");
  const [notes, setNotes] = useState<string>("");

  const [windBand, setWindBand] = useState<"normal" | "gt16" | "gt20" | "gt27">("normal");
  const [waveBand, setWaveBand] = useState<"normal" | "gt1_5" | "gt2_0" | "gt3_0">("normal");
  const [visibilityBand, setVisibilityBand] = useState<"normal" | "vis1_2" | "visLt1">("normal");
  const [distanceBand, setDistanceBand] = useState<"normal" | "gt0_3" | "gt10">("normal");
  const [recoveryBeforeDarknessNotAssured, setRecoveryBeforeDarknessNotAssured] = useState<boolean>(false);
  const [recoveryWindowNotAssured, setRecoveryWindowNotAssured] = useState<boolean>(false);
  const [forecastStabilityLt6h, setForecastStabilityLt6h] = useState<boolean>(false);
  const [reducedSpeedTowInterface, setReducedSpeedTowInterface] = useState<boolean>(false);
  const [closePassSpreadHazard, setClosePassSpreadHazard] = useState<boolean>(false);
  const [electricalStorm, setElectricalStorm] = useState<boolean>(false);
  const [floatingDebrisFouling, setFloatingDebrisFouling] = useState<boolean>(false);
  const [escortUnavailable, setEscortUnavailable] = useState<boolean>(false);
  const [frbStandbyUnavailable, setFrbStandbyUnavailable] = useState<boolean>(false);
  const [wbUnavailable, setWbUnavailable] = useState<boolean>(false);
  const [commsStatus, setCommsStatus] = useState<"normal" | "degraded" | "lost">("normal");
  const [boatMechanicalConcern, setBoatMechanicalConcern] = useState<boolean>(false);
  const [saveMessage, setSaveMessage] = useState<string>("");
  const [lastDocumentNo, setLastDocumentNo] = useState<string>("");

  useEffect(() => {
    const raw = window.localStorage.getItem("mopo-site-v5");
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as StoredState;
      setSelectedRows(Array.isArray(parsed.selectedRows) && parsed.selectedRows.length ? parsed.selectedRows : ["streamer_deploy_recovery"]);
      setBarrierRequirements(parsed.barrierRequirements ?? buildDefaultBarrierRequirements());
      setAssessmentAt(parsed.assessmentAt || formatDateTimeLocal());
      setVesselName(parsed.vesselName || "RV Oruç Reis");
      setOperationArea(parsed.operationArea || "Offshore Seismic Operations");
      setAssessor(parsed.assessor || "");
      setBridgeOfficer(parsed.bridgeOfficer || "");
      setApprovalStatus(parsed.approvalStatus || "Draft Assessment");
      setNotes(parsed.notes || "");
      setWindBand(parsed.windBand || "normal");
      setWaveBand(parsed.waveBand || "normal");
      setVisibilityBand(parsed.visibilityBand || "normal");
      setDistanceBand(parsed.distanceBand || "normal");
      setRecoveryBeforeDarknessNotAssured(Boolean(parsed.recoveryBeforeDarknessNotAssured));
      setRecoveryWindowNotAssured(Boolean(parsed.recoveryWindowNotAssured));
      setForecastStabilityLt6h(Boolean(parsed.forecastStabilityLt6h));
      setReducedSpeedTowInterface(Boolean(parsed.reducedSpeedTowInterface));
      setClosePassSpreadHazard(Boolean(parsed.closePassSpreadHazard));
      setElectricalStorm(Boolean(parsed.electricalStorm));
      setFloatingDebrisFouling(Boolean(parsed.floatingDebrisFouling));
      setEscortUnavailable(Boolean(parsed.escortUnavailable));
      setFrbStandbyUnavailable(Boolean(parsed.frbStandbyUnavailable));
      setWbUnavailable(Boolean(parsed.wbUnavailable));
      setCommsStatus(parsed.commsStatus || "normal");
      setBoatMechanicalConcern(Boolean(parsed.boatMechanicalConcern));
      setLastDocumentNo(parsed.lastDocumentNo || "");
    } catch {
      setBarrierRequirements(buildDefaultBarrierRequirements());
    }
  }, []);

  useEffect(() => {
    const payload: StoredState = {
      selectedRows,
      barrierRequirements,
      assessmentAt,
      vesselName,
      operationArea,
      assessor,
      bridgeOfficer,
      approvalStatus,
      notes,
      windBand,
      waveBand,
      visibilityBand,
      distanceBand,
      recoveryBeforeDarknessNotAssured,
      recoveryWindowNotAssured,
      forecastStabilityLt6h,
      reducedSpeedTowInterface,
      closePassSpreadHazard,
      electricalStorm,
      floatingDebrisFouling,
      escortUnavailable,
      frbStandbyUnavailable,
      wbUnavailable,
      commsStatus,
      boatMechanicalConcern,
      lastDocumentNo,
    };
    window.localStorage.setItem("mopo-site-v5", JSON.stringify(payload));
  }, [
    selectedRows,
    barrierRequirements,
    assessmentAt,
    vesselName,
    operationArea,
    assessor,
    bridgeOfficer,
    approvalStatus,
    notes,
    windBand,
    waveBand,
    visibilityBand,
    distanceBand,
    recoveryBeforeDarknessNotAssured,
    recoveryWindowNotAssured,
    forecastStabilityLt6h,
    reducedSpeedTowInterface,
    closePassSpreadHazard,
    electricalStorm,
    floatingDebrisFouling,
    escortUnavailable,
    frbStandbyUnavailable,
    wbUnavailable,
    commsStatus,
    boatMechanicalConcern,
    lastDocumentNo,
  ]);

  const activeColumns = useMemo(
    () =>
      getActiveColumns({
        windBand,
        waveBand,
        visibilityBand,
        distanceBand,
        recoveryBeforeDarknessNotAssured,
        recoveryWindowNotAssured,
        forecastStabilityLt6h,
        reducedSpeedTowInterface,
        closePassSpreadHazard,
        electricalStorm,
        floatingDebrisFouling,
        escortUnavailable,
        frbStandbyUnavailable,
        wbUnavailable,
        commsStatus,
        boatMechanicalConcern,
      }),
    [
      windBand,
      waveBand,
      visibilityBand,
      distanceBand,
      recoveryBeforeDarknessNotAssured,
      recoveryWindowNotAssured,
      forecastStabilityLt6h,
      reducedSpeedTowInterface,
      closePassSpreadHazard,
      electricalStorm,
      floatingDebrisFouling,
      escortUnavailable,
      frbStandbyUnavailable,
      wbUnavailable,
      commsStatus,
      boatMechanicalConcern,
    ]
  );

  const selectedRowObjects = useMemo(() => ROWS.filter((row) => selectedRows.includes(row.id)), [selectedRows]);

  const evaluation = useMemo(() => {
    const rows = selectedRowObjects.map((row) => {
      if (row.mode === "emergency") {
        const prompts = activeColumns
          .filter((key) => [
            "waveGt1_5",
            "windGt20",
            "visibilityLt1",
            "electricalStorm",
            "commsDegraded",
            "commsLost",
            "escortUnavailable",
            "boatMechanicalConcern",
          ].includes(key))
          .map((key) => COLUMN_LABELS[key]);
        return {
          ...row,
          subtotal: 0,
          applied: [] as { key: ColumnKey; score: number }[],
          hardStopReasons: [] as ColumnKey[],
          emergencyPrompts: prompts,
          noGo: false,
        };
      }

      const applied: { key: ColumnKey; score: number }[] = [];
      const hardStopReasons: ColumnKey[] = [];
      for (const key of activeColumns) {
        if ((key === "escortUnavailable" || key === "frbStandbyUnavailable" || key === "wbUnavailable") && !shouldApplyBarrier(row.id, key, barrierRequirements)) {
          continue;
        }
        if (row.hardStops?.includes(key)) hardStopReasons.push(key);
        const score = row.rules?.[key];
        if (typeof score === "number") applied.push({ key, score });
      }

      const subtotal = (row.base || 0) + applied.reduce((sum, item) => sum + item.score, 0);
      const noGo = hardStopReasons.length > 0 || applied.some((item) => item.score >= 9);
      return {
        ...row,
        applied,
        hardStopReasons,
        emergencyPrompts: [] as string[],
        subtotal,
        noGo,
      };
    });

    const total = rows.filter((row) => row.mode === "scored").reduce((sum, row) => sum + row.subtotal, 0);
    const noGo = rows.some((row) => row.noGo);
    return { rows, total, noGo };
  }, [selectedRowObjects, activeColumns, barrierRequirements]);

  const nextReassessmentAt = addHours(assessmentAt, 4);
  const action = getAction(evaluation.total, evaluation.noGo);
  const nextDocumentNo = useMemo(() => getPreviewDocumentNo(assessmentAt), [assessmentAt, lastDocumentNo]);

  const summaryText = useMemo(() => {
    const lines: string[] = [
      "ORUÇ REIS MOPO V5 ASSESSMENT SUMMARY",
      `Vessel: ${vesselName}`,
      `Operation Area: ${operationArea}`,
      `Assessment Time: ${assessmentAt}`,
      `Next Reassessment Due: ${nextReassessmentAt}`,
      `Approval Status: ${approvalStatus}`,
      assessor ? `Assessor: ${assessor}` : "",
      bridgeOfficer ? `Bridge Duty Officer: ${bridgeOfficer}` : "",
      `Next Document No: ${nextDocumentNo}`,
      "",
      "Selected Rows:",
    ];

    if (!evaluation.rows.length) lines.push("- None");
    evaluation.rows.forEach((row) => {
      if (row.mode === "emergency") {
        lines.push(`- ${row.label} | Emergency Command Mode`);
        row.emergencyPrompts.forEach((prompt) => lines.push(`  • Prompt: ${prompt}`));
      } else {
        lines.push(`- ${row.label} | Base ${row.base || 0} | Subtotal ${row.subtotal}`);
        row.applied.forEach((item) => lines.push(`  • ${COLUMN_LABELS[item.key]} = +${item.score}`));
        row.hardStopReasons.forEach((item) => lines.push(`  • HARD STOP: ${COLUMN_LABELS[item]}`));
      }
    });

    lines.push("", `TOTAL MOPO RISK RATING: ${evaluation.total}`, `Required Action: ${action.title}`, action.detail);
    if (notes) lines.push("", "Notes:", notes);
    return lines.filter(Boolean).join("\n");
  }, [vesselName, operationArea, assessmentAt, nextReassessmentAt, approvalStatus, assessor, bridgeOfficer, nextDocumentNo, evaluation, action, notes]);

  const groupedRows = useMemo(() => {
    return {
      core: ROWS.filter((row) => row.family === "core"),
      wb: ROWS.filter((row) => row.family === "wb"),
      frb: ROWS.filter((row) => row.family === "frb"),
      transfer: ROWS.filter((row) => row.family === "transfer"),
    };
  }, []);

  const toggleRow = (id: string) => {
    setSelectedRows((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const resetAll = () => {
    setSelectedRows(["streamer_deploy_recovery"]);
    setBarrierRequirements(buildDefaultBarrierRequirements());
    setAssessmentAt(formatDateTimeLocal());
    setVesselName("RV Oruç Reis");
    setOperationArea("Offshore Seismic Operations");
    setAssessor("");
    setBridgeOfficer("");
    setApprovalStatus("Draft Assessment");
    setNotes("");
    setWindBand("normal");
    setWaveBand("normal");
    setVisibilityBand("normal");
    setDistanceBand("normal");
    setRecoveryBeforeDarknessNotAssured(false);
    setRecoveryWindowNotAssured(false);
    setForecastStabilityLt6h(false);
    setReducedSpeedTowInterface(false);
    setClosePassSpreadHazard(false);
    setElectricalStorm(false);
    setFloatingDebrisFouling(false);
    setEscortUnavailable(false);
    setFrbStandbyUnavailable(false);
    setWbUnavailable(false);
    setCommsStatus("normal");
    setBoatMechanicalConcern(false);
    setSaveMessage("Assessment reset.");
    window.setTimeout(() => setSaveMessage(""), 2200);
  };

  const copySummary = async () => {
    try {
      await navigator.clipboard.writeText(summaryText);
      setSaveMessage("Assessment summary copied.");
    } catch {
      setSaveMessage("Clipboard copy failed.");
    }
    window.setTimeout(() => setSaveMessage(""), 2200);
  };

  const saveSnapshot = () => {
    const payload: StoredState = {
      selectedRows,
      barrierRequirements,
      assessmentAt,
      vesselName,
      operationArea,
      assessor,
      bridgeOfficer,
      approvalStatus,
      notes,
      windBand,
      waveBand,
      visibilityBand,
      distanceBand,
      recoveryBeforeDarknessNotAssured,
      recoveryWindowNotAssured,
      forecastStabilityLt6h,
      reducedSpeedTowInterface,
      closePassSpreadHazard,
      electricalStorm,
      floatingDebrisFouling,
      escortUnavailable,
      frbStandbyUnavailable,
      wbUnavailable,
      commsStatus,
      boatMechanicalConcern,
      lastDocumentNo,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `oruc-reis-mopo-v5-save-${assessmentAt.replace(/[:T]/g, "-")}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setSaveMessage("Save file downloaded.");
    window.setTimeout(() => setSaveMessage(""), 2200);
  };

  const importSnapshot = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as StoredState;
        setSelectedRows(parsed.selectedRows || ["streamer_deploy_recovery"]);
        setBarrierRequirements(parsed.barrierRequirements || buildDefaultBarrierRequirements());
        setAssessmentAt(parsed.assessmentAt || formatDateTimeLocal());
        setVesselName(parsed.vesselName || "RV Oruç Reis");
        setOperationArea(parsed.operationArea || "Offshore Seismic Operations");
        setAssessor(parsed.assessor || "");
        setBridgeOfficer(parsed.bridgeOfficer || "");
        setApprovalStatus(parsed.approvalStatus || "Draft Assessment");
        setNotes(parsed.notes || "");
        setWindBand(parsed.windBand || "normal");
        setWaveBand(parsed.waveBand || "normal");
        setVisibilityBand(parsed.visibilityBand || "normal");
        setDistanceBand(parsed.distanceBand || "normal");
        setRecoveryBeforeDarknessNotAssured(Boolean(parsed.recoveryBeforeDarknessNotAssured));
        setRecoveryWindowNotAssured(Boolean(parsed.recoveryWindowNotAssured));
        setForecastStabilityLt6h(Boolean(parsed.forecastStabilityLt6h));
        setReducedSpeedTowInterface(Boolean(parsed.reducedSpeedTowInterface));
        setClosePassSpreadHazard(Boolean(parsed.closePassSpreadHazard));
        setElectricalStorm(Boolean(parsed.electricalStorm));
        setFloatingDebrisFouling(Boolean(parsed.floatingDebrisFouling));
        setEscortUnavailable(Boolean(parsed.escortUnavailable));
        setFrbStandbyUnavailable(Boolean(parsed.frbStandbyUnavailable));
        setWbUnavailable(Boolean(parsed.wbUnavailable));
        setCommsStatus(parsed.commsStatus || "normal");
        setBoatMechanicalConcern(Boolean(parsed.boatMechanicalConcern));
        setLastDocumentNo(parsed.lastDocumentNo || "");
        setSaveMessage("Save file loaded.");
      } catch {
        setSaveMessage("Invalid save file.");
      }
      window.setTimeout(() => setSaveMessage(""), 2200);
    };
    reader.readAsText(file);
    event.target.value = "";
  };

  const exportPdf = () => {
    const year = new Date(assessmentAt || Date.now()).getFullYear();
    const counterKey = `mopo-doc-counter-${year}`;
    const currentCounter = toNonNegativeNumber(window.localStorage.getItem(counterKey));
    const nextCounter = currentCounter + 1;
    const documentNo = `OR-MOPO-${year}-${String(nextCounter).padStart(3, "0")}`;

    const doc = new jsPDF({ unit: "pt", format: "a4" });
    let y = 42;

    const newPageIfNeeded = (extra = 0) => {
      if (y + extra > 760) {
        doc.addPage();
        y = 42;
      }
    };

    const writeBlock = (text: string, size = 10, bold = false, spacing = 15) => {
      doc.setFont("helvetica", bold ? "bold" : "normal");
      doc.setFontSize(size);
      const lines = doc.splitTextToSize(text, 510);
      newPageIfNeeded(lines.length * spacing + 10);
      doc.text(lines, 42, y);
      y += lines.length * spacing;
    };

    doc.setFillColor(15, 23, 42);
    doc.roundedRect(42, 28, 511, 64, 12, 12, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("TP-OTC / RV ORUÇ REIS", 56, 56);
    doc.setFontSize(11);
    doc.text("ORUÇ REIS MOPO ASSESSMENT RECORD", 56, 74);
    doc.setFontSize(9);
    doc.text(`Document No: ${documentNo}`, 420, 56);
    doc.text(`Issued: ${assessmentAt.replace("T", " ")}`, 420, 74);

    doc.setTextColor(15, 23, 42);
    y = 118;
    writeBlock(`Vessel: ${vesselName}`, 11, true);
    writeBlock(`Operation Area: ${operationArea}`);
    writeBlock(`Assessment Time: ${assessmentAt}`);
    writeBlock(`Next Reassessment Due: ${nextReassessmentAt}`);
    writeBlock(`Approval Status: ${approvalStatus}`);
    if (assessor) writeBlock(`Assessor: ${assessor}`);
    if (bridgeOfficer) writeBlock(`Bridge Duty Officer: ${bridgeOfficer}`);
    writeBlock(`Total MOPO Risk Rating: ${evaluation.total}`, 11, true);
    writeBlock(`Required Action: ${action.title}`, 11, true);
    writeBlock(action.detail);

    y += 8;
    writeBlock("Selected Rows", 12, true);
    evaluation.rows.forEach((row) => {
      if (row.mode === "emergency") {
        writeBlock(`• ${row.label} | Emergency Command Mode`);
        row.emergencyPrompts.forEach((prompt) => writeBlock(`   - Prompt: ${prompt}`));
      } else {
        writeBlock(`• ${row.label} | Base ${row.base || 0} | Subtotal ${row.subtotal}`);
        row.applied.forEach((item) => writeBlock(`   - ${COLUMN_LABELS[item.key]} = +${item.score}`));
        row.hardStopReasons.forEach((item) => writeBlock(`   - HARD STOP: ${COLUMN_LABELS[item]}`, 10, true));
      }
    });

    if (notes) {
      y += 8;
      writeBlock("Operational Notes", 12, true);
      writeBlock(notes);
    }

    const totalPages = doc.getNumberOfPages();
    for (let page = 1; page <= totalPages; page += 1) {
      doc.setPage(page);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text(`Page ${page} of ${totalPages}`, 500, 815);
    }

    doc.save(`${documentNo}.pdf`);
    window.localStorage.setItem(counterKey, String(nextCounter));
    setLastDocumentNo(documentNo);
    setSaveMessage(`PDF exported: ${documentNo}`);
    window.setTimeout(() => setSaveMessage(""), 2500);
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="border-b border-slate-200 bg-slate-950 text-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-5 md:px-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="rounded-3xl bg-white/10 p-3 ring-1 ring-white/10">
              <ShipWheel className="h-7 w-7" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.25em] text-slate-300">
                <span>TP-OTC</span>
                <span>•</span>
                <span>RV Oruç Reis</span>
                <span>•</span>
                <span>MOPO V5 Engine</span>
              </div>
              <h1 className="mt-2 text-2xl font-bold tracking-tight md:text-3xl">Matrix of Permitted Operations</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
                Oruç Reis-adapted V5 scoring engine with core rows, WB annex, FRB exceptional-use logic, transfer rows, hard-stop catalogue, and numbered PDF export.
              </p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <div className="rounded-3xl border border-white/10 bg-white/5 px-4 py-3">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Assessment status</div>
              <div className="mt-2 flex items-center gap-2 text-sm font-semibold text-white">
                <RiskIcon level={action.icon} />
                {action.title}
              </div>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/5 px-4 py-3">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Total MOPO Risk Rating</div>
              <div className="mt-2 text-2xl font-black text-white">{evaluation.total}</div>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/5 px-4 py-3">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Next PDF Number</div>
              <div className="mt-2 text-sm font-semibold text-white">{nextDocumentNo}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6 md:px-8">
        <div className="mb-6 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <SectionTitle icon={<Building2 className="h-5 w-5" />} title="Assessment header" subtitle="Forecast-based watch assessment with numbered export control." />
              <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold ${action.badge}`}>
                <RiskIcon level={action.icon} />
                {action.title}
              </div>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Vessel</label>
                <input value={vesselName} onChange={(e) => setVesselName(e.target.value)} className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 outline-none focus:border-slate-400" />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Operation Area</label>
                <input value={operationArea} onChange={(e) => setOperationArea(e.target.value)} className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 outline-none focus:border-slate-400" />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Assessment time</label>
                <input type="datetime-local" value={assessmentAt} onChange={(e) => setAssessmentAt(e.target.value)} className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 outline-none focus:border-slate-400" />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Assessor</label>
                <input value={assessor} onChange={(e) => setAssessor(e.target.value)} className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 outline-none focus:border-slate-400" />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Bridge Duty Officer</label>
                <input value={bridgeOfficer} onChange={(e) => setBridgeOfficer(e.target.value)} className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 outline-none focus:border-slate-400" />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Approval Status</label>
                <select value={approvalStatus} onChange={(e) => setApprovalStatus(e.target.value)} className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 outline-none focus:border-slate-400">
                  <option>Draft Assessment</option>
                  <option>Bridge Reviewed</option>
                  <option>Responsible Person Reviewed</option>
                  <option>Escalated for MOC</option>
                  <option>Approved for Execution</option>
                </select>
              </div>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Next reassessment</div>
                <div className="mt-2 text-sm font-semibold text-slate-900">{nextReassessmentAt}</div>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Last exported PDF</div>
                <div className="mt-2 text-sm font-semibold text-slate-900">{lastDocumentNo || "None"}</div>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Mobile-ready layout</div>
                <div className="mt-2 flex items-center gap-2 text-sm font-semibold text-slate-900"><Smartphone className="h-4 w-4" /> Responsive grid enabled</div>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <SectionTitle icon={<Shield className="h-5 w-5" />} title="Control actions" subtitle="Numbered PDF, save / load, copy summary and reset." />
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <button onClick={copySummary} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-50">
                <ClipboardList className="h-4 w-4" /> Copy summary
              </button>
              <button onClick={exportPdf} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-50">
                <Download className="h-4 w-4" /> Export numbered PDF
              </button>
              <button onClick={saveSnapshot} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-50">
                <Save className="h-4 w-4" /> Save file
              </button>
              <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-50">
                <Upload className="h-4 w-4" /> Load file
                <input type="file" accept="application/json" onChange={importSnapshot} className="hidden" />
              </label>
              <button onClick={resetAll} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800 sm:col-span-2">
                <RotateCcw className="h-4 w-4" /> Reset assessment
              </button>
            </div>
            <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-xs leading-6 text-slate-600">
              <div className="font-semibold text-slate-700">Global rules locked</div>
              <div className="mt-1">Any hard stop = No-Go. Any +9 in scored mode = No-Go. FRB SAR / MOB remains emergency command mode and does not contribute to total score.</div>
            </div>
            {saveMessage ? <div className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">{saveMessage}</div> : null}
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
          <div className="space-y-6">
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <SectionTitle icon={<Settings2 className="h-5 w-5" />} title="Active row selection" subtitle="Select one or more rows. WB, FRB, transfer and core packages can run as SIMOPS." />
              <div className="mt-5 space-y-5">
                {(Object.keys(groupedRows) as Family[]).map((family) => (
                  <div key={family}>
                    <div className="mb-3 text-sm font-semibold text-slate-700">{FAMILY_LABELS[family]}</div>
                    <div className="grid gap-3 md:grid-cols-2">
                      {groupedRows[family].map((row) => {
                        const checked = selectedRows.includes(row.id);
                        return (
                          <button
                            key={row.id}
                            type="button"
                            onClick={() => toggleRow(row.id)}
                            className={`rounded-2xl border p-4 text-left transition ${checked ? "border-slate-900 bg-slate-900 text-white shadow-sm" : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"}`}
                          >
                            <div className="text-sm font-semibold">{row.label}</div>
                            <div className={`mt-1 text-xs ${checked ? "text-slate-300" : "text-slate-500"}`}>
                              {row.mode === "emergency" ? "Emergency command mode" : `Base ${row.base || 0}`}
                            </div>
                            {row.description ? <div className={`mt-2 text-xs leading-5 ${checked ? "text-slate-300" : "text-slate-600"}`}>{row.description}</div> : null}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <SectionTitle icon={<Waves className="h-5 w-5" />} title="Condition engine" subtitle="Bands are exclusive. Only the highest selected band in each family is applied." />
              <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Wind</label>
                  <select value={windBand} onChange={(e) => setWindBand(e.target.value as "normal" | "gt16" | "gt20" | "gt27")} className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 outline-none focus:border-slate-400">
                    <option value="normal">Normal</option>
                    <option value="gt16">&gt;16 kn</option>
                    <option value="gt20">&gt;20 kn</option>
                    <option value="gt27">&gt;27 kn</option>
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Wave</label>
                  <select value={waveBand} onChange={(e) => setWaveBand(e.target.value as "normal" | "gt1_5" | "gt2_0" | "gt3_0")} className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 outline-none focus:border-slate-400">
                    <option value="normal">Normal</option>
                    <option value="gt1_5">&gt;1.5 m</option>
                    <option value="gt2_0">&gt;2.0 m</option>
                    <option value="gt3_0">&gt;3.0 m</option>
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Visibility</label>
                  <select value={visibilityBand} onChange={(e) => setVisibilityBand(e.target.value as "normal" | "vis1_2" | "visLt1")} className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 outline-none focus:border-slate-400">
                    <option value="normal">Normal</option>
                    <option value="vis1_2">1–2 NM</option>
                    <option value="visLt1">&lt;1 NM</option>
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Distance</label>
                  <select value={distanceBand} onChange={(e) => setDistanceBand(e.target.value as "normal" | "gt0_3" | "gt10")} className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 outline-none focus:border-slate-400">
                    <option value="normal">Normal</option>
                    <option value="gt0_3">&gt;0.3 NM</option>
                    <option value="gt10">&gt;10 NM</option>
                  </select>
                </div>
              </div>
              <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {[
                  [recoveryBeforeDarknessNotAssured, setRecoveryBeforeDarknessNotAssured, "Recovery before darkness not assured"],
                  [recoveryWindowNotAssured, setRecoveryWindowNotAssured, "Recovery weather window not assured"],
                  [forecastStabilityLt6h, setForecastStabilityLt6h, "Forecast stability <6 h"],
                  [reducedSpeedTowInterface, setReducedSpeedTowInterface, "Reduced-speed tow interface"],
                  [closePassSpreadHazard, setClosePassSpreadHazard, "Close pass / spread hazard proximity"],
                  [electricalStorm, setElectricalStorm, "Electrical storm"],
                  [floatingDebrisFouling, setFloatingDebrisFouling, "Floating debris / fouling risk"],
                  [escortUnavailable, setEscortUnavailable, "Escort / support unavailable"],
                  [frbStandbyUnavailable, setFrbStandbyUnavailable, "FRB standby unavailable"],
                  [wbUnavailable, setWbUnavailable, "WB unavailable"],
                  [boatMechanicalConcern, setBoatMechanicalConcern, "Boat mechanical readiness concern"],
                ].map(([value, setter, label]) => (
                  <label key={String(label)} className="flex items-center gap-3 rounded-2xl border border-slate-200 p-3 text-sm text-slate-700">
                    <input type="checkbox" checked={Boolean(value)} onChange={(e) => (setter as React.Dispatch<React.SetStateAction<boolean>>)(e.target.checked)} className="h-4 w-4" />
                    <span>{label as string}</span>
                  </label>
                ))}
                <div className="rounded-2xl border border-slate-200 p-3">
                  <label className="mb-2 block text-sm font-medium text-slate-700">Communications</label>
                  <select value={commsStatus} onChange={(e) => setCommsStatus(e.target.value as "normal" | "degraded" | "lost")} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-slate-400">
                    <option value="normal">Normal</option>
                    <option value="degraded">Degraded</option>
                    <option value="lost">Lost</option>
                  </select>
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <SectionTitle icon={<Shield className="h-5 w-5" />} title="Barrier applicability" subtitle="Barrier columns only score when they are actually required by the selected task profile." />
              <div className="mt-4 space-y-4">
                {selectedRowObjects.filter((row) => row.mode === "scored").map((row) => {
                  const availableBarriers = (Object.keys(row.defaultBarrierRequirements || {}) as BarrierRequirementKey[]).filter(
                    (key) => row.rules?.[key] !== undefined || row.hardStops?.includes(key)
                  );
                  if (!availableBarriers.length) return null;
                  return (
                    <div key={row.id} className="rounded-2xl border border-slate-200 p-4">
                      <div className="text-sm font-semibold text-slate-900">{row.label}</div>
                      <div className="mt-3 flex flex-wrap gap-3">
                        {availableBarriers.map((key) => (
                          <label key={key} className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700">
                            <input
                              type="checkbox"
                              checked={Boolean(barrierRequirements[row.id]?.[key])}
                              onChange={(e) =>
                                setBarrierRequirements((prev) => ({
                                  ...prev,
                                  [row.id]: {
                                    ...prev[row.id],
                                    [key]: e.target.checked,
                                  },
                                }))
                              }
                              className="h-4 w-4"
                            />
                            {getBarrierToggleLabel(key)}
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>

          <div className="space-y-6">
            <section className={`rounded-3xl border bg-white p-5 shadow-sm ring-1 ${action.ring}`}>
              <SectionTitle icon={<RiskIcon level={action.icon} />} title="Total MOPO Risk Rating" subtitle="Total score, no-go logic, and action band according to locked V5 rules." />
              <div className="mt-5 rounded-3xl border border-slate-200 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Total score</div>
                    <div className="mt-2 text-5xl font-black tracking-tight text-slate-950">{evaluation.total}</div>
                  </div>
                  <span className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold ${action.badge}`}>
                    <RiskIcon level={action.icon} />
                    {action.title}
                  </span>
                </div>
                <p className="mt-4 text-sm leading-6 text-slate-600">{action.detail}</p>
              </div>
              <div className="mt-4 grid gap-3 text-sm text-slate-700">
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">0–4: No additional action required.</div>
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">5–6: Conduct Risk Assessment.</div>
                <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4">7–8: Review full Risk Assessment.</div>
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">9: Submit MOC / escalation.</div>
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4">Any hard stop or +9: No-Go / escalation required.</div>
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <SectionTitle icon={<ClipboardList className="h-5 w-5" />} title="Per-row engine output" subtitle="Applied scores, hard stops and emergency prompts." />
              <div className="mt-4 space-y-3">
                {evaluation.rows.length ? (
                  evaluation.rows.map((row) => (
                    <div key={row.id} className="rounded-2xl border border-slate-200 p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-slate-900">{row.label}</div>
                          <div className="mt-1 text-xs text-slate-500">{FAMILY_LABELS[row.family]}</div>
                        </div>
                        <div className="rounded-2xl bg-slate-100 px-3 py-2 text-sm font-bold text-slate-900">{row.mode === "emergency" ? "CMD" : row.subtotal}</div>
                      </div>
                      {row.mode === "emergency" ? (
                        <div className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs leading-6 text-amber-800">
                          Emergency command mode. {row.emergencyPrompts.length ? `Prompts: ${row.emergencyPrompts.join(", ")}` : "No escalation prompts currently active."}
                        </div>
                      ) : null}
                      {row.mode === "scored" && row.applied.length ? (
                        <div className="mt-3 space-y-1 text-xs text-slate-600">
                          {row.applied.map((item) => (
                            <div key={`${row.id}-${item.key}`}>• {COLUMN_LABELS[item.key]} = +{item.score}</div>
                          ))}
                        </div>
                      ) : null}
                      {row.mode === "scored" && row.hardStopReasons.length ? (
                        <div className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs leading-6 text-red-700">
                          Hard stops: {row.hardStopReasons.map((item) => COLUMN_LABELS[item]).join(", ")}
                        </div>
                      ) : null}
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed p-4 text-sm text-slate-500">Select at least one row.</div>
                )}
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <SectionTitle icon={<FileText className="h-5 w-5" />} title="Operational notes" subtitle="Bridge comments, Master judgement, PTW interaction, compensating controls." />
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Enter operational notes, RA references, barrier confirmation, escort details, daylight return logic..." className="mt-4 min-h-[170px] w-full rounded-2xl border border-slate-200 px-3 py-3 outline-none focus:border-slate-400" />
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <SectionTitle icon={<Download className="h-5 w-5" />} title="Assessment summary" subtitle="Ready for copy, numbered PDF export, and recordkeeping." />
              <pre className="mt-4 overflow-auto rounded-2xl bg-slate-950 p-4 text-xs leading-6 text-slate-100">{summaryText}</pre>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
