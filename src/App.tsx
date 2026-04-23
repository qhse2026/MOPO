import React, { useEffect, useMemo, useRef, useState } from "react";
import { jsPDF } from "jspdf";
import { Download, FileText, Save, Upload, Shield, AlertTriangle, CheckCircle2, Waves, ShipWheel, ClipboardList, RotateCcw, Smartphone, Building2 } from "lucide-react";

type Condition = {
  key: string;
  label: string;
  group: "natural" | "operational";
  requires?: string;
};

type ScoreMap = Record<string, number | null>;

type ActivityRow = {
  id: string;
  label: string;
  responsible: string;
  notes?: string;
  scores: ScoreMap;
};

type ReferenceNote = {
  id: string;
  text: string;
};

type Checks = Record<string, boolean>;

type StoredState = {
  selectedActivities?: string[];
  checks?: Checks;
  assessmentAt?: string;
  vesselName?: string;
  assessor?: string;
  bridgeOfficer?: string;
  manualAddOn?: number;
  extraBoatCount?: number;
  notes?: string;
  operationArea?: string;
  approvalStatus?: string;
};

const CONDITIONS: Condition[] = [
  { key: "hoursDarkness", label: "Hours of darkness", group: "natural" },
  { key: "seaOver3m", label: "Sea height > 3 m", group: "natural" },
  { key: "seaFromRedDir", label: "Sea and swell from red direction", group: "natural", requires: "seaOver3m" },
  { key: "workingDeckLt6_5m", label: "Working decks < 6.5 m from sea level", group: "natural", requires: "seaOver3m" },
  { key: "seaOver5m", label: "Sea height > 5 m", group: "natural" },
  { key: "visibilityLt500m", label: "Visibility < 500 m", group: "natural" },
  { key: "shallowWaterLt50m", label: "Entering < 50 m water depth", group: "natural" },
  { key: "lowTempOrHeatIndex", label: "Air and/or water temp < 5°C or heat index > 36°C", group: "natural" },
  { key: "windOver25", label: "Wind speed > 25 knots", group: "natural" },
  { key: "supportNotAvailable", label: "Support vessel not available", group: "operational" },
  { key: "wbFrbInop", label: "WB & FRB inoperative due to malfunction / adverse weather", group: "operational" },
  { key: "turningRadiusLt5km", label: "Turning radius < 5 km (2D < 2 km)", group: "operational" },
  { key: "passingObstructionLt500m", label: "Passing obstruction and/or deadheading < 500 m", group: "operational" },
  { key: "localShipsFishing", label: "Working in areas of significant local ships / fishing", group: "operational" },
  { key: "propulsionInop", label: "Main or back-up propulsion inoperative / under maintenance", group: "operational" },
  { key: "ptwAffectingOps", label: "Any PTW activity onboard affecting operations", group: "operational" },
  { key: "ultraRemote", label: "Ultra remote location (medical evacuation time > 24 h)", group: "operational" },
];

const emptyChecks: Checks = Object.fromEntries(CONDITIONS.map((item) => [item.key, false]));

