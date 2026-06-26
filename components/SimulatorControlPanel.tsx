"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";

const SCENARIO_PRESETS = [
  "Maintenance escalation",
  "Late rent negotiation",
  "New resident tour",
  "Lobby complaint",
  "Amenity dispute",
];

const ACTORS = [
  "Amal",
  "Khalid",
  "Mira",
  "Omar",
  "Noura",
  "Rashid",
  "Lina",
  "Yousef",
];

const LOCATIONS = ["lobby", "hallway", "unit", "exterior", "office"];

const ACTION_VERBS = [
  "move_to",
  "say_to",
  "emote",
  "request_repair",
  "file_complaint",
  "pay_rent",
  "skip_rent",
  "social_interaction",
  "move_in",
  "move_out",
  "idle",
  "altercate",
];

const TARGETS = [
  "Building manager",
  "Neighbor",
  "Maintenance team",
  "Prospect",
  "Landlord",
  "None",
];

const MEMORY_TAGS = [
  "rent",
  "repair",
  "noise",
  "move-in",
  "relationship",
  "safety",
  "roi",
];

type EventStage = "proposed" | "adjudicated" | "applied" | "rejected";
type PanelPage = "setup" | "action" | "memory" | "monitor";

type SimEvent = {
  id: number;
  tick: number;
  stage: EventStage;
  actor: string;
  action: string;
  location: string;
  target: string;
  text: string;
};

type Metrics = {
  satisfaction: number;
  reputation: number;
  occupancy: number;
  maintenancePressure: number;
  incidentSeverity: number;
  placeholderRoi: number;
};

const PANEL_PAGES: Array<{
  id: PanelPage;
  label: string;
  helper: string;
}> = [
  { id: "setup", label: "Setup", helper: "Scenario" },
  { id: "action", label: "Action", helper: "Input" },
  { id: "memory", label: "Memory", helper: "Context" },
  { id: "monitor", label: "Monitor", helper: "Output" },
];

const INITIAL_METRICS: Metrics = {
  satisfaction: 72,
  reputation: 68,
  occupancy: 84,
  maintenancePressure: 31,
  incidentSeverity: 18,
  placeholderRoi: 62,
};

const RECENCY_OPTIONS = ["last 5 events", "last 10 events", "last 25 events"];

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function titleCase(value: string) {
  return value.replace(/_/g, " ");
}

function stageClasses(stage: EventStage) {
  if (stage === "applied") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (stage === "rejected") return "border-rose-200 bg-rose-50 text-rose-800";
  if (stage === "adjudicated") return "border-sky-200 bg-sky-50 text-sky-800";
  return "border-amber-200 bg-amber-50 text-amber-800";
}

function metricTone(value: number, inverse = false) {
  const normalized = inverse ? 100 - value : value;
  if (normalized >= 70) return "bg-[#2f8f6b]";
  if (normalized >= 45) return "bg-[#c98218]";
  return "bg-[#c44949]";
}

function FieldLabel({ htmlFor, children }: { htmlFor: string; children: string }) {
  return (
    <label
      htmlFor={htmlFor}
      className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#66736e]"
    >
      {children}
    </label>
  );
}

