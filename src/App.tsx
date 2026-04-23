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
      orangeBg: [255, 247, 237] as const,
