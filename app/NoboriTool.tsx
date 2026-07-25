"use client";

/* eslint-disable @next/next/no-img-element */

import {
  type CSSProperties,
  type ReactNode,
  type SetStateAction,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

type SceneView = "map" | "roster" | "ban";
type Format = "FT3" | "FT4";
type Side = "left" | "right";
type Winner = Side | "none";
type Picker = Side | "none";
type BackgroundMode = "background" | "transparent";
type MapStatus = "upcoming" | "picked" | "played" | "decider" | "banned";
type PlayerRole = "Tank" | "DPS" | "Support" | "Flex";

type Team = {
  name: string;
  seed: string;
  score: number;
  logoUrl: string;
  color: string;
  roster: Player[];
};

type Player = {
  name: string;
  role: PlayerRole;
  imageUrl: string;
};

type MapPick = {
  name: string;
  mode: string;
  imageUrl: string;
  status: MapStatus;
  picker: Picker;
  winner: Winner;
};

type BanPick = {
  heroName: string;
  heroImageUrl: string;
  team: Side;
};

type BanState = {
  selectedMapIndex: number;
  initial: BanPick[];
  followup: BanPick[];
};

type NoboriState = {
  matchTitle: string;
  roundName: string;
  format: Format;
  backgroundMode: BackgroundMode;
  backgroundUrl: string;
  teams: Record<Side, Team>;
  maps: MapPick[];
  bans: BanState;
};

type StateBundle = {
  state: NoboriState;
  setState: (next: SetStateAction<NoboriState>) => void;
  resetState: () => void;
  ready: boolean;
};

const STORAGE_KEY = "nobori-broadcast-control-v1";
const CHANNEL_NAME = "nobori-broadcast-control";
const PLACEHOLDER_BACKGROUND = "/assets/nobori-kv-placeholder.png";
const MAX_MAPS = 7;
const PLAYERS_PER_TEAM = 6;
const BANS_PER_STAGE = 4;

const statusLabels: Record<MapStatus, string> = {
  upcoming: "待機",
  picked: "選択",
  played: "終了",
  decider: "決定戦",
  banned: "除外",
};

const roleLabels: Record<PlayerRole, string> = {
  Tank: "TANK",
  DPS: "DPS",
  Support: "SUPPORT",
  Flex: "FLEX",
};

const sideLabels: Record<Side, string> = {
  left: "LEFT TEAM",
  right: "RIGHT TEAM",
};

const defaultRosterLeft: Player[] = [
  { name: "AKARI", role: "Tank", imageUrl: "" },
  { name: "RAY", role: "DPS", imageUrl: "" },
  { name: "MIZU", role: "DPS", imageUrl: "" },
  { name: "YUKI", role: "Support", imageUrl: "" },
  { name: "NOVA", role: "Support", imageUrl: "" },
  { name: "KAI", role: "Flex", imageUrl: "" },
];

const defaultRosterRight: Player[] = [
  { name: "SORA", role: "Tank", imageUrl: "" },
  { name: "ZEN", role: "DPS", imageUrl: "" },
  { name: "LUNA", role: "DPS", imageUrl: "" },
  { name: "HAL", role: "Support", imageUrl: "" },
  { name: "RIO", role: "Support", imageUrl: "" },
  { name: "ACE", role: "Flex", imageUrl: "" },
];

const defaultMaps: MapPick[] = [
  {
    name: "Lijiang Tower",
    mode: "Control",
    imageUrl: "",
    status: "picked",
    picker: "left",
    winner: "left",
  },
  {
    name: "King's Row",
    mode: "Hybrid",
    imageUrl: "",
    status: "picked",
    picker: "right",
    winner: "none",
  },
  {
    name: "Watchpoint: Gibraltar",
    mode: "Escort",
    imageUrl: "",
    status: "upcoming",
    picker: "left",
    winner: "none",
  },
  {
    name: "Suravasa",
    mode: "Flashpoint",
    imageUrl: "",
    status: "upcoming",
    picker: "right",
    winner: "none",
  },
  {
    name: "Esperanca",
    mode: "Push",
    imageUrl: "",
    status: "decider",
    picker: "none",
    winner: "none",
  },
  {
    name: "Route 66",
    mode: "Escort",
    imageUrl: "",
    status: "upcoming",
    picker: "left",
    winner: "none",
  },
  {
    name: "New Junk City",
    mode: "Flashpoint",
    imageUrl: "",
    status: "upcoming",
    picker: "right",
    winner: "none",
  },
];

const defaultState: NoboriState = {
  matchTitle: "NOBORI CUP",
  roundName: "GRAND FINAL",
  format: "FT3",
  backgroundMode: "background",
  backgroundUrl: PLACEHOLDER_BACKGROUND,
  teams: {
    left: {
      name: "TEAM ASCEND",
      seed: "SEED 1",
      score: 1,
      logoUrl: "",
      color: "#00d7ff",
      roster: defaultRosterLeft,
    },
    right: {
      name: "TEAM CREST",
      seed: "SEED 2",
      score: 0,
      logoUrl: "",
      color: "#ff4fd8",
      roster: defaultRosterRight,
    },
  },
  maps: defaultMaps,
  bans: {
    selectedMapIndex: 1,
    initial: [
      { heroName: "Ana", heroImageUrl: "", team: "left" },
      { heroName: "Tracer", heroImageUrl: "", team: "right" },
      { heroName: "D.Va", heroImageUrl: "", team: "left" },
      { heroName: "Kiriko", heroImageUrl: "", team: "right" },
    ],
    followup: [
      { heroName: "Sojourn", heroImageUrl: "", team: "left" },
      { heroName: "Winston", heroImageUrl: "", team: "right" },
      { heroName: "Lucio", heroImageUrl: "", team: "left" },
      { heroName: "Mei", heroImageUrl: "", team: "right" },
    ],
  },
};

function cloneDefaultState(): NoboriState {
  return JSON.parse(JSON.stringify(defaultState)) as NoboriState;
}

function normalizeRoster(roster: Partial<Player>[] | undefined, fallback: Player[]) {
  return Array.from({ length: PLAYERS_PER_TEAM }, (_, index) => ({
    ...fallback[index],
    ...(roster?.[index] ?? {}),
  })) as Player[];
}

function normalizeMaps(maps: Partial<MapPick>[] | undefined) {
  return Array.from({ length: MAX_MAPS }, (_, index) => ({
    ...defaultMaps[index],
    ...(maps?.[index] ?? {}),
  })) as MapPick[];
}

function normalizeBans(
  picks: Partial<BanPick>[] | undefined,
  fallback: BanPick[],
) {
  return Array.from({ length: BANS_PER_STAGE }, (_, index) => ({
    ...fallback[index],
    ...(picks?.[index] ?? {}),
  })) as BanPick[];
}

function normalizeState(input?: Partial<NoboriState>): NoboriState {
  const base = cloneDefaultState();
  const next = { ...base, ...(input ?? {}) };
  const inputTeams = input?.teams;

  next.teams = {
    left: {
      ...base.teams.left,
      ...(inputTeams?.left ?? {}),
      roster: normalizeRoster(inputTeams?.left?.roster, defaultRosterLeft),
    },
    right: {
      ...base.teams.right,
      ...(inputTeams?.right ?? {}),
      roster: normalizeRoster(inputTeams?.right?.roster, defaultRosterRight),
    },
  };

  next.maps = normalizeMaps(input?.maps);
  next.bans = {
    ...base.bans,
    ...(input?.bans ?? {}),
    selectedMapIndex: Math.min(
      MAX_MAPS - 1,
      Math.max(0, input?.bans?.selectedMapIndex ?? base.bans.selectedMapIndex),
    ),
    initial: normalizeBans(input?.bans?.initial, base.bans.initial),
    followup: normalizeBans(input?.bans?.followup, base.bans.followup),
  };

  return next as NoboriState;
}

function useNoboriState(): StateBundle {
  const [state, setInternalState] = useState<NoboriState>(() =>
    cloneDefaultState(),
  );
  const [ready, setReady] = useState(false);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const sourceId = useId();

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (stored) {
          setInternalState(normalizeState(JSON.parse(stored)));
        }
      } catch {
        setInternalState(cloneDefaultState());
      } finally {
        setReady(true);
      }
    });

    const nextChannel =
      "BroadcastChannel" in window
        ? new BroadcastChannel(CHANNEL_NAME)
        : null;
    channelRef.current = nextChannel;

    if (nextChannel) {
      nextChannel.onmessage = (event: MessageEvent) => {
        if (event.data?.source === sourceId) return;
        if (event.data?.type === "state") {
          setInternalState(normalizeState(event.data.state));
        }
        if (event.data?.type === "reset") {
          setInternalState(cloneDefaultState());
        }
      };
    }

    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY || !event.newValue) return;
      try {
        setInternalState(normalizeState(JSON.parse(event.newValue)));
      } catch {
        setInternalState(cloneDefaultState());
      }
    };

    window.addEventListener("storage", onStorage);

    return () => {
      window.cancelAnimationFrame(frameId);
      nextChannel?.close();
      channelRef.current = null;
      window.removeEventListener("storage", onStorage);
    };
  }, [sourceId]);

  useEffect(() => {
    if (!ready) return;
    const normalized = normalizeState(state);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    channelRef.current?.postMessage({
      type: "state",
      source: sourceId,
      state: normalized,
    });
  }, [ready, sourceId, state]);

  const setState = useCallback((next: SetStateAction<NoboriState>) => {
    setInternalState((previous) =>
      normalizeState(
        typeof next === "function"
          ? (next as (value: NoboriState) => NoboriState)(previous)
          : next,
      ),
    );
  }, []);

  const resetState = useCallback(() => {
    const reset = cloneDefaultState();
    setInternalState(reset);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(reset));
    channelRef.current?.postMessage({
      type: "reset",
      source: sourceId,
    });
  }, [sourceId]);

  return { state, setState, resetState, ready };
}