const ACTIVITY_ROWS: ActivityRow[] = [
  {
    id: "transit_normal_seismic",
    label: "In Transit OR Normal Seismic Ops (Gear deployed)",
    responsible: "Duty Deck Officer",
    scores: {
      hoursDarkness: 1,
      seaOver3m: 2,
      seaFromRedDir: 1,
      workingDeckLt6_5m: 5,
      seaOver5m: 1,
      visibilityLt500m: 1,
      shallowWaterLt50m: 1,
      lowTempOrHeatIndex: 0,
      windOver25: 1,
      supportNotAvailable: 1,
      wbFrbInop: 1,
      turningRadiusLt5km: 1,
      passingObstructionLt500m: 5,
      localShipsFishing: 2,
      propulsionInop: 5,
      ptwAffectingOps: 1,
      ultraRemote: 0,
    },
  },
  {
    id: "streamer_deploy_recovery",
    label: "Streamer deployment / recovery",
    responsible: "Chief Observer",
    scores: {
      hoursDarkness: 1,
      seaOver3m: 2,
      seaFromRedDir: 2,
      workingDeckLt6_5m: 1,
      seaOver5m: 9,
      visibilityLt500m: 1,
      shallowWaterLt50m: 3,
      lowTempOrHeatIndex: 1,
      windOver25: 0,
      supportNotAvailable: 3,
      wbFrbInop: 3,
      turningRadiusLt5km: 2,
      passingObstructionLt500m: 9,
      localShipsFishing: 3,
      propulsionInop: 3,
      ptwAffectingOps: 1,
      ultraRemote: 1,
    },
  },
  {
    id: "gun_array_deploy_recovery",
    label: "Gun arrays deployment / recovery",
    responsible: "Chief Mechanic",
    scores: {
      hoursDarkness: 1,
      seaOver3m: 2,
      seaFromRedDir: 2,
      workingDeckLt6_5m: 1,
      seaOver5m: 9,
      visibilityLt500m: 1,
      shallowWaterLt50m: 4,
      lowTempOrHeatIndex: 1,
      windOver25: 0,
      supportNotAvailable: 3,
      wbFrbInop: 3,
      turningRadiusLt5km: 1,
      passingObstructionLt500m: 9,
      localShipsFishing: 1,
      propulsionInop: 3,
      ptwAffectingOps: 1,
      ultraRemote: 1,
    },
  },
  {
    id: "monowing_barovane_deploy_recovery",
    label: "Monowing / Barovane deployment / recovery",
    responsible: "Chief Mechanic",
    scores: {
      hoursDarkness: 1,
      seaOver3m: 2,
      seaFromRedDir: 1,
      workingDeckLt6_5m: 1,
      seaOver5m: 9,
      visibilityLt500m: 1,
      shallowWaterLt50m: 3,
      lowTempOrHeatIndex: 1,
      windOver25: 1,
      supportNotAvailable: 3,
      wbFrbInop: 3,
      turningRadiusLt5km: 3,
      passingObstructionLt500m: 9,
      localShipsFishing: 1,
      propulsionInop: 3,
      ptwAffectingOps: 1,
      ultraRemote: 1,
    },
  },
  {
    id: "emergency_drills",
    label: "Emergency drills",
    responsible: "Chief Officer",
    scores: {
      hoursDarkness: 5,
      seaOver3m: 1,
      seaFromRedDir: null,
      workingDeckLt6_5m: null,
      seaOver5m: 9,
      visibilityLt500m: 3,
      shallowWaterLt50m: 5,
      lowTempOrHeatIndex: 1,
      windOver25: 0,
      supportNotAvailable: null,
      wbFrbInop: 1,
      turningRadiusLt5km: null,
      passingObstructionLt500m: 9,
      localShipsFishing: 4,
      propulsionInop: 5,
      ptwAffectingOps: 9,
      ultraRemote: 0,
    },
  },
  {
    id: "offshore_gangway_transfers",
    label: "Offshore gangway transfers",
    responsible: "Chief Officer",
    scores: {
      hoursDarkness: 9,
      seaOver3m: 9,
      seaFromRedDir: null,
      workingDeckLt6_5m: null,
      seaOver5m: 9,
      visibilityLt500m: 4,
      shallowWaterLt50m: 1,
      lowTempOrHeatIndex: 1,
      windOver25: 1,
      supportNotAvailable: 3,
      wbFrbInop: 3,
      turningRadiusLt5km: 3,
      passingObstructionLt500m: 9,
      localShipsFishing: 4,
      propulsionInop: 9,
      ptwAffectingOps: 1,
      ultraRemote: 2,
    },
  },
  {
    id: "frb_wb_water_taxi_underway",
    label: "FRB / WB / Water Taxi operations underway",
    responsible: "Master / PM",
    notes: "For every additional boat deployed increase +1.",
    scores: {
      hoursDarkness: 9,
      seaOver3m: 4,
      seaFromRedDir: null,
      workingDeckLt6_5m: null,
      seaOver5m: 9,
      visibilityLt500m: 4,
      shallowWaterLt50m: null,
      lowTempOrHeatIndex: 1,
      windOver25: 1,
      supportNotAvailable: 3,
      wbFrbInop: 3,
      turningRadiusLt5km: 3,
      passingObstructionLt500m: 9,
      localShipsFishing: 2,
      propulsionInop: 1,
      ptwAffectingOps: 1,
      ultraRemote: 1,
    },
  },
];