function SelectField({
  id,
  label,
  value,
  onChange,
  children,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <div>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1.5 h-9 w-full rounded-md border border-[#d8d1c3] bg-white px-3 text-sm text-[#192321] shadow-sm outline-none transition focus:border-[#4a8b7a] focus:ring-2 focus:ring-[#4a8b7a]/15"
      >
        {children}
      </select>
    </div>
  );
}

function NumberField({
  id,
  label,
  value,
  min,
  max,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <input
        id={id}
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-1.5 h-9 w-full rounded-md border border-[#d8d1c3] bg-white px-3 text-sm tabular-nums text-[#192321] shadow-sm outline-none transition focus:border-[#4a8b7a] focus:ring-2 focus:ring-[#4a8b7a]/15"
      />
    </div>
  );
}

function TextField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1.5 h-9 w-full rounded-md border border-[#d8d1c3] bg-white px-3 text-sm text-[#192321] shadow-sm outline-none transition focus:border-[#4a8b7a] focus:ring-2 focus:ring-[#4a8b7a]/15"
      />
    </div>
  );
}

function MetricBar({
  label,
  value,
  inverse,
}: {
  label: string;
  value: number;
  inverse?: boolean;
}) {
  return (
    <div className="rounded-lg border border-[#ded7c9] bg-white p-3">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="font-medium text-[#4f5b56]">{label}</span>
        <span className="tabular-nums text-[#6b756f]">{Math.round(value)}</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#ece5d8]">
        <div
          className={`h-full rounded-full ${metricTone(value, inverse)}`}
          style={{ width: `${clamp(value)}%` }}
        />
      </div>
    </div>
  );
}

function ToggleButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md border px-3 py-2 text-left text-xs font-semibold transition ${
        active
          ? "border-[#2f6f5d] bg-[#edf4f1] text-[#245849]"
          : "border-[#ded7c9] bg-white text-[#5f6c66] hover:border-[#bfb6a6]"
      }`}
    >
      {children}
    </button>
  );
}

function StatusChip({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "good" | "warn";
}) {
  const toneClass =
    tone === "good"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : tone === "warn"
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : "border-[#ded7c9] bg-white text-[#5f6c66]";

  return (
    <div className={`rounded-lg border px-3 py-2 ${toneClass}`}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-75">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}

export default function SimulatorControlPanel() {
  const [page, setPage] = useState<PanelPage>("setup");
  const [scenario, setScenario] = useState(SCENARIO_PRESETS[0]);
  const [buildingName, setBuildingName] = useState("Al Reem Residence");
  const [castSize, setCastSize] = useState(8);
  const [seed, setSeed] = useState(42);
  const [provider, setProvider] = useState("mock");
  const [landlordInput, setLandlordInput] = useState(
    "Keep residents calm while checking if maintenance pressure is hurting ROI."
  );
  const [actor, setActor] = useState(ACTORS[0]);
  const [location, setLocation] = useState(LOCATIONS[0]);
  const [action, setAction] = useState("request_repair");
  const [target, setTarget] = useState(TARGETS[2]);
  const [actorFilter, setActorFilter] = useState("All actors");
  const [locationFilter, setLocationFilter] = useState("All locations");
  const [selectedTags, setSelectedTags] = useState<string[]>(["repair", "roi"]);
  const [importance, setImportance] = useState(3);
  const [recency, setRecency] = useState("last 10 events");
  const [reflectionMin, setReflectionMin] = useState(5);
  const [reflectionMax, setReflectionMax] = useState(10);
  const [streamEvents, setStreamEvents] = useState(true);
  const [showContext, setShowContext] = useState(true);
  const [paused, setPaused] = useState(false);
  const [tick, setTick] = useState(0);
  const [metrics, setMetrics] = useState<Metrics>(INITIAL_METRICS);
  const [events, setEvents] = useState<SimEvent[]>([]);

  const activeActors = useMemo(
    () => ACTORS.slice(0, Math.round(clamp(castSize, 1, ACTORS.length))),
    [castSize]
  );

  useEffect(() => {
    if (!activeActors.includes(actor)) {
      setActor(activeActors[0] ?? ACTORS[0]);
    }
    if (actorFilter !== "All actors" && !activeActors.includes(actorFilter)) {
      setActorFilter("All actors");
    }
  }, [activeActors, actor, actorFilter]);

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      const actorMatch = actorFilter === "All actors" || event.actor === actorFilter;
      const locationMatch =
        locationFilter === "All locations" || event.location === locationFilter;
      return actorMatch && locationMatch;
    });
  }, [actorFilter, events, locationFilter]);

  const contextPreview = useMemo(
    () => [
      `Scenario: ${scenario}`,
      `Building: ${buildingName}`,
      `Scope: ${actorFilter}, ${locationFilter}`,
      `Tags: ${selectedTags.join(", ") || "none"}`,
      `Reflection: after ${reflectionMin}-${reflectionMax} meaningful events`,
    ],
    [
      actorFilter,
      buildingName,
      locationFilter,
      reflectionMax,
      reflectionMin,
      scenario,
      selectedTags,
    ]
  );

  function nextEventId(offset = 0) {
    return Date.now() + offset;
  }

  function updateMetrics(outcome: EventStage, verb: string) {
    setMetrics((current) => {
      const repairRelief = verb === "request_repair" ? -4 : 0;
      const rentRelief = verb === "pay_rent" ? 2 : 0;
      const incidentLift = verb === "altercate" ? 12 : 0;
      const rejectedPenalty = outcome === "rejected" ? 4 : 0;

      return {
        satisfaction: clamp(
          current.satisfaction + (outcome === "applied" ? 2 : -2) - incidentLift / 4
        ),
        reputation: clamp(current.reputation + (outcome === "applied" ? 1 : -2)),
        occupancy: clamp(current.occupancy + rentRelief - (verb === "move_out" ? 3 : 0)),
        maintenancePressure: clamp(
          current.maintenancePressure + rejectedPenalty + incidentLift + repairRelief
        ),
        incidentSeverity: clamp(current.incidentSeverity + incidentLift - 1),
        placeholderRoi: clamp(
          current.placeholderRoi +
            (outcome === "applied" ? 1 : -1) +
            rentRelief -
            incidentLift / 6
        ),
      };
    });
  }

  function appendProposal(customAction?: string) {
    const nextTick = tick + 1;
    const chosenAction = customAction ?? action;
    const outcome: EventStage =
      chosenAction === "altercate" || chosenAction === "skip_rent"
        ? "rejected"
        : nextTick % 3 === 0
          ? "adjudicated"
          : "applied";

    const rows: SimEvent[] = [
      {
        id: nextEventId(),
        tick: nextTick,
        stage: "proposed",
        actor,
        action: chosenAction,
        location,
        target,
        text: `${actor} proposes ${titleCase(chosenAction)} in ${location}.`,
      },
      {
        id: nextEventId(1),
        tick: nextTick,
        stage: outcome,
        actor,
        action: chosenAction,
        location,
        target,
        text:
          outcome === "rejected"
            ? "Mock adjudicator rejects the proposal for now."
            : "Mock adjudicator accepts the proposal into the scenario state.",
      },
    ];

    setEvents((current) => [...rows, ...current].slice(0, 12));
    setTick(nextTick);
    updateMetrics(outcome, chosenAction);
    setPage("monitor");
  }

  function runMockTick() {
    if (paused) return;

    const index = (tick + seed) % activeActors.length;
    const actionIndex = (tick + seed) % ACTION_VERBS.length;
    const locationIndex = (tick + seed) % LOCATIONS.length;

    setActor(activeActors[index] ?? ACTORS[0]);
    setAction(ACTION_VERBS[actionIndex]);
    setLocation(LOCATIONS[locationIndex]);
    appendProposal(ACTION_VERBS[actionIndex]);
  }

  function resetScenario() {
    setTick(0);
    setEvents([]);
    setMetrics(INITIAL_METRICS);
    setPaused(false);
    setPage("setup");
  }

  function toggleTag(tag: string) {
    setSelectedTags((current) =>
      current.includes(tag)
        ? current.filter((item) => item !== tag)
        : [...current, tag]
    );
  }

  const latestEvents = filteredEvents.slice(0, 4);

  return (
    <section
      id="simulator"
      className="rounded-xl border border-[#d9d2c4] bg-[#fbfaf6] p-4 shadow-[0_18px_50px_rgba(45,38,24,0.08)] lg:flex lg:min-h-0 lg:flex-1 lg:flex-col lg:overflow-hidden"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6e7d76]">
            Mock simulator controls
          </p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-[#17201f]">
            Multi-agent scenario panel
          </h2>
        </div>
        <div className="rounded-full border border-[#d8d1c3] bg-white px-3 py-1 text-xs font-semibold text-[#5f6c66]">
          Tick {tick}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {PANEL_PAGES.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setPage(item.id)}
            className={`rounded-lg border px-3 py-2 text-left transition ${
              page === item.id
                ? "border-[#2f6f5d] bg-[#edf4f1] text-[#245849]"
                : "border-[#ded7c9] bg-white text-[#5f6c66] hover:border-[#bfb6a6]"
            }`}
          >
            <span className="block text-sm font-semibold">{item.label}</span>
            <span className="mt-0.5 block text-[10px] uppercase tracking-[0.12em] opacity-75">
              {item.helper}
            </span>
          </button>
        ))}
      </div>

      <div className="mt-4 rounded-lg border border-[#ded7c9] bg-[#fdfbf7] p-4 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:overscroll-contain">
        {page === "setup" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <SelectField
              id="scenario-preset"
              label="Scenario preset"
              value={scenario}
              onChange={setScenario}
            >
              {SCENARIO_PRESETS.map((preset) => (
                <option key={preset} value={preset}>
                  {preset}
                </option>
              ))}
            </SelectField>
            <TextField
              id="building-name"
              label="Building or profile name"
              value={buildingName}
              onChange={setBuildingName}
            />
            <NumberField
              id="cast-size"
              label="Active cast size"
              min={1}
              max={ACTORS.length}
              value={castSize}
              onChange={setCastSize}
            />
            <NumberField
              id="seed"
              label="Deterministic seed"
              value={seed}
              onChange={setSeed}
            />
            <SelectField
              id="provider"
              label="Mode or provider"
              value={provider}
              onChange={setProvider}
            >
              <option value="mock">Mock local simulator</option>
              <option value="langgraph" disabled>
                LangGraph harness - unavailable
              </option>
              <option value="phaser" disabled>
                Phaser runtime - unavailable
              </option>
              <option value="api" disabled>
                API provider - unavailable
              </option>
            </SelectField>
            <div className="rounded-lg border border-[#d8d1c3] bg-white p-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#66736e]">
                Current mode
              </p>
              <p className="mt-2 text-sm font-semibold text-[#17201f]">
                {provider === "mock" ? "Mock enabled" : "Unavailable provider"}
              </p>
              <p className="mt-1 text-xs leading-5 text-[#718078]">
                The real harness can attach here later without changing the panel.
              </p>
            </div>
          </div>
        )}

        {page === "action" && (
          <div className="space-y-3">
            <div>
              <FieldLabel htmlFor="landlord-instruction">Landlord instruction</FieldLabel>
              <textarea
                id="landlord-instruction"
                rows={2}
                value={landlordInput}
                onChange={(event) => setLandlordInput(event.target.value)}
                className="mt-1.5 w-full resize-none rounded-md border border-[#d8d1c3] bg-white px-3 py-2 text-sm leading-5 text-[#192321] shadow-sm outline-none transition focus:border-[#4a8b7a] focus:ring-2 focus:ring-[#4a8b7a]/15"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <SelectField id="actor" label="Actor" value={actor} onChange={setActor}>
                {activeActors.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </SelectField>
              <SelectField
                id="location"
                label="Location"
                value={location}
                onChange={setLocation}
              >
                {LOCATIONS.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </SelectField>
              <SelectField id="action" label="Action verb" value={action} onChange={setAction}>
                {ACTION_VERBS.map((verb) => (
                  <option key={verb} value={verb}>
                    {verb}
                  </option>
                ))}
              </SelectField>
              <SelectField id="target" label="Target" value={target} onChange={setTarget}>
                {TARGETS.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </SelectField>
            </div>

            <div className="grid gap-2 sm:grid-cols-4">
              <button
                type="button"
                onClick={() => appendProposal()}
                className="rounded-md bg-[#214e43] px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#183d34]"
              >
                Submit proposal
              </button>
              <button
                type="button"
                onClick={runMockTick}
                disabled={paused}
                className="rounded-md border border-[#d8d1c3] bg-white px-3 py-2 text-sm font-semibold text-[#26312e] transition hover:border-[#bfb6a6] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Run mock tick
              </button>
              <button
                type="button"
                onClick={() => setPaused((value) => !value)}
                className="rounded-md border border-[#d8d1c3] bg-white px-3 py-2 text-sm font-semibold text-[#26312e] transition hover:border-[#bfb6a6]"
              >
                {paused ? "Resume" : "Pause"}
              </button>
              <button
                type="button"
                onClick={resetScenario}
                className="rounded-md border border-[#d8d1c3] bg-white px-3 py-2 text-sm font-semibold text-[#26312e] transition hover:border-[#bfb6a6]"
              >
                Reset
              </button>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <ToggleButton active={streamEvents} onClick={() => setStreamEvents((v) => !v)}>
                Stream chat and story events
              </ToggleButton>
              <ToggleButton active={showContext} onClick={() => setShowContext((v) => !v)}>
                Scoped context preview
              </ToggleButton>
            </div>
          </div>
        )}

        {page === "memory" && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <SelectField
                id="actor-filter"
                label="Actor filter"
                value={actorFilter}
                onChange={setActorFilter}
              >
                <option value="All actors">All actors</option>
                {activeActors.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </SelectField>
              <SelectField
                id="location-filter"
                label="Location filter"
                value={locationFilter}
                onChange={setLocationFilter}
              >
                <option value="All locations">All locations</option>
                {LOCATIONS.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </SelectField>
              <SelectField id="recency" label="Recency" value={recency} onChange={setRecency}>
                {RECENCY_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </SelectField>
              <div>
                <FieldLabel htmlFor="importance">Importance threshold</FieldLabel>
                <input
                  id="importance"
                  type="range"
                  min={1}
                  max={10}
                  value={importance}
                  onChange={(event) => setImportance(Number(event.target.value))}
                  className="mt-3 w-full accent-[#2f6f5d]"
                />
                <div className="mt-1 text-xs text-[#718078]">
                  Minimum importance: {importance}
                </div>
              </div>
              <NumberField
                id="reflection-min"
                label="Reflection minimum"
                min={1}
                max={20}
                value={reflectionMin}
                onChange={setReflectionMin}
              />
              <NumberField
                id="reflection-max"
                label="Reflection maximum"
                min={1}
                max={20}
                value={reflectionMax}
                onChange={setReflectionMax}
              />
            </div>

            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#66736e]">
                Memory tags
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {MEMORY_TAGS.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                      selectedTags.includes(tag)
                        ? "border-[#2f6f5d] bg-[#edf4f1] text-[#245849]"
                        : "border-[#ded7c9] bg-white text-[#5f6c66] hover:border-[#bfb6a6]"
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {page === "monitor" && (
          <div className="space-y-4">
            <div className="grid gap-2 sm:grid-cols-3">
              <StatusChip label="Harness" value="Waiting" tone="warn" />
              <StatusChip label="Provider" value="Mock only" tone="good" />
              <StatusChip label="Errors" value="None" />
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <MetricBar label="Satisfaction" value={metrics.satisfaction} />
              <MetricBar label="Reputation" value={metrics.reputation} />
              <MetricBar label="Occupancy" value={metrics.occupancy} />
              <MetricBar
                label="Maintenance pressure"
                value={metrics.maintenancePressure}
                inverse
              />
              <MetricBar
                label="Incident severity"
                value={metrics.incidentSeverity}
                inverse
              />
              <MetricBar label="Placeholder ROI" value={metrics.placeholderRoi} />
            </div>

            {showContext && (
              <div className="rounded-lg border border-[#ded7c9] bg-white p-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#66736e]">
                  Scoped context bundle
                </p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {contextPreview.map((item) => (
                    <p
                      key={item}
                      className="rounded-md bg-[#f6f1e8] px-2.5 py-2 text-xs leading-5 text-[#4f5b56]"
                    >
                      {item}
                    </p>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-lg border border-[#ded7c9] bg-white p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#66736e]">
                  Event log
                </p>
                <span className="text-xs text-[#718078]">
                  Showing {latestEvents.length} of {filteredEvents.length}
                </span>
              </div>

              {latestEvents.length > 0 ? (
                <div className="mt-2 grid gap-2">
                  {latestEvents.map((event) => (
                    <div
                      key={event.id}
                      className="grid gap-2 rounded-md border border-[#eee7dc] bg-[#fdfbf7] p-2 text-xs sm:grid-cols-[96px_1fr]"
                    >
                      <span
                        className={`w-fit rounded-full border px-2 py-1 font-semibold ${stageClasses(
                          event.stage
                        )}`}
                      >
                        {event.stage}
                      </span>
                      <div>
                        <p className="font-semibold text-[#24312d]">{event.text}</p>
                        <p className="mt-1 text-[#718078]">
                          Tick {event.tick} - {event.actor} - {event.location} -{" "}
                          {event.target}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-2 rounded-md border border-dashed border-[#d8d1c3] bg-[#f8f4ec] px-3 py-4 text-sm text-[#718078]">
                  No mock events yet. Submit a proposal or run a tick to populate the log.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