function getMaxMaps(format: Format) {
  return format === "FT4" ? 7 : 5;
}

function initials(name: string) {
  const letters = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("");

  return (letters || "NB").toUpperCase();
}

function safeNumber(value: string) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function teamName(state: NoboriState, side: Side | "none") {
  if (side === "none") return "AUTO";
  return state.teams[side].name;
}

function teamColor(state: NoboriState, side: Side) {
  return state.teams[side].color;
}

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}

function Section({
  title,
  eyebrow,
  children,
}: {
  title: string;
  eyebrow?: string;
  children: ReactNode;
}) {
  return (
    <section className="control-section">
      <div className="section-heading">
        {eyebrow ? <span>{eyebrow}</span> : null}
        <h2>{title}</h2>
      </div>
      {children}
    </section>
  );
}

function IconImage({
  src,
  label,
  className = "",
}: {
  src: string;
  label: string;
  className?: string;
}) {
  if (src.trim()) {
    return (
      <span className={`image-shell ${className}`}>
        <img src={src} alt="" />
      </span>
    );
  }

  return (
    <span className={`image-shell image-fallback ${className}`}>
      {initials(label)}
    </span>
  );
}

function AdminPage() {
  const { state, setState, resetState, ready } = useNoboriState();
  const [adminTab, setAdminTab] = useState<"match" | "maps" | "roster" | "ban">(
    "match",
  );
  const [preview, setPreview] = useState<SceneView>("map");
  const [origin, setOrigin] = useState("http://localhost:3000");
  const visibleMapCount = getMaxMaps(state.format);
  const visibleMaps = state.maps.slice(0, visibleMapCount);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      setOrigin(window.location.origin);
    });

    return () => window.cancelAnimationFrame(frameId);
  }, []);

  const updateTeam = (side: Side, patch: Partial<Team>) => {
    setState((previous) => ({
      ...previous,
      teams: {
        ...previous.teams,
        [side]: { ...previous.teams[side], ...patch },
      },
    }));
  };

  const updateRoster = (side: Side, index: number, patch: Partial<Player>) => {
    setState((previous) => ({
      ...previous,
      teams: {
        ...previous.teams,
        [side]: {
          ...previous.teams[side],
          roster: previous.teams[side].roster.map((player, playerIndex) =>
            playerIndex === index ? { ...player, ...patch } : player,
          ),
        },
      },
    }));
  };

  const updateMap = (index: number, patch: Partial<MapPick>) => {
    setState((previous) => ({
      ...previous,
      maps: previous.maps.map((map, mapIndex) =>
        mapIndex === index ? { ...map, ...patch } : map,
      ),
    }));
  };

  const updateBan = (
    stage: "initial" | "followup",
    index: number,
    patch: Partial<BanPick>,
  ) => {
    setState((previous) => ({
      ...previous,
      bans: {
        ...previous.bans,
        [stage]: previous.bans[stage].map((pick, pickIndex) =>
          pickIndex === index ? { ...pick, ...patch } : pick,
        ),
      },
    }));
  };

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div>
          <p className="kicker">NOBORI BROADCAST CONTROL</p>
          <h1>NOBORI配信オーバーレイ</h1>
        </div>
        <div className="sync-status" data-ready={ready}>
          <span />
          {ready ? "OBSへ即時同期中" : "同期準備中"}
        </div>
      </header>

      <div className="admin-grid">
        <div className="control-panel">
          <nav className="tab-bar" aria-label="編集項目">
            {[
              ["match", "試合"],
              ["maps", "マップ"],
              ["roster", "ロスター"],
              ["ban", "BAN"],
            ].map(([value, label]) => (
              <button
                key={value}
                className={adminTab === value ? "active" : ""}
                type="button"
                onClick={() => setAdminTab(value as typeof adminTab)}
              >
                {label}
              </button>
            ))}
          </nav>

          {adminTab === "match" ? (
            <div className="control-stack">
              <Section title="試合設定" eyebrow="MATCH">
                <div className="form-grid two">
                  <Field label="大会名">
                    <input
                      value={state.matchTitle}
                      onChange={(event) =>
                        setState((previous) => ({
                          ...previous,
                          matchTitle: event.target.value,
                        }))
                      }
                    />
                  </Field>
                  <Field label="ラウンド">
                    <input
                      value={state.roundName}
                      onChange={(event) =>
                        setState((previous) => ({
                          ...previous,
                          roundName: event.target.value,
                        }))
                      }
                    />
                  </Field>
                  <Field label="形式">
                    <select
                      value={state.format}
                      onChange={(event) =>
                        setState((previous) => ({
                          ...previous,
                          format: event.target.value as Format,
                        }))
                      }
                    >
                      <option value="FT3">FT3 / 最大5MAP</option>
                      <option value="FT4">FT4 / 最大7MAP</option>
                    </select>
                  </Field>
                  <Field label="背景">
                    <select
                      value={state.backgroundMode}
                      onChange={(event) =>
                        setState((previous) => ({
                          ...previous,
                          backgroundMode: event.target.value as BackgroundMode,
                        }))
                      }
                    >
                      <option value="background">背景込み</option>
                      <option value="transparent">透過</option>
                    </select>
                  </Field>
                </div>
                <Field
                  label="背景画像URL"
                  hint="添付KVを使う場合は public/assets に置いて /assets/ファイル名 を指定してください"
                >
                  <input
                    value={state.backgroundUrl}
                    onChange={(event) =>
                      setState((previous) => ({
                        ...previous,
                        backgroundUrl: event.target.value,
                      }))
                    }
                    placeholder="/assets/nobori-kv-placeholder.png"
                  />
                </Field>
              </Section>

              <Section title="チーム情報" eyebrow="TEAMS">
                <div className="team-edit-grid">
                  {(["left", "right"] as Side[]).map((side) => (
                    <div className="team-editor" key={side}>
                      <div className="team-editor-head">
                        <IconImage
                          src={state.teams[side].logoUrl}
                          label={state.teams[side].name}
                        />
                        <strong>{sideLabels[side]}</strong>
                      </div>
                      <Field label="チーム名">
                        <input
                          value={state.teams[side].name}
                          onChange={(event) =>
                            updateTeam(side, { name: event.target.value })
                          }
                        />
                      </Field>
                      <div className="form-grid two">
                        <Field label="シード">
                          <input
                            value={state.teams[side].seed}
                            onChange={(event) =>
                              updateTeam(side, { seed: event.target.value })
                            }
                          />
                        </Field>
                        <Field label="スコア">
                          <input
                            type="number"
                            min="0"
                            value={state.teams[side].score}
                            onChange={(event) =>
                              updateTeam(side, {
                                score: safeNumber(event.target.value),
                              })
                            }
                          />
                        </Field>
                      </div>
                      <Field label="ロゴURL">
                        <input
                          value={state.teams[side].logoUrl}
                          onChange={(event) =>
                            updateTeam(side, { logoUrl: event.target.value })
                          }
                          placeholder="/assets/team-logo.png"
                        />
                      </Field>
                      <Field label="チームカラー">
                        <input
                          type="color"
                          value={state.teams[side].color}
                          onChange={(event) =>
                            updateTeam(side, { color: event.target.value })
                          }
                        />
                      </Field>
                    </div>
                  ))}
                </div>
              </Section>

              <Section title="OBS URL" eyebrow="OUTPUT">
                <div className="url-list">
                  {(["map", "roster", "ban"] as SceneView[]).map((view) => (
                    <div className="url-row" key={view}>
                      <strong>{view.toUpperCase()}</strong>
                      <input readOnly value={`${origin}/obs/${view}`} />
                      <a href={`/obs/${view}`} target="_blank" rel="noreferrer">
                        開く
                      </a>
                    </div>
                  ))}
                  <div className="url-row">
                    <strong>透過URL</strong>
                    <input readOnly value={`${origin}/obs/map?transparent=1`} />
                    <a href="/obs/map?transparent=1" target="_blank" rel="noreferrer">
                      開く
                    </a>
                  </div>
                </div>
                <button className="danger-button" type="button" onClick={resetState}>
                  初期状態に戻す
                </button>
              </Section>
            </div>
          ) : null}

          {adminTab === "maps" ? (
            <div className="control-stack">
              <Section title={`マップピック (${visibleMapCount} MAP表示)`} eyebrow="MAP PICK">
                <div className="map-editor-list">
                  {visibleMaps.map((map, index) => (
                    <div className="map-editor" key={`map-${index}`}>
                      <div className="slot-heading">
                        <span>MAP {index + 1}</span>
                        <strong>{map.name}</strong>
                      </div>
                      <div className="form-grid two">
                        <Field label="マップ名">
                          <input
                            value={map.name}
                            onChange={(event) =>
                              updateMap(index, { name: event.target.value })
                            }
                          />
                        </Field>
                        <Field label="モード">
                          <input
                            value={map.mode}
                            onChange={(event) =>
                              updateMap(index, { mode: event.target.value })
                            }
                          />
                        </Field>
                        <Field label="状態">
                          <select
                            value={map.status}
                            onChange={(event) =>
                              updateMap(index, {
                                status: event.target.value as MapStatus,
                              })
                            }
                          >
                            {Object.entries(statusLabels).map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </Field>
                        <Field label="選択チーム">
                          <select
                            value={map.picker}
                            onChange={(event) =>
                              updateMap(index, {
                                picker: event.target.value as Picker,
                              })
                            }
                          >
                            <option value="none">自動/未定</option>
                            <option value="left">{state.teams.left.name}</option>
                            <option value="right">{state.teams.right.name}</option>
                          </select>
                        </Field>
                        <Field label="勝者">
                          <select
                            value={map.winner}
                            onChange={(event) =>
                              updateMap(index, {
                                winner: event.target.value as Winner,
                              })
                            }
                          >
                            <option value="none">未定</option>
                            <option value="left">{state.teams.left.name}</option>
                            <option value="right">{state.teams.right.name}</option>
                          </select>
                        </Field>
                        <Field label="画像URL">
                          <input
                            value={map.imageUrl}
                            onChange={(event) =>
                              updateMap(index, { imageUrl: event.target.value })
                            }
                            placeholder="/assets/map-01.png"
                          />
                        </Field>
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            </div>
          ) : null}

          {adminTab === "roster" ? (
            <div className="control-stack">
              <Section title="ロスター紹介" eyebrow="ROSTER">
                <div className="roster-edit-grid">
                  {(["left", "right"] as Side[]).map((side) => (
                    <div className="roster-editor" key={side}>
                      <h3>{state.teams[side].name}</h3>
                      {state.teams[side].roster.map((player, index) => (
                        <div className="player-editor" key={`${side}-${index}`}>
                          <span>{index + 1}</span>
                          <input
                            aria-label={`${side} player ${index + 1} name`}
                            value={player.name}
                            onChange={(event) =>
                              updateRoster(side, index, {
                                name: event.target.value,
                              })
                            }
                          />
                          <select
                            aria-label={`${side} player ${index + 1} role`}
                            value={player.role}
                            onChange={(event) =>
                              updateRoster(side, index, {
                                role: event.target.value as PlayerRole,
                              })
                            }
                          >
                            {Object.keys(roleLabels).map((role) => (
                              <option key={role} value={role}>
                                {roleLabels[role as PlayerRole]}
                              </option>
                            ))}
                          </select>
                          <input
                            aria-label={`${side} player ${index + 1} image`}
                            value={player.imageUrl}
                            onChange={(event) =>
                              updateRoster(side, index, {
                                imageUrl: event.target.value,
                              })
                            }
                            placeholder="写真URL"
                          />
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </Section>
            </div>
          ) : null}

          {adminTab === "ban" ? (
            <div className="control-stack">
              <Section title="キャラクターBAN" eyebrow="HERO BAN">
                <Field label="選択マップ">
                  <select
                    value={state.bans.selectedMapIndex}
                    onChange={(event) =>
                      setState((previous) => ({
                        ...previous,
                        bans: {
                          ...previous.bans,
                          selectedMapIndex: safeNumber(event.target.value),
                        },
                      }))
                    }
                  >
                    {visibleMaps.map((map, index) => (
                      <option key={map.name + index} value={index}>
                        MAP {index + 1}: {map.name}
                      </option>
                    ))}
                  </select>
                </Field>

                {(["initial", "followup"] as const).map((stage) => (
                  <div className="ban-editor-stage" key={stage}>
                    <h3>{stage === "initial" ? "Initial Ban" : "Follow-up Ban"}</h3>
                    {state.bans[stage].map((pick, index) => (
                      <div className="ban-editor" key={`${stage}-${index}`}>
                        <span>{index + 1}</span>
                        <input
                          aria-label={`${stage} ban ${index + 1} hero`}
                          value={pick.heroName}
                          onChange={(event) =>
                            updateBan(stage, index, {
                              heroName: event.target.value,
                            })
                          }
                        />
                        <select
                          aria-label={`${stage} ban ${index + 1} team`}
                          value={pick.team}
                          onChange={(event) =>
                            updateBan(stage, index, {
                              team: event.target.value as Side,
                            })
                          }
                        >
                          <option value="left">{state.teams.left.name}</option>
                          <option value="right">{state.teams.right.name}</option>
                        </select>
                        <input
                          aria-label={`${stage} ban ${index + 1} image`}
                          value={pick.heroImageUrl}
                          onChange={(event) =>
                            updateBan(stage, index, {
                              heroImageUrl: event.target.value,
                            })
                          }
                          placeholder="ヒーロー画像URL"
                        />
                      </div>
                    ))}
                  </div>
                ))}
              </Section>
            </div>
          ) : null}
        </div>

        <aside className="preview-panel">
          <div className="preview-top">
            <div>
              <p className="kicker">LIVE PREVIEW</p>
              <h2>OBSプレビュー</h2>
            </div>
            <div className="segmented">
              {(["map", "roster", "ban"] as SceneView[]).map((view) => (
                <button
                  key={view}
                  className={preview === view ? "active" : ""}
                  type="button"
                  onClick={() => setPreview(view)}
                >
                  {view.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <div className="preview-frame">
            <iframe src={`/obs/${preview}?preview=1`} title="OBS preview" />
          </div>
          <div className="preview-note">
            OBSは 1920 x 1080 のブラウザソース想定です。透過にしたい場合は各OBS URLに
            <code>?transparent=1</code> を付けるか、背景設定を透過にしてください。
          </div>
        </aside>
      </div>
    </main>
  );
}

function SceneBackground({
  state,
  transparent,
}: {
  state: NoboriState;
  transparent: boolean;
}) {
  if (transparent) return null;

  const backgroundUrl = state.backgroundUrl.trim() || PLACEHOLDER_BACKGROUND;

  return (
    <div
      className="scene-background"
      style={{ backgroundImage: `url("${backgroundUrl}")` }}
    />
  );
}

function TeamPlate({ state, side }: { state: NoboriState; side: Side }) {
  const team = state.teams[side];
  const style = { "--team-color": team.color } as CSSProperties;

  return (
    <div className={`team-plate ${side}`} style={style}>
      <IconImage src={team.logoUrl} label={team.name} className="team-logo" />
      <div className="team-copy">
        <span>{team.seed}</span>
        <strong>{team.name}</strong>
      </div>
      <div className="team-score">{team.score}</div>
    </div>
  );
}

function SceneHeader({
  state,
  label,
}: {
  state: NoboriState;
  label: string;
}) {
  return (
    <header className="scene-header">
      <TeamPlate state={state} side="left" />
      <div className="scene-logo">
        <span>{state.roundName}</span>
        <strong>NOBORI</strong>
        <em>{label}</em>
      </div>
      <TeamPlate state={state} side="right" />
    </header>
  );
}

function MapVisual({ map, index }: { map: MapPick; index: number }) {
  if (map.imageUrl.trim()) {
    return (
      <div className="map-visual" style={{ backgroundImage: `url("${map.imageUrl}")` }}>
        <span>MAP {index + 1}</span>
      </div>
    );
  }

  return (
    <div className="map-visual map-fallback">
      <span>MAP {index + 1}</span>
      <strong>{initials(map.name)}</strong>
    </div>
  );
}

function HeroVisual({ pick }: { pick: BanPick }) {
  if (pick.heroImageUrl.trim()) {
    return (
      <div
        className="hero-visual"
        style={{ backgroundImage: `url("${pick.heroImageUrl}")` }}
      />
    );
  }

  return (
    <div className="hero-visual hero-fallback">
      <strong>{initials(pick.heroName)}</strong>
    </div>
  );
}

function PlayerCard({ player }: { player: Player }) {
  return (
    <article className={`player-card role-${player.role.toLowerCase()}`}>
      <IconImage src={player.imageUrl} label={player.name} className="player-photo" />
      <div>
        <span>{roleLabels[player.role]}</span>
        <strong>{player.name}</strong>
      </div>
    </article>
  );
}

function MapPickScene({ state }: { state: NoboriState }) {
  const maps = state.maps.slice(0, getMaxMaps(state.format));

  return (
    <section className={`scene-content map-scene maps-${maps.length}`}>
      <div className="scene-title-row">
        <div>
          <span>{state.matchTitle}</span>
          <h1>MAP PICK</h1>
        </div>
        <strong>
          {state.format} / MAX {maps.length} MAPS
        </strong>
      </div>
      <div className="map-grid">
        {maps.map((map, index) => (
          <article
            className={`map-card status-${map.status} winner-${map.winner}`}
            key={`${map.name}-${index}`}
          >
            <MapVisual map={map} index={index} />
            <div className="map-card-body">
              <span>{map.mode}</span>
              <h2>{map.name}</h2>
              <div className="map-meta">
                <em>{statusLabels[map.status]}</em>
                <strong>{teamName(state, map.picker)}</strong>
              </div>
            </div>
            {map.winner !== "none" ? (
              <div
                className="winner-ribbon"
                style={{ "--team-color": teamColor(state, map.winner) } as CSSProperties}
              >
                WINNER {state.teams[map.winner].name}
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

function RosterScene({ state }: { state: NoboriState }) {
  return (
    <section className="scene-content roster-scene">
      <div className="scene-title-row">
        <div>
          <span>{state.matchTitle}</span>
          <h1>ROSTER</h1>
        </div>
        <strong>{state.roundName}</strong>
      </div>
      <div className="roster-grid">
        {(["left", "right"] as Side[]).map((side) => (
          <div
            className={`roster-team ${side}`}
            style={{ "--team-color": state.teams[side].color } as CSSProperties}
            key={side}
          >
            <div className="roster-team-head">
              <IconImage
                src={state.teams[side].logoUrl}
                label={state.teams[side].name}
                className="roster-logo"
              />
              <div>
                <span>{state.teams[side].seed}</span>
                <h2>{state.teams[side].name}</h2>
              </div>
            </div>
            <div className="player-grid">
              {state.teams[side].roster.map((player, index) => (
                <PlayerCard key={`${side}-${player.name}-${index}`} player={player} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function BanColumn({
  title,
  picks,
  state,
}: {
  title: string;
  picks: BanPick[];
  state: NoboriState;
}) {
  return (
    <div className="ban-column">
      <h2>{title}</h2>
      <div className="ban-list">
        {picks.map((pick, index) => (
          <article
            className="ban-card"
            style={{ "--team-color": teamColor(state, pick.team) } as CSSProperties}
            key={`${title}-${pick.heroName}-${index}`}
          >
            <HeroVisual pick={pick} />
            <div>
              <span>{state.teams[pick.team].name}</span>
              <strong>{pick.heroName}</strong>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function BanScene({ state }: { state: NoboriState }) {
  const selectedMap =
    state.maps[state.bans.selectedMapIndex] ?? state.maps[0] ?? defaultMaps[0];

  return (
    <section className="scene-content ban-scene">
      <div className="scene-title-row">
        <div>
          <span>{state.matchTitle}</span>
          <h1>HERO BAN</h1>
        </div>
        <strong>{state.format}</strong>
      </div>
      <div className="ban-layout">
        <BanColumn title="INITIAL BAN" picks={state.bans.initial} state={state} />
        <div className="selected-map-panel">
          <span>SELECTED MAP</span>
          <MapVisual map={selectedMap} index={state.bans.selectedMapIndex} />
          <h2>{selectedMap.name}</h2>
          <strong>{selectedMap.mode}</strong>
        </div>
        <BanColumn title="FOLLOW-UP BAN" picks={state.bans.followup} state={state} />
      </div>
    </section>
  );
}

function ObsScene({ view }: { view: SceneView }) {
  const { state } = useNoboriState();
  const [transparentOverride, setTransparentOverride] = useState(false);
  const [viewport, setViewport] = useState({ width: 1920, height: 1080 });
  const transparent =
    transparentOverride || state.backgroundMode === "transparent";
  const scale = Math.min(viewport.width / 1920, viewport.height / 1080);

  useEffect(() => {
    const updateViewport = () => {
      setViewport({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    const frameId = window.requestAnimationFrame(() => {
      const params = new URLSearchParams(window.location.search);
      setTransparentOverride(params.get("transparent") === "1");
      updateViewport();
    });

    window.addEventListener("resize", updateViewport);
    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", updateViewport);
    };
  }, []);

  useEffect(() => {
    document.body.classList.toggle("obs-transparent", transparent);
    return () => document.body.classList.remove("obs-transparent");
  }, [transparent]);

  return (
    <main className={`obs-root ${transparent ? "is-transparent" : ""}`}>
      <div
        className="scene-canvas"
        style={{
          transform: `translate(-50%, -50%) scale(${scale})`,
        }}
      >
        <SceneBackground state={state} transparent={transparent} />
        <div className="scene-frame">
          <SceneHeader
            state={state}
            label={
              view === "map"
                ? "MAP PICK"
                : view === "roster"
                  ? "ROSTER"
                  : "HERO BAN"
            }
          />
          {view === "map" ? <MapPickScene state={state} /> : null}
          {view === "roster" ? <RosterScene state={state} /> : null}
          {view === "ban" ? <BanScene state={state} /> : null}
        </div>
      </div>
    </main>
  );
}

export { AdminPage, ObsScene };