const REFERENCE_NOTES: ReferenceNote[] = [
  { id: "A", text: "No vessel course changes are allowed while personnel transfers are ongoing. If visibility is below 500 m, additional PPE such as safety harness should be considered in a vessel-specific JSA and approved by MOC." },
  { id: "B", text: "Great caution is to be taken by Master and Duty Officers whenever the vessel is running following seas due to the potential for flooding and free surface effect." },
  { id: "C", text: "Pitch, roll or heave shall not exceed helicopter operator specification." },
  { id: "D", text: "In addition, a MOC must be submitted prior to commencement of any non-standard equipment recovery." },
  { id: "E", text: "Emergency drills affecting on-duty personnel on bridge or instrument room." },
  { id: "F", text: "FRB inoperative due to malfunction requires an official exemption from Flag as part of SOLAS equipment. If a support vessel is unavailable a MOC is required." },
  { id: "G", text: "If the mother vessel has been taken under tow as a mitigation measure during this operation with an approved MOC, the risk may then be reduced by 1." },
  { id: "H", text: "Pilot launches may come alongside at night within harbour approaches, anchorage areas or sheltered inland waters, under Master authority by Risk Assessment." },
  { id: "I", text: "During electrical storms, personnel are not permitted to work outside in any routine activity, including open deck, crane and small boat activities." },
  { id: "J", text: "Wind speed note is applicable when operations take place on the windward side." },
  { id: "K", text: "If location is ultra-remote, i.e. medical evacuation time is more than 24 hours from an approved or nearest secondary or tertiary health care facility, great caution is required. When transiting, all high-risk activities are to be performed under an MOC." },
];

function pad(value: number): string {
  return String(value).padStart(2, "0");
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

function toNonNegativeNumber(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return parsed;
}

function getAction(total: number): { title: string; detail: string; badge: string; ring: string; icon: "green" | "amber" | "orange" | "red" } {
  if (total <= 4) {
    return {
      title: "No additional action required",
      detail: "Operation may proceed within normal controls.",
      badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
      ring: "ring-emerald-200",
      icon: "green",
    };
  }
  if (total <= 6) {
    return {
      title: "Conduct Risk Assessment",
      detail: "Additional risk assessment shall be carried out and controls implemented to ensure ALARP.",
      badge: "bg-amber-50 text-amber-700 border-amber-200",
      ring: "ring-amber-200",
      icon: "amber",
    };
  }
  if (total <= 8) {
    return {
      title: "Review full Risk Assessment",
      detail: "Review the full risk assessment before proceeding.",
      badge: "bg-orange-50 text-orange-700 border-orange-200",
      ring: "ring-orange-200",
      icon: "orange",
    };
  }
  if (total === 9) {
    return {
      title: "Submit MOC",
      detail: "Extended toolbox shall always take place prior to the activity.",
      badge: "bg-rose-50 text-rose-700 border-rose-200",
      ring: "ring-rose-200",
      icon: "red",
    };
  }
  return {
    title: "Prohibited combination under normal circumstances",
    detail: "Consider stopping one activity and re-evaluating, or raise an MOC request to proceed.",
    badge: "bg-red-50 text-red-700 border-red-200",
    ring: "ring-red-200",
    icon: "red",
  };
}

function scoreLabel(score: number | null | undefined): string {
  if (score === null || score === undefined) return "N/A";
  return `+${score}`;
}

function isConditionActive(condition: Condition, checks: Checks): boolean {
  if (!checks[condition.key]) return false;
  if (condition.requires && !checks[condition.requires]) return false;
  return true;
}

function getConditionScoreForFirstRow(conditionKey: string, rows: ActivityRow[]): number | null {
  if (!rows.length) return null;
  const value = rows[0].scores[conditionKey];
  return typeof value === "number" || value === null ? value : null;
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

function ConditionCard({
  label,
  score,
  checked,
  onToggle,
  disabled,
  helper,
}: {
  label: string;
  score: number | null;
  checked: boolean;
  onToggle: (next: boolean) => void;
  disabled: boolean;
  helper: string;
}) {
  const interactive = !disabled && score !== null;

  return (
    <button
      type="button"
      onClick={() => {
        if (interactive) onToggle(!checked);
      }}
      className={`w-full rounded-2xl border p-4 text-left transition-all ${
        checked
          ? "border-slate-900 bg-slate-900 text-white shadow-sm"
          : "border-slate-200 bg-white text-slate-900 hover:border-slate-300 hover:shadow-sm"
      } ${interactive ? "" : "cursor-not-allowed opacity-50"}`}
      aria-pressed={checked}
      disabled={!interactive}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold md:text-[15px]">{label}</div>
          <div className={`mt-1 text-xs leading-5 ${checked ? "text-slate-300" : "text-slate-500"}`}>{helper}</div>
        </div>
        <div className={`shrink-0 rounded-xl px-2.5 py-1 text-xs font-semibold ${checked ? "bg-white/15 text-white" : "bg-slate-100 text-slate-700"}`}>
          {scoreLabel(score)}
        </div>
      </div>
    </button>
  );
}

function ActivityScoreCard({
  activity,
  checks,
  extraBoatCount,
}: {
  activity: ActivityRow & { subtotal: number };
  checks: Checks;
  extraBoatCount: number;
}) {
  const activeConditions = CONDITIONS.filter((condition) => isConditionActive(condition, checks)).map((condition) => condition.label);
  const extraBoatPenalty = activity.id === "frb_wb_water_taxi_underway" ? toNonNegativeNumber(extraBoatCount) : 0;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-900">{activity.label}</div>
          <div className="mt-1 text-xs text-slate-500">Responsible Person: {activity.responsible}</div>
          {activity.notes ? <div className="mt-2 text-xs text-slate-600">{activity.notes}</div> : null}
        </div>
        <div className="rounded-2xl bg-slate-100 px-3 py-2 text-sm font-bold text-slate-900">{activity.subtotal}</div>
      </div>
      {extraBoatPenalty > 0 ? <div className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">Additional deployed boats add +{extraBoatPenalty} to this activity.</div> : null}
      {activeConditions.length ? <div className="mt-3 text-xs leading-5 text-slate-500">Applied conditions: {activeConditions.join(", ")}</div> : null}
    </div>
  );
}

export default function MopoMatrixStarterSite() {
  const [selectedActivities, setSelectedActivities] = useState<string[]>(["streamer_deploy_recovery"]);
  const [checks, setChecks] = useState<Checks>(emptyChecks);
  const [assessmentAt, setAssessmentAt] = useState<string>(formatDateTimeLocal());
  const [vesselName, setVesselName] = useState<string>("RV Oruç Reis");
  const [operationArea, setOperationArea] = useState<string>("Offshore Seismic Operations");
  const [assessor, setAssessor] = useState<string>("");
  const [bridgeOfficer, setBridgeOfficer] = useState<string>("");
  const [approvalStatus, setApprovalStatus] = useState<string>("Draft Assessment");
  const [manualAddOn, setManualAddOn] = useState<number>(0);
  const [extraBoatCount, setExtraBoatCount] = useState<number>(0);
  const [notes, setNotes] = useState<string>("");
  const [saveMessage, setSaveMessage] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const raw = window.localStorage.getItem("mopo-site-v3");
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as StoredState;
      setSelectedActivities(Array.isArray(parsed.selectedActivities) && parsed.selectedActivities.length ? parsed.selectedActivities : ["streamer_deploy_recovery"]);
      setChecks({ ...emptyChecks, ...(parsed.checks ?? {}) });
      setAssessmentAt(typeof parsed.assessmentAt === "string" && parsed.assessmentAt ? parsed.assessmentAt : formatDateTimeLocal());
      setVesselName(typeof parsed.vesselName === "string" && parsed.vesselName ? parsed.vesselName : "RV Oruç Reis");
      setOperationArea(typeof parsed.operationArea === "string" && parsed.operationArea ? parsed.operationArea : "Offshore Seismic Operations");
      setAssessor(typeof parsed.assessor === "string" ? parsed.assessor : "");
      setBridgeOfficer(typeof parsed.bridgeOfficer === "string" ? parsed.bridgeOfficer : "");
      setApprovalStatus(typeof parsed.approvalStatus === "string" && parsed.approvalStatus ? parsed.approvalStatus : "Draft Assessment");
      setManualAddOn(toNonNegativeNumber(parsed.manualAddOn));
      setExtraBoatCount(toNonNegativeNumber(parsed.extraBoatCount));
      setNotes(typeof parsed.notes === "string" ? parsed.notes : "");
    } catch {
      setSelectedActivities(["streamer_deploy_recovery"]);
      setChecks(emptyChecks);
      setAssessmentAt(formatDateTimeLocal());
      setVesselName("RV Oruç Reis");
      setOperationArea("Offshore Seismic Operations");
      setAssessor("");
      setBridgeOfficer("");
      setApprovalStatus("Draft Assessment");
      setManualAddOn(0);
      setExtraBoatCount(0);
      setNotes("");
    }
  }, []);

  useEffect(() => {
    const payload: StoredState = {
      selectedActivities,
      checks,
      assessmentAt,
      vesselName,
      operationArea,
      assessor,
      bridgeOfficer,
      approvalStatus,
      manualAddOn,
      extraBoatCount,
      notes,
    };
    window.localStorage.setItem("mopo-site-v3", JSON.stringify(payload));
  }, [selectedActivities, checks, assessmentAt, vesselName, operationArea, assessor, bridgeOfficer, approvalStatus, manualAddOn, extraBoatCount, notes]);

  const activeRows = useMemo(() => ACTIVITY_ROWS.filter((row) => selectedActivities.includes(row.id)), [selectedActivities]);

  const perActivity = useMemo(() => {
    return activeRows.map((activity) => {
      const subtotalFromConditions = CONDITIONS.reduce((sum, condition) => {
        const value = activity.scores[condition.key];
        if (!isConditionActive(condition, checks)) return sum;
        if (typeof value !== "number") return sum;
        return sum + value;
      }, 1);

      const extraBoatPenalty = activity.id === "frb_wb_water_taxi_underway" ? toNonNegativeNumber(extraBoatCount) : 0;

      return {
        ...activity,
        subtotal: subtotalFromConditions + extraBoatPenalty,
      };
    });
  }, [activeRows, checks, extraBoatCount]);

  const safeManualAddOn = toNonNegativeNumber(manualAddOn);
  const totalScore = perActivity.reduce((sum, item) => sum + item.subtotal, 0) + safeManualAddOn;
  const action = getAction(totalScore);
  const nextReassessmentAt = addHours(assessmentAt, 4);
  const selectedConditionLabels = CONDITIONS.filter((condition) => isConditionActive(condition, checks)).map((condition) => condition.label);

  const summaryLines = [
    "MOPO ASSESSMENT SUMMARY",
    `Vessel: ${vesselName}`,
    `Operation Area: ${operationArea}`,
    `Assessment time: ${assessmentAt}`,
    `Next reassessment due: ${nextReassessmentAt}`,
    `Approval Status: ${approvalStatus}`,
    assessor ? `Assessor: ${assessor}` : null,
    bridgeOfficer ? `Bridge Duty Officer: ${bridgeOfficer}` : null,
    "",
    "Selected activities:",
    ...(perActivity.length ? perActivity.map((item) => `- ${item.label} | Responsible: ${item.responsible} | Score: ${item.subtotal}`) : ["- None"]),
    "",
    "Applied conditions:",
    ...(selectedConditionLabels.length ? selectedConditionLabels.map((item) => `- ${item}`) : ["- None"]),
    "",
    safeManualAddOn > 0 ? `Manual add-on score: +${safeManualAddOn}` : null,
    `TOTAL MOPO RISK RATING: ${totalScore}`,
    `Required action: ${action.title}`,
    action.detail,
    notes ? "" : null,
    notes ? "Notes:" : null,
    notes ? notes : null,
  ].filter((item): item is string => Boolean(item));

  const summaryText = summaryLines.join("\n");

  const toggleActivity = (id: string) => {
    setSelectedActivities((prev) => {
      if (prev.includes(id)) return prev.filter((item) => item !== id);
      return [...prev, id];
    });
  };

  const copySummary = async () => {
    try {
      await navigator.clipboard.writeText(summaryText);
      setSaveMessage("Assessment summary copied.");
      window.setTimeout(() => setSaveMessage(""), 2500);
    } catch {
      setSaveMessage("Clipboard copy failed.");
      window.setTimeout(() => setSaveMessage(""), 2500);
    }
  };

  const resetAll = () => {
    setSelectedActivities(["streamer_deploy_recovery"]);
    setChecks(emptyChecks);
    setAssessmentAt(formatDateTimeLocal());
    setVesselName("RV Oruç Reis");
    setOperationArea("Offshore Seismic Operations");
    setAssessor("");
    setBridgeOfficer("");
    setApprovalStatus("Draft Assessment");
    setManualAddOn(0);
    setExtraBoatCount(0);
    setNotes("");
    setSaveMessage("Assessment reset.");
    window.setTimeout(() => setSaveMessage(""), 2500);
  };

  const saveSnapshot = () => {
    const payload: StoredState = {
      selectedActivities,
      checks,
      assessmentAt,
      vesselName,
      operationArea,
      assessor,
      bridgeOfficer,
      approvalStatus,
      manualAddOn,
      extraBoatCount,
      notes,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mopo-save-${assessmentAt.replace(/[:T]/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setSaveMessage("Save file downloaded.");
    window.setTimeout(() => setSaveMessage(""), 2500);
  };

  const loadSnapshot = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as StoredState;
        setSelectedActivities(Array.isArray(parsed.selectedActivities) && parsed.selectedActivities.length ? parsed.selectedActivities : ["streamer_deploy_recovery"]);
        setChecks({ ...emptyChecks, ...(parsed.checks ?? {}) });
        setAssessmentAt(typeof parsed.assessmentAt === "string" && parsed.assessmentAt ? parsed.assessmentAt : formatDateTimeLocal());
        setVesselName(typeof parsed.vesselName === "string" && parsed.vesselName ? parsed.vesselName : "RV Oruç Reis");
        setOperationArea(typeof parsed.operationArea === "string" && parsed.operationArea ? parsed.operationArea : "Offshore Seismic Operations");
        setAssessor(typeof parsed.assessor === "string" ? parsed.assessor : "");
        setBridgeOfficer(typeof parsed.bridgeOfficer === "string" ? parsed.bridgeOfficer : "");
        setApprovalStatus(typeof parsed.approvalStatus === "string" && parsed.approvalStatus ? parsed.approvalStatus : "Draft Assessment");
        setManualAddOn(toNonNegativeNumber(parsed.manualAddOn));
        setExtraBoatCount(toNonNegativeNumber(parsed.extraBoatCount));
        setNotes(typeof parsed.notes === "string" ? parsed.notes : "");
        setSaveMessage("Save file loaded.");
      } catch {
        setSaveMessage("Invalid save file.");
      }
      window.setTimeout(() => setSaveMessage(""), 2500);
    };
    reader.readAsText(file);
    event.target.value = "";
  };

  const exportPdf = () => {
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    let y = 42;

    const writeLine = (text: string, size = 10, bold = false, spacing = 16) => {
      doc.setFont("helvetica", bold ? "bold" : "normal");
      doc.setFontSize(size);
      const lines = doc.splitTextToSize(text, 520);
      doc.text(lines, 42, y);
      y += lines.length * spacing;
      if (y > 760) {
        doc.addPage();
        y = 42;
      }
    };

    doc.setFillColor(15, 23, 42);
    doc.roundedRect(42, 28, 511, 54, 12, 12, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("TP-OTC / RV ORUÇ REIS - MOPO ASSESSMENT", 56, 60);
    doc.setFontSize(9);
    doc.text("Matrix of Permitted Operations | Decision Support Record", 56, 76);

    doc.setTextColor(15, 23, 42);
    y = 110;
    writeLine(`Vessel: ${vesselName}`, 11, true);
    writeLine(`Operation Area: ${operationArea}`);
    writeLine(`Assessment Time: ${assessmentAt}`);
    writeLine(`Next Reassessment Due: ${nextReassessmentAt}`);
    writeLine(`Approval Status: ${approvalStatus}`);
    if (assessor) writeLine(`Assessor: ${assessor}`);
    if (bridgeOfficer) writeLine(`Bridge Duty Officer: ${bridgeOfficer}`);
    writeLine(`Total MOPO Risk Rating: ${totalScore}`, 12, true);
    writeLine(`Required Action: ${action.title}`, 11, true);
    writeLine(action.detail);

    y += 8;
    writeLine("Selected Activities", 12, true);
    (perActivity.length ? perActivity : []).forEach((item) => writeLine(`• ${item.label} | Responsible: ${item.responsible} | Score: ${item.subtotal}`));

    y += 8;
    writeLine("Applied Conditions", 12, true);
    (selectedConditionLabels.length ? selectedConditionLabels : ["None"]).forEach((item) => writeLine(`• ${item}`));

    if (safeManualAddOn > 0) {
      y += 8;
      writeLine(`Manual Add-On Score: +${safeManualAddOn}`, 11, true);
    }

    if (notes) {
      y += 8;
      writeLine("Operational Notes", 12, true);
      writeLine(notes);
    }

    doc.save(`mopo-assessment-${assessmentAt.replace(/[:T]/g, "-")}.pdf`);
    setSaveMessage("PDF exported.");
    window.setTimeout(() => setSaveMessage(""), 2500);
  };

  const naturalConditions = CONDITIONS.filter((item) => item.group === "natural");
  const operationalConditions = CONDITIONS.filter((item) => item.group === "operational");

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
                <span>MOPO Control Panel</span>
              </div>
              <h1 className="mt-2 text-2xl font-bold tracking-tight md:text-3xl">Matrix of Permitted Operations</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
                Corporate decision support interface for watch-based MOPO scoring, SIMOPS review, risk visibility, operational recordkeeping, PDF export, and save / load workflow.
              </p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <div className="rounded-3xl border border-white/10 bg-white/5 px-4 py-3">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Assessment status</div>
              <div className="mt-2 flex items-center gap-2 text-sm font-semibold text-white">
                <RiskIcon level={action.icon} />
                {action.title}
              </div>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/5 px-4 py-3">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Total MOPO Risk Rating</div>
              <div className="mt-2 text-2xl font-black text-white">{totalScore}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6 md:px-8">
        <div className="mb-6 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <SectionTitle icon={<Building2 className="h-5 w-5" />} title="Corporate assessment header" subtitle="Aligned with admin-style layout and watch-change decision workflow." />
              <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold ${action.badge}`}>
                <RiskIcon level={action.icon} />
                {action.title}
              </div>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Vessel</label>
                <input value={vesselName} onChange={(e) => setVesselName(e.target.value)} className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 outline-none transition focus:border-slate-400" />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Operation Area</label>
                <input value={operationArea} onChange={(e) => setOperationArea(e.target.value)} className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 outline-none transition focus:border-slate-400" />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Assessment time</label>
                <input type="datetime-local" value={assessmentAt} onChange={(e) => setAssessmentAt(e.target.value)} className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 outline-none transition focus:border-slate-400" />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Assessor</label>
                <input value={assessor} onChange={(e) => setAssessor(e.target.value)} className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 outline-none transition focus:border-slate-400" />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Bridge Duty Officer</label>
                <input value={bridgeOfficer} onChange={(e) => setBridgeOfficer(e.target.value)} className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 outline-none transition focus:border-slate-400" />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Approval Status</label>
                <select value={approvalStatus} onChange={(e) => setApprovalStatus(e.target.value)} className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 outline-none transition focus:border-slate-400">
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
                <div className="mt-2 text-sm font-semibold text-slate-900">{nextReassessmentAt || "—"}</div>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Active activities</div>
                <div className="mt-2 text-sm font-semibold text-slate-900">{perActivity.length}</div>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Mobile-ready layout</div>
                <div className="mt-2 flex items-center gap-2 text-sm font-semibold text-slate-900"><Smartphone className="h-4 w-4" /> Responsive grid enabled</div>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <SectionTitle icon={<Shield className="h-5 w-5" />} title="Control actions" subtitle="Export, save, load, and quick controls for field use." />
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <button onClick={copySummary} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50">
                <ClipboardList className="h-4 w-4" /> Copy summary
              </button>
              <button onClick={exportPdf} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50">
                <FileText className="h-4 w-4" /> Export PDF
              </button>
              <button onClick={saveSnapshot} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50">
                <Save className="h-4 w-4" /> Save file
              </button>
              <button onClick={() => fileInputRef.current?.click()} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50">
                <Upload className="h-4 w-4" /> Load file
              </button>
              <button onClick={resetAll} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 sm:col-span-2">
                <RotateCcw className="h-4 w-4" /> Reset assessment
              </button>
            </div>
            <input ref={fileInputRef} type="file" accept="application/json" onChange={loadSnapshot} className="hidden" />
            <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-xs leading-6 text-slate-600">
              <div className="font-semibold text-slate-700">Risk logic reminder</div>
              <div className="mt-1">0–4 green, 5–6 amber, 7–8 orange, 9 rose, 10+ red / prohibited combination unless escalated.</div>
            </div>
            {saveMessage ? <div className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">{saveMessage}</div> : null}
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.12fr_0.88fr]">
          <div className="space-y-6">
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <SectionTitle icon={<ShipWheel className="h-5 w-5" />} title="Active activities / SIMOPS" subtitle="Select all activities taking place during the same watch. The total score will sum them." />
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {ACTIVITY_ROWS.map((activity) => {
                  const checked = selectedActivities.includes(activity.id);
                  return (
                    <button
                      key={activity.id}
                      type="button"
                      onClick={() => toggleActivity(activity.id)}
                      className={`rounded-2xl border p-4 text-left transition-all ${checked ? "border-slate-900 bg-slate-900 text-white shadow-sm" : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"}`}
                      aria-pressed={checked}
                    >
                      <div className="text-sm font-semibold">{activity.label}</div>
                      <div className={`mt-1 text-xs ${checked ? "text-slate-300" : "text-slate-500"}`}>Responsible Person: {activity.responsible}</div>
                      {activity.notes ? <div className={`mt-2 text-xs leading-5 ${checked ? "text-slate-300" : "text-slate-600"}`}>{activity.notes}</div> : null}
                    </button>
                  );
                })}
              </div>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Additional boats deployed</label>
                  <input type="number" min="0" value={extraBoatCount} onChange={(e) => setExtraBoatCount(toNonNegativeNumber(e.target.value))} className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 outline-none transition focus:border-slate-400" />
                  <div className="mt-1 text-xs text-slate-500">Only affects FRB / WB / Water Taxi operations underway.</div>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Manual add-on score</label>
                  <input type="number" min="0" value={manualAddOn} onChange={(e) => setManualAddOn(toNonNegativeNumber(e.target.value))} className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 outline-none transition focus:border-slate-400" />
                  <div className="mt-1 text-xs text-slate-500">Use only for a temporary activity not yet modeled in this site.</div>
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <SectionTitle icon={<Waves className="h-5 w-5" />} title="Natural limitations" subtitle="Use the next 4-hour forecast, not the current conditions only." />
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {naturalConditions.map((condition) => {
                  const disabled = Boolean(condition.requires && !checks[condition.requires]);
                  return (
                    <ConditionCard
                      key={condition.key}
                      label={condition.label}
                      score={getConditionScoreForFirstRow(condition.key, activeRows)}
                      checked={isConditionActive(condition, checks)}
                      onToggle={(next) => setChecks((prev) => ({ ...prev, [condition.key]: next }))}
                      disabled={disabled}
                      helper={disabled ? "Available only when Sea height > 3 m is selected." : "Applied across all selected activities using row-specific scores."}
                    />
                  );
                })}
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <SectionTitle icon={<AlertTriangle className="h-5 w-5" />} title="Operational limitations" subtitle="Operational constraints applied across the selected activity package." />
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {operationalConditions.map((condition) => (
                  <ConditionCard
                    key={condition.key}
                    label={condition.label}
                    score={getConditionScoreForFirstRow(condition.key, activeRows)}
                    checked={isConditionActive(condition, checks)}
                    onToggle={(next) => setChecks((prev) => ({ ...prev, [condition.key]: next }))}
                    disabled={false}
                    helper="Applied across all selected activities using row-specific scores."
                  />
                ))}
              </div>
            </section>
          </div>

          <div className="space-y-6">
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <SectionTitle icon={<ClipboardList className="h-5 w-5" />} title="Per-activity scoring" subtitle="Admin-style right panel for focused operational review." />
              <div className="mt-4 space-y-3">
                {perActivity.length ? perActivity.map((activity) => <ActivityScoreCard key={activity.id} activity={activity} checks={checks} extraBoatCount={extraBoatCount} />) : <div className="rounded-2xl border border-dashed p-4 text-sm text-slate-500">Select at least one active activity.</div>}
              </div>
              {safeManualAddOn > 0 ? <div className="mt-3 rounded-2xl bg-slate-100 p-3 text-sm text-slate-700">Manual add-on included: +{safeManualAddOn}</div> : null}
            </section>

            <section className={`rounded-3xl border bg-white p-5 shadow-sm ring-1 ${action.ring}`}>
              <SectionTitle icon={<RiskIcon level={action.icon} />} title="Total MOPO Risk Rating" subtitle="Immediate operational decision indicator with color-coded status." />
              <div className="mt-5 rounded-3xl border border-slate-200 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Total score</div>
                    <div className="mt-2 text-5xl font-black tracking-tight text-slate-950">{totalScore}</div>
                  </div>
                  <span className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold ${action.badge}`}>
                    <RiskIcon level={action.icon} />
                    {action.title}
                  </span>
                </div>
                <p className="mt-4 text-sm leading-6 text-slate-600">{action.detail}</p>
              </div>
              <div className="mt-4 grid gap-3 text-sm text-slate-700">
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">Score 0–4: No additional action required.</div>
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">Score 5–6: Conduct Risk Assessment.</div>
                <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4">Score 7–8: Review full Risk Assessment.</div>
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">Score 9: Submit MOC. Extended toolbox shall always take place.</div>
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4">Score 10+: Prohibited combination under normal circumstances unless escalated by MOC.</div>
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <SectionTitle icon={<FileText className="h-5 w-5" />} title="Reference notes" subtitle="Whenever a note is indicated on MOPO, it shall be referenced in scoring." />
              <div className="mt-4 space-y-3">
                {REFERENCE_NOTES.map((note) => (
                  <div key={note.id} className="rounded-2xl border border-slate-200 p-3 text-sm leading-6 text-slate-700">
                    <span className="font-semibold">Note {note.id}.</span> {note.text}
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <SectionTitle icon={<ClipboardList className="h-5 w-5" />} title="Operational notes" subtitle="Field comments, Master judgment, PTW interaction, extra controls, escort logic." />
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Forecast comments, Master judgment, PTW interaction, extra controls, escort logic..." className="mt-4 min-h-[180px] w-full rounded-2xl border border-slate-200 px-3 py-3 outline-none transition focus:border-slate-400" />
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <SectionTitle icon={<Download className="h-5 w-5" />} title="Assessment summary" subtitle="Ready for copy, export, or attachment to operational recordkeeping." />
              <pre className="mt-4 overflow-auto rounded-2xl bg-slate-950 p-4 text-xs leading-6 text-slate-100">{summaryText}</pre>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
