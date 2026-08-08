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
type BanPhase = "initial" | "followup";
type HeroRole = "Tank" | "Damage" | "Support";
type Winner = Side | "none";
type Picker = Side | "none";
type BackgroundMode = "background" | "transparent";
type MapStatus = "upcoming" | "picked" | "played" | "decider" | "banned";
const playerRoles = ["Tank", "DPS", "Support"] as const;
type PlayerRole = (typeof playerRoles)[number];

type LogoAdjust = {
  scale: number;
  offsetX: number;
  offsetY: number;
};

type HeroAdjust = {
  scale: number;
  offsetX: number;
  offsetY: number;
};

type Team = {
  name: string;
  seed: string;
  score: number;
  logoUrl: string;
  logoAdjust: LogoAdjust;
  color: string;
  roster: Player[];
};

type Player = {
  name: string;
  role: PlayerRole;
  favoriteHero: string;
  imageUrl: string;
};

type MapPick = {
  name: string;
  mode: string;
  imageUrl: string;
  status: MapStatus;
  picker: Picker;
  winner: Winner;
  accentEnabled: boolean;
};

type BanPick = {
  heroName: string;
  heroImageUrl: string;
  team: Side;
  heroAdjust: HeroAdjust;
};

type MapBanSet = Record<BanPhase, BanPick>;

type HeroPreset = {
  name: string;
  fileName: string;
  imageUrl: string;
};

type MapPoolEntry = {
  name: string;
  fileName: string;
};

type MapOption = MapPoolEntry & {
  mode: string;
  imageUrl: string;
};

type BanState = {
  selectedMapIndex: number;
  mapBans: MapBanSet[];
  initial?: BanPick[];
  followup?: BanPick[];
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
  sharedSync: SharedSyncStatus;
};

type SyncRole = "control" | "overlay";
type SharedSyncStatus = "checking" | "connected" | "local";

const STORAGE_KEY = "nobori-broadcast-control-v1";
const CHANNEL_NAME = "nobori-broadcast-control";
const STATE_API_PATH = "/api/state";
const OVERLAY_POLL_INTERVAL_MS = 1000;
const LEGACY_BACKGROUND = "/assets/nobori-kv-placeholder.png";
const PLACEHOLDER_BACKGROUND = "/assets/nobori-stream-background.png";
const NOBORI_MARK = "/assets/nobori-symbol.png";
const MAX_MAPS = 7;
const PLAYERS_PER_TEAM = 5;
const BANS_PER_MAP = MAX_MAPS;
const banPhases: BanPhase[] = ["initial", "followup"];
const UNSELECTED_MAP_LABEL = "未選択";
const TEAM_LOGO_DIR = "/assets/team-logos";
const HERO_IMAGE_DIR = "/assets/heroes";
const MAP_IMAGE_DIR = "/assets/maps";
const DEFAULT_LOGO_ADJUST: LogoAdjust = {
  scale: 1,
  offsetX: 0,
  offsetY: 0,
};
const DEFAULT_HERO_ADJUST: HeroAdjust = {
  scale: 1,
  offsetX: 0,
  offsetY: 0,
};

const teamLogoFiles = [
  "RAViX.png",
  "Konamono_Gaming.png",
  "OZE.png",
  "VARREL_YOUTH.png",
  "AERIX.png",
  "Telomere_AC.png",
  "U.M.A_Seekers.png",
  "Foram.png",
  "RageStar.png",
  "BlessUnion.png",
  "Team_24.png",
  "AIMCORE.png",
  "Platinum_Stuck.png",
  "AnaFururuGaming.png",
  "Killer-Bee.png",
  "腹2.png",
] as const;

const n1TeamLogoFiles = [
  "VARREL_YOUTH.png",
  "Telomere_AC.png",
  "AnaFururuGaming.png",
  "腹2.png",
  "Konamono_Gaming.png",
  "OZE.png",
  "RAViX.png",
  "U.M.A_Seekers.png",
] as const;

const n1TeamLogoFileSet = new Set<string>(n1TeamLogoFiles);

function makeTeamLogoPreset(fileName: string) {
  return {
    fileName,
    name: teamNameFromLogoFile(fileName),
    logoUrl: `${TEAM_LOGO_DIR}/${fileName}`,
  };
}

const teamLogoGroups = [
  {
    label: "N1",
    presets: n1TeamLogoFiles.map(makeTeamLogoPreset),
  },
  {
    label: "N2",
    presets: teamLogoFiles
      .filter((fileName) => !n1TeamLogoFileSet.has(fileName))
      .map(makeTeamLogoPreset),
  },
];

const teamLogoPresets = teamLogoGroups.flatMap((group) => group.presets);

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
};

const heroRoleForPlayerRole: Record<PlayerRole, HeroRole> = {
  Tank: "Tank",
  DPS: "Damage",
  Support: "Support",
};

const banPhaseLabels: Record<BanPhase, string> = {
  initial: "INITIAL BAN",
  followup: "FOLLOW-UP BAN",
};

const heroRoleLabels: Record<HeroRole, string> = {
  Tank: "TANK",
  Damage: "DPS",
  Support: "SUPPORT",
};

const heroRoleGroups: { role: HeroRole; heroes: Omit<HeroPreset, "imageUrl">[] }[] = [
  {
    role: "Tank",
    heroes: [
      { name: "D.Va", fileName: "dva_png.png" },
      { name: "Domina", fileName: "domina_png.png" },
      { name: "Doomfist", fileName: "doomfist_png.png" },
      { name: "Hazard", fileName: "hazard_png.png" },
      { name: "Junker Queen", fileName: "junker-queen_png.png" },
      { name: "Mauga", fileName: "mauga_png.png" },
      { name: "Orisa", fileName: "orisa_png.png" },
      { name: "Ramattra", fileName: "ramattra_png.png" },
      { name: "Reinhardt", fileName: "reinhardt_png.png" },
      { name: "Roadhog", fileName: "roadhog_png.png" },
      { name: "Sigma", fileName: "sigma_png.png" },
      { name: "Winston", fileName: "winston_png.png" },
      { name: "Wrecking Ball", fileName: "wrecking-ball_png.png" },
      { name: "Zarya", fileName: "zarya_png.png" },
    ],
  },
  {
    role: "Damage",
    heroes: [
      { name: "Shion", fileName: "shion_png.png" },
      { name: "Anran", fileName: "anran_png.png" },
      { name: "Ashe", fileName: "ashe_png.png" },
      { name: "Bastion", fileName: "bastion_png.png" },
      { name: "Cassidy", fileName: "cassidy_png.png" },
      { name: "Echo", fileName: "echo_png.png" },
      { name: "Emre", fileName: "emre_png.png" },
      { name: "Freja", fileName: "freja_png.png" },
      { name: "Genji", fileName: "genji_png.png" },
      { name: "Hanzo", fileName: "hanzo_png.png" },
      { name: "Junkrat", fileName: "junkrat_png.png" },
      { name: "Mei", fileName: "mei_png.png" },
      { name: "Pharah", fileName: "pharah_png.png" },
      { name: "Reaper", fileName: "reaper_png.png" },
      { name: "Sierra", fileName: "sierra_png.png" },
      { name: "Sojourn", fileName: "sojourn_png.png" },
      { name: "Soldier: 76", fileName: "soldier-76_png.png" },
      { name: "Sombra", fileName: "sombra_png.png" },
      { name: "Symmetra", fileName: "symmetra_png.png" },
      { name: "Torbjorn", fileName: "torbjorn_png.png" },
      { name: "Tracer", fileName: "tracer_png.png" },
      { name: "Vendetta", fileName: "vendetta_png.png" },
      { name: "Venture", fileName: "venture_png.png" },
      { name: "Widowmaker", fileName: "widowmaker_png.png" },
    ],
  },
  {
    role: "Support",
    heroes: [
      { name: "Ana", fileName: "ana_png.png" },
      { name: "Baptiste", fileName: "baptiste_png.png" },
      { name: "Brigitte", fileName: "brigitte_png.png" },
      { name: "Illari", fileName: "illari_png.png" },
      { name: "Jetpack Cat", fileName: "jetpack-cat_png.png" },
      { name: "Juno", fileName: "juno_png.png" },
      { name: "Kiriko", fileName: "kiriko_png.png" },
      { name: "Lifeweaver", fileName: "lifeweaver_png.png" },
      { name: "Lucio", fileName: "lucio_png.png" },
      { name: "Mercy", fileName: "mercy_png.png" },
      { name: "Mizuki", fileName: "mizuki_png.png" },
      { name: "Moira", fileName: "moira_png.png" },
      { name: "Wuyang", fileName: "wuyang_png.png" },
      { name: "Zenyatta", fileName: "zenyatta_png.png" },
    ],
  },
];

const heroGroups = heroRoleGroups.map((group) => ({
  ...group,
  label: heroRoleLabels[group.role],
  heroes: group.heroes.map((hero) => ({
    ...hero,
    imageUrl: `${HERO_IMAGE_DIR}/${hero.fileName}`,
  })),
}));

const heroPresets = heroGroups.flatMap((group) => group.heroes);

function normalizeHeroName(name: string) {
  return name
    .trim()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleUpperCase("en-US");
}

function findHeroPreset(heroName: string) {
  const normalized = normalizeHeroName(heroName);

  return heroPresets.find((hero) => normalizeHeroName(hero.name) === normalized);
}

function findHeroPresetByImageUrl(imageUrl: string) {
  const normalized = imageUrl.trim();

  return heroPresets.find(
    (hero) => hero.imageUrl === normalized || hero.fileName === normalized,
  );
}

function heroBelongsToRoles(hero: HeroPreset, roles: readonly HeroRole[]) {
  return heroGroups
    .filter((group) => roles.includes(group.role))
    .some((group) =>
      group.heroes.some((groupHero) => groupHero.fileName === hero.fileName),
    );
}

function heroImageForName(heroName: string) {
  return findHeroPreset(heroName)?.imageUrl ?? "";
}

function heroCropClass(heroName: string, imageUrl = "") {
  const hero = findHeroPreset(heroName) ?? findHeroPresetByImageUrl(imageUrl);

  return hero?.name === "Wrecking Ball" ? "hero-crop-full" : "hero-crop-upper";
}

const mapPool: { mode: string; maps: MapPoolEntry[] }[] = [
  {
    mode: "Control",
    maps: [
      { name: "Antarctic Peninsula", fileName: "antarctic-peninsula.png" },
      { name: "Busan", fileName: "busan.png" },
      { name: "Ilios", fileName: "ilios.png" },
      { name: "Lijiang Tower", fileName: "lijiang-tower.png" },
      { name: "Nepal", fileName: "nepal.png" },
      { name: "Oasis", fileName: "oasis.png" },
      { name: "Samoa", fileName: "samoa.png" },
    ],
  },
  {
    mode: "Escort",
    maps: [
      { name: "Circuit Royal", fileName: "circuit-royal.png" },
      { name: "Dorado", fileName: "dorado.png" },
      { name: "Havana", fileName: "havana.png" },
      { name: "Junkertown", fileName: "junkertown.png" },
      { name: "Rialto", fileName: "rialto.png" },
      { name: "Route 66", fileName: "route-66.png" },
      { name: "Shambali Monastery", fileName: "shambali-monastery.png" },
      { name: "Watchpoint: Gibraltar", fileName: "watchpoint-gibraltar.png" },
    ],
  },
  {
    mode: "Flashpoint",
    maps: [
      { name: "New Junk City", fileName: "new-junk-city.png" },
      { name: "Suravasa", fileName: "suravasa.png" },
      { name: "Aatlis", fileName: "aatlis.png" },
    ],
  },
  {
    mode: "Hybrid",
    maps: [
      { name: "Blizzard World", fileName: "blizzard-world.png" },
      { name: "Eichenwalde", fileName: "eichenwalde.png" },
      { name: "Hollywood", fileName: "hollywood.png" },
      { name: "King's Row", fileName: "kings-row.png" },
      { name: "Midtown", fileName: "midtown.png" },
      { name: "Neon Junction", fileName: "neon-junction.png" },
      { name: "Numbani", fileName: "numbani.png" },
      { name: "Paraíso", fileName: "paraiso.png" },
    ],
  },
  {
    mode: "Push",
    maps: [
      { name: "Colosseo", fileName: "colosseo.png" },
      { name: "Esperança", fileName: "esperanca.png" },
      { name: "New Queen Street", fileName: "new-queen-street.png" },
      { name: "Runasapi", fileName: "runasapi.png" },
    ],
  },
];

const mapOptions: MapOption[] = mapPool.flatMap(({ mode, maps }) =>
  maps.map((map) => ({
    ...map,
    mode,
    imageUrl: `${MAP_IMAGE_DIR}/${map.fileName}`,
  })),
);

function teamNameFromLogoFile(fileName: string) {
  return fileName.replace(/\.png$/i, "").replaceAll("_", " ");
}

function mapSlotLabel(index: number) {
  const number = index + 1;
  const suffix =
    number === 1 ? "st" : number === 2 ? "nd" : number === 3 ? "rd" : "th";

  return `${number}${suffix}`;
}

function normalizeMapName(name: string | undefined) {
  return name
    ?.trim()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleUpperCase("en-US");
}

function getMapOption(name: string | undefined) {
  const normalizedName = normalizeMapName(name);

  return mapOptions.find(
    (option) => normalizeMapName(option.name) === normalizedName,
  );
}

function mapImageForName(name: string | undefined) {
  return getMapOption(name)?.imageUrl ?? "";
}

function isMapSelected(map: Pick<MapPick, "name">) {
  return Boolean(getMapOption(map.name));
}

function mapDisplayName(map: Pick<MapPick, "name">, index: number) {
  return isMapSelected(map) ? map.name : mapSlotLabel(index);
}

function mapEditorTitle(map: Pick<MapPick, "name">) {
  return isMapSelected(map) ? map.name : UNSELECTED_MAP_LABEL;
}

const sideLabels: Record<Side, string> = {
  left: "LEFT TEAM",
  right: "RIGHT TEAM",
};

const defaultRosterLeft: Player[] = [
  { name: "AKARI", role: "Tank", favoriteHero: "", imageUrl: "" },
  { name: "RAY", role: "DPS", favoriteHero: "", imageUrl: "" },
  { name: "MIZU", role: "DPS", favoriteHero: "", imageUrl: "" },
  { name: "YUKI", role: "Support", favoriteHero: "", imageUrl: "" },
  { name: "NOVA", role: "Support", favoriteHero: "", imageUrl: "" },
];

const defaultRosterRight: Player[] = [
  { name: "SORA", role: "Tank", favoriteHero: "", imageUrl: "" },
  { name: "ZEN", role: "DPS", favoriteHero: "", imageUrl: "" },
  { name: "LUNA", role: "DPS", favoriteHero: "", imageUrl: "" },
  { name: "HAL", role: "Support", favoriteHero: "", imageUrl: "" },
  { name: "RIO", role: "Support", favoriteHero: "", imageUrl: "" },
];

const defaultMaps: MapPick[] = [
  {
    name: "Lijiang Tower",
    mode: "Control",
    imageUrl: mapImageForName("Lijiang Tower"),
    status: "picked",
    picker: "left",
    winner: "left",
    accentEnabled: true,
  },
  {
    name: "King's Row",
    mode: "Hybrid",
    imageUrl: mapImageForName("King's Row"),
    status: "picked",
    picker: "right",
    winner: "none",
    accentEnabled: true,
  },
  {
    name: "",
    mode: "",
    imageUrl: "",
    status: "upcoming",
    picker: "none",
    winner: "none",
    accentEnabled: false,
  },
  {
    name: "",
    mode: "",
    imageUrl: "",
    status: "upcoming",
    picker: "none",
    winner: "none",
    accentEnabled: false,
  },
  {
    name: "",
    mode: "",
    imageUrl: "",
    status: "upcoming",
    picker: "none",
    winner: "none",
    accentEnabled: false,
  },
  {
    name: "",
    mode: "",
    imageUrl: "",
    status: "upcoming",
    picker: "none",
    winner: "none",
    accentEnabled: false,
  },
  {
    name: "",
    mode: "",
    imageUrl: "",
    status: "upcoming",
    picker: "none",
    winner: "none",
    accentEnabled: false,
  },
];

function oppositeSide(side: Side): Side {
  return side === "left" ? "right" : "left";
}

function makeBanPick(team: Side, heroName = "", heroImageUrl = ""): BanPick {
  return {
    heroName,
    heroImageUrl: heroImageUrl || heroImageForName(heroName),
    team,
    heroAdjust: { ...DEFAULT_HERO_ADJUST },
  };
}

function makeMapBanSet(
  initialTeam: Side = "left",
  initialHeroName = "",
  followupHeroName = "",
): MapBanSet {
  return {
    initial: makeBanPick(initialTeam, initialHeroName),
    followup: makeBanPick(oppositeSide(initialTeam), followupHeroName),
  };
}

const defaultMapBans: MapBanSet[] = [
  makeMapBanSet("left", "Ana", "Tracer"),
  makeMapBanSet("right", "Lucio", "Mauga"),
  makeMapBanSet(),
  makeMapBanSet(),
  makeMapBanSet(),
  makeMapBanSet(),
  makeMapBanSet(),
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
      logoAdjust: DEFAULT_LOGO_ADJUST,
      color: "#17bdc1",
      roster: defaultRosterLeft,
    },
    right: {
      name: "TEAM CREST",
      seed: "SEED 2",
      score: 0,
      logoUrl: "",
      logoAdjust: DEFAULT_LOGO_ADJUST,
      color: "#c01679",
      roster: defaultRosterRight,
    },
  },
  maps: defaultMaps,
  bans: {
    selectedMapIndex: 1,
    mapBans: defaultMapBans,
  },
};

function cloneDefaultState(): NoboriState {
  return JSON.parse(JSON.stringify(defaultState)) as NoboriState;
}

function isPlayerRole(role: unknown): role is PlayerRole {
  return playerRoles.includes(role as PlayerRole);
}

function normalizeRoster(roster: Partial<Player>[] | undefined, fallback: Player[]) {
  return Array.from({ length: PLAYERS_PER_TEAM }, (_, index) => {
    const fallbackPlayer = fallback[index];
    const inputPlayer = roster?.[index] ?? {};
    const inputImageUrl =
      typeof inputPlayer.imageUrl === "string"
        ? inputPlayer.imageUrl
        : fallbackPlayer.imageUrl;
    const imageHero = findHeroPresetByImageUrl(inputImageUrl);
    const favoriteHero =
      typeof inputPlayer.favoriteHero === "string"
        ? inputPlayer.favoriteHero
        : imageHero?.name ?? fallbackPlayer.favoriteHero;

    return {
      ...fallbackPlayer,
      ...inputPlayer,
      role: isPlayerRole(inputPlayer.role) ? inputPlayer.role : fallbackPlayer.role,
      favoriteHero,
      imageUrl: inputImageUrl || heroImageForName(favoriteHero),
    };
  }) as Player[];
}

function normalizeMaps(maps: Partial<MapPick>[] | undefined) {
  return Array.from({ length: MAX_MAPS }, (_, index) => {
    const inputMap = maps?.[index] ?? {};
    const explicitUnselected =
      typeof inputMap.name === "string" && inputMap.name.trim() === "";
    const selectedMap =
      explicitUnselected
        ? undefined
        : getMapOption(inputMap.name) ?? getMapOption(defaultMaps[index].name);
    const selected = Boolean(selectedMap);
    const accentEnabled =
      selected && typeof inputMap.accentEnabled === "boolean"
        ? inputMap.accentEnabled
        : selected && defaultMaps[index].accentEnabled;
    const imageUrl =
      selected && typeof inputMap.imageUrl === "string" && inputMap.imageUrl.trim()
        ? inputMap.imageUrl
        : selectedMap?.imageUrl ?? "";

    return {
      ...defaultMaps[index],
      ...inputMap,
      accentEnabled,
      name: selectedMap?.name ?? "",
      mode: selectedMap?.mode ?? "",
      imageUrl,
      ...(selected
        ? {}
        : {
            imageUrl: "",
            status: "upcoming" as MapStatus,
            picker: "none" as Picker,
            winner: "none" as Winner,
          }),
    };
  }) as MapPick[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object");
}

function hasBanContent(input: unknown) {
  if (!isRecord(input)) return false;

  return (
    (typeof input.heroName === "string" && input.heroName.trim() !== "") ||
    (typeof input.heroImageUrl === "string" && input.heroImageUrl.trim() !== "")
  );
}

function normalizeBanPick(
  input: unknown,
  fallback: BanPick,
  forcedTeam?: Side,
): BanPick {
  const value = isRecord(input) ? (input as Partial<BanPick>) : {};
  const team =
    forcedTeam ??
    (value.team === "right" || value.team === "left" ? value.team : fallback.team);
  const heroName =
    typeof value.heroName === "string" ? value.heroName : fallback.heroName;
  const inputImageUrl =
    typeof value.heroImageUrl === "string" ? value.heroImageUrl : "";

  return {
    heroName,
    heroImageUrl: inputImageUrl || heroImageForName(heroName) || fallback.heroImageUrl,
    team,
    heroAdjust: normalizeHeroAdjust(value.heroAdjust ?? fallback.heroAdjust),
  };
}

function normalizePhaseBanPick(
  input: unknown,
  fallback: BanPick,
  forcedTeam?: Side,
) {
  if (isRecord(input) && ("left" in input || "right" in input)) {
    const preferredSide = forcedTeam ?? fallback.team;
    const fallbackSide = oppositeSide(preferredSide);
    const preferredPick = input[preferredSide];
    const fallbackPick = input[fallbackSide];
    const selectedSide = hasBanContent(preferredPick)
      ? preferredSide
      : hasBanContent(fallbackPick)
        ? fallbackSide
        : preferredSide;
    const selectedInput = input[selectedSide];

    return normalizeBanPick(selectedInput, fallback, forcedTeam ?? selectedSide);
  }

  return normalizeBanPick(input, fallback, forcedTeam);
}

function normalizeMapBanSet(input: unknown, fallback: MapBanSet): MapBanSet {
  const value = isRecord(input) ? input : {};
  const initial = normalizePhaseBanPick(value.initial, fallback.initial);
  const followupTeam = oppositeSide(initial.team);

  return {
    initial,
    followup: normalizePhaseBanPick(
      value.followup,
      { ...fallback.followup, team: followupTeam },
      followupTeam,
    ),
  };
}

function applyLegacyBanPick(
  mapBanSet: MapBanSet,
  phase: BanPhase,
  input: unknown,
) {
  if (!input || typeof input !== "object") return mapBanSet;

  const legacyPick = input as Partial<BanPick>;
  const side: Side = legacyPick.team === "right" ? "right" : "left";

  return {
    ...mapBanSet,
    [phase]: normalizeBanPick(legacyPick, mapBanSet[phase], side),
  };
}

function normalizeMapBans(input?: Partial<BanState>) {
  const source = Array.isArray(input?.mapBans) ? input.mapBans : [];

  return Array.from({ length: BANS_PER_MAP }, (_, index) => {
    const fallbackSet = defaultMapBans[index];
    const inputSet = source[index] as unknown;
    const looksLikeMapBanSet =
      inputSet &&
      typeof inputSet === "object" &&
      ("initial" in inputSet || "followup" in inputSet);

    if (looksLikeMapBanSet) {
      return normalizeMapBanSet(inputSet, fallbackSet);
    }

    const withLegacyMapBan = applyLegacyBanPick(
      normalizeMapBanSet(undefined, fallbackSet),
      "initial",
      inputSet,
    );
    const withLegacyInitial = applyLegacyBanPick(
      withLegacyMapBan,
      "initial",
      input?.initial?.[index],
    );
    const withLegacyFollowup = applyLegacyBanPick(
      withLegacyInitial,
      "followup",
      input?.followup?.[index],
    );

    return {
      initial: withLegacyInitial.initial,
      followup: {
        ...withLegacyFollowup.followup,
        team: oppositeSide(withLegacyInitial.initial.team),
      },
    };
  }) as MapBanSet[];
}

function safeRangeNumber(value: unknown, fallback: number, min: number, max: number) {
  const parsed = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(parsed)) return fallback;

  return Math.min(max, Math.max(min, parsed));
}

function normalizeLogoAdjust(input?: Partial<LogoAdjust>): LogoAdjust {
  return {
    scale: safeRangeNumber(input?.scale, DEFAULT_LOGO_ADJUST.scale, 0.4, 2.5),
    offsetX: safeRangeNumber(input?.offsetX, DEFAULT_LOGO_ADJUST.offsetX, -50, 50),
    offsetY: safeRangeNumber(input?.offsetY, DEFAULT_LOGO_ADJUST.offsetY, -50, 50),
  };
}

function normalizeHeroAdjust(input?: Partial<HeroAdjust>): HeroAdjust {
  return {
    scale: safeRangeNumber(input?.scale, DEFAULT_HERO_ADJUST.scale, 0.45, 2.5),
    offsetX: safeRangeNumber(input?.offsetX, DEFAULT_HERO_ADJUST.offsetX, -80, 80),
    offsetY: safeRangeNumber(input?.offsetY, DEFAULT_HERO_ADJUST.offsetY, -100, 100),
  };
}

function normalizeState(input?: Partial<NoboriState>): NoboriState {
  const base = cloneDefaultState();
  const next = { ...base, ...(input ?? {}) };
  const inputTeams = input?.teams;

  if (!next.backgroundUrl || next.backgroundUrl === LEGACY_BACKGROUND) {
    next.backgroundUrl = PLACEHOLDER_BACKGROUND;
  }

  next.teams = {
    left: {
      ...base.teams.left,
      ...(inputTeams?.left ?? {}),
      logoAdjust: normalizeLogoAdjust(inputTeams?.left?.logoAdjust),
      roster: normalizeRoster(inputTeams?.left?.roster, defaultRosterLeft),
    },
    right: {
      ...base.teams.right,
      ...(inputTeams?.right ?? {}),
      logoAdjust: normalizeLogoAdjust(inputTeams?.right?.logoAdjust),
      roster: normalizeRoster(inputTeams?.right?.roster, defaultRosterRight),
    },
  };

  next.maps = normalizeMaps(input?.maps);
  next.bans = {
    selectedMapIndex: Math.min(
      MAX_MAPS - 1,
      Math.max(0, input?.bans?.selectedMapIndex ?? base.bans.selectedMapIndex),
    ),
    mapBans: normalizeMapBans(input?.bans),
  };

  return next as NoboriState;
}

function serializeState(state: NoboriState) {
  return JSON.stringify(normalizeState(state));
}

function currentRoom() {
  try {
    return new URLSearchParams(window.location.search).get("room") || "main";
  } catch {
    return "main";
  }
}

function stateApiUrl(room: string) {
  const params = new URLSearchParams({ room });
  return `${STATE_API_PATH}?${params.toString()}`;
}

async function fetchSharedState(room: string, signal?: AbortSignal) {
  const response = await fetch(stateApiUrl(room), {
    cache: "no-store",
    signal,
  });

  if (!response.ok) {
    throw new Error(`State sync failed: ${response.status}`);
  }

  return (await response.json()) as {
    configured: boolean;
    state: unknown | null;
  };
}

async function publishSharedState(room: string, state: NoboriState) {
  const response = await fetch(stateApiUrl(room), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ state: normalizeState(state) }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`State publish failed: ${response.status}`);
  }

  return (await response.json()) as { configured: boolean; ok?: boolean };
}

function useNoboriState({ role = "control" }: { role?: SyncRole } = {}): StateBundle {
  const [state, setInternalState] = useState<NoboriState>(() =>
    cloneDefaultState(),
  );
  const [ready, setReady] = useState(false);
  const [sharedSync, setSharedSync] = useState<SharedSyncStatus>("checking");
  const channelRef = useRef<BroadcastChannel | null>(null);
  const lastSerializedRef = useRef("");
  const sourceId = useId();
  const roomRef = useRef("main");

  const applyIncomingState = useCallback((incoming: unknown) => {
    const normalized = normalizeState(incoming as Partial<NoboriState>);
    const serialized = serializeState(normalized);

    if (serialized === lastSerializedRef.current) return;

    lastSerializedRef.current = serialized;
    setInternalState(normalized);
  }, []);

  useEffect(() => {
    const abortController = new AbortController();
    let hydratedState = cloneDefaultState();

    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        hydratedState = normalizeState(JSON.parse(stored));
        applyIncomingState(hydratedState);
      }
    } catch {
      const reset = cloneDefaultState();
      hydratedState = reset;
      lastSerializedRef.current = serializeState(reset);
      setInternalState(reset);
    } finally {
      setReady(true);
    }

    roomRef.current = currentRoom();

    if (role === "control") {
      fetchSharedState(roomRef.current, abortController.signal)
        .then((payload) => {
          setSharedSync(payload.configured ? "connected" : "local");
          if (payload.state) {
            applyIncomingState(payload.state);
            return;
          }

          if (payload.configured) {
            void publishSharedState(roomRef.current, hydratedState);
          }
        })
        .catch(() => setSharedSync("local"));
    }

    const nextChannel =
      "BroadcastChannel" in window
        ? new BroadcastChannel(CHANNEL_NAME)
        : null;
    channelRef.current = nextChannel;

    if (nextChannel) {
      nextChannel.onmessage = (event: MessageEvent) => {
        if (event.data?.source === sourceId) return;
        if (event.data?.type === "state") {
          applyIncomingState(event.data.state);
        }
        if (event.data?.type === "reset") {
          const reset = cloneDefaultState();
          lastSerializedRef.current = serializeState(reset);
          setInternalState(reset);
        }
      };
    }

    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY || !event.newValue) return;
      try {
        applyIncomingState(JSON.parse(event.newValue));
      } catch {
        const reset = cloneDefaultState();
        lastSerializedRef.current = serializeState(reset);
        setInternalState(reset);
      }
    };

    window.addEventListener("storage", onStorage);

    return () => {
      abortController.abort();
      nextChannel?.close();
      channelRef.current = null;
      window.removeEventListener("storage", onStorage);
    };
  }, [applyIncomingState, role, sourceId]);

  useEffect(() => {
    if (role !== "overlay") return;

    const abortController = new AbortController();
    let active = true;

    const pollSharedState = async () => {
      try {
        const payload = await fetchSharedState(
          roomRef.current,
          abortController.signal,
        );
        if (!active) return;
        setSharedSync(payload.configured ? "connected" : "local");
        if (payload.state) {
          applyIncomingState(payload.state);
        }
      } catch {
        if (active) setSharedSync("local");
      }
    };

    void pollSharedState();
    const timer = window.setInterval(
      pollSharedState,
      OVERLAY_POLL_INTERVAL_MS,
    );

    return () => {
      active = false;
      abortController.abort();
      window.clearInterval(timer);
    };
  }, [applyIncomingState, role]);

  useEffect(() => {
    if (!ready) return;
    if (role === "control" && sharedSync === "checking") return;

    const normalized = normalizeState(state);
    const serialized = serializeState(normalized);

    if (serialized === lastSerializedRef.current) return;

    lastSerializedRef.current = serialized;

    try {
      window.localStorage.setItem(STORAGE_KEY, serialized);
    } catch {
      // OBSや一部ブラウザ環境で保存が拒否されても画面操作は止めない。
    }

    channelRef.current?.postMessage({
      type: "state",
      source: sourceId,
      state: normalized,
    });

    if (role === "control") {
      const publishTimer = window.setTimeout(() => {
        publishSharedState(roomRef.current, normalized)
          .then((payload) => {
            setSharedSync(payload.configured ? "connected" : "local");
          })
          .catch(() => setSharedSync("local"));
      }, 250);

      return () => window.clearTimeout(publishTimer);
    }
  }, [ready, role, sharedSync, sourceId, state]);

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
    const serialized = serializeState(reset);

    lastSerializedRef.current = serialized;
    setInternalState(reset);

    try {
      window.localStorage.setItem(STORAGE_KEY, serialized);
    } catch {
      // 保存できない環境でもリセット表示自体は反映する。
    }

    channelRef.current?.postMessage({
      type: "reset",
      source: sourceId,
    });
    if (role === "control") {
      publishSharedState(roomRef.current, reset)
        .then((payload) => {
          setSharedSync(payload.configured ? "connected" : "local");
        })
        .catch(() => setSharedSync("local"));
    }
  }, [role, sourceId]);

  return { state, setState, resetState, ready, sharedSync };
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

function logoAdjustStyle(adjust: LogoAdjust): CSSProperties {
  return {
    "--logo-scale": adjust.scale,
    "--logo-offset-x": `${adjust.offsetX}%`,
    "--logo-offset-y": `${adjust.offsetY}%`,
  } as CSSProperties;
}

function heroAdjustStyle(adjust: HeroAdjust): CSSProperties {
  return {
    "--hero-scale": adjust.scale,
    "--hero-offset-x": `${adjust.offsetX}%`,
    "--hero-offset-y": `${adjust.offsetY}%`,
  } as CSSProperties;
}

function IconImage({
  src,
  label,
  className = "",
  logoAdjust,
}: {
  src: string;
  label: string;
  className?: string;
  logoAdjust?: LogoAdjust;
}) {
  const style = logoAdjust ? logoAdjustStyle(logoAdjust) : undefined;

  if (src.trim()) {
    return (
      <span className={`image-shell ${className}`} style={style}>
        <img src={src} alt="" />
      </span>
    );
  }

  return (
    <span className={`image-shell image-fallback ${className}`} style={style}>
      {initials(label)}
    </span>
  );
}

function HeroSelect({
  value,
  ariaLabel,
  placeholder = "未選択",
  allowedRoles,
  onChange,
}: {
  value: string;
  ariaLabel: string;
  placeholder?: string;
  allowedRoles?: readonly HeroRole[];
  onChange: (hero: HeroPreset | null) => void;
}) {
  const selectedHero = findHeroPreset(value) ?? findHeroPresetByImageUrl(value);
  const visibleGroups = allowedRoles?.length
    ? heroGroups.filter((group) => allowedRoles.includes(group.role))
    : heroGroups;
  const visibleHero = selectedHero
    ? heroBelongsToRoles(selectedHero, visibleGroups.map((group) => group.role))
      ? selectedHero
      : undefined
    : undefined;

  return (
    <select
      aria-label={ariaLabel}
      value={visibleHero?.name ?? ""}
      onChange={(event) => {
        const hero = findHeroPreset(event.target.value);
        onChange(hero ?? null);
      }}
    >
      <option value="">{placeholder}</option>
      {visibleGroups.map((group) => (
        <optgroup key={group.role} label={group.label}>
          {group.heroes.map((hero) => (
            <option key={hero.fileName} value={hero.name}>
              {hero.name}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

function AdminPage() {
  const { state, setState, resetState, ready, sharedSync } = useNoboriState({
    role: "control",
  });
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

  const updateTeamLogoAdjust = (side: Side, patch: Partial<LogoAdjust>) => {
    setState((previous) => ({
      ...previous,
      teams: {
        ...previous.teams,
        [side]: {
          ...previous.teams[side],
          logoAdjust: normalizeLogoAdjust({
            ...previous.teams[side].logoAdjust,
            ...patch,
          }),
        },
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

  const updateMapBan = (
    index: number,
    phase: BanPhase,
    patch: Partial<BanPick>,
  ) => {
    setState((previous) => ({
      ...previous,
      bans: {
        ...previous.bans,
        mapBans: previous.bans.mapBans.map((mapBanSet, pickIndex) => {
          if (pickIndex !== index) return mapBanSet;

          return {
            ...mapBanSet,
            [phase]: {
              ...mapBanSet[phase],
              ...patch,
            },
          };
        }),
      },
    }));
  };

  const updateBanHeroAdjust = (
    index: number,
    phase: BanPhase,
    patch: Partial<HeroAdjust>,
  ) => {
    setState((previous) => ({
      ...previous,
      bans: {
        ...previous.bans,
        mapBans: previous.bans.mapBans.map((mapBanSet, pickIndex) => {
          if (pickIndex !== index) return mapBanSet;

          return {
            ...mapBanSet,
            [phase]: {
              ...mapBanSet[phase],
              heroAdjust: normalizeHeroAdjust({
                ...mapBanSet[phase].heroAdjust,
                ...patch,
              }),
            },
          };
        }),
      },
    }));
  };

  const updateInitialBanTeam = (index: number, initialTeam: Side) => {
    setState((previous) => ({
      ...previous,
      bans: {
        ...previous.bans,
        mapBans: previous.bans.mapBans.map((mapBanSet, pickIndex) => {
          if (pickIndex !== index) return mapBanSet;

          return {
            initial: { ...mapBanSet.initial, team: initialTeam },
            followup: {
              ...mapBanSet.followup,
              team: oppositeSide(initialTeam),
            },
          };
        }),
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
        <div className="sync-status" data-ready={ready && sharedSync !== "local"}>
          <span />
          {ready
            ? sharedSync === "connected"
              ? "OBS共有同期中"
              : "このブラウザ内のみ"
            : "同期準備中"}
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
                    placeholder="/assets/nobori-stream-background.png"
                  />
                </Field>
              </Section>

              <Section title="チーム情報" eyebrow="TEAMS">
                <div className="team-edit-grid">
                  {(["left", "right"] as Side[]).map((side) => {
                    const selectedTeamPreset =
                      teamLogoPresets.find(
                        (preset) =>
                          preset.logoUrl === state.teams[side].logoUrl,
                      )?.logoUrl ?? "";

                    return (
                      <div className="team-editor" key={side}>
                        <div className="team-editor-head">
                          <IconImage
                            src={state.teams[side].logoUrl}
                            label={state.teams[side].name}
                            logoAdjust={state.teams[side].logoAdjust}
                          />
                          <strong>{sideLabels[side]}</strong>
                        </div>
                        <Field label="登録チーム">
                          <select
                            value={selectedTeamPreset}
                            onChange={(event) => {
                              const preset = teamLogoPresets.find(
                                (teamPreset) =>
                                  teamPreset.logoUrl === event.target.value,
                              );

                              if (!preset) {
                                return;
                              }

                              updateTeam(side, {
                                name: preset.name,
                                logoUrl: preset.logoUrl,
                                logoAdjust: DEFAULT_LOGO_ADJUST,
                              });
                            }}
                          >
                            <option value="">手入力</option>
                            {teamLogoGroups.map((group) => (
                              <optgroup key={group.label} label={group.label}>
                                {group.presets.map((preset) => (
                                  <option key={preset.logoUrl} value={preset.logoUrl}>
                                    {preset.name}
                                  </option>
                                ))}
                              </optgroup>
                            ))}
                          </select>
                        </Field>
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
                        <div className="logo-adjust-panel">
                          <div className="logo-adjust-head">
                            <span>ロゴ調整</span>
                            <button
                              type="button"
                              onClick={() =>
                                updateTeam(side, {
                                  logoAdjust: DEFAULT_LOGO_ADJUST,
                                })
                              }
                            >
                              リセット
                            </button>
                          </div>
                          <Field
                            label={`倍率 ${Math.round(
                              state.teams[side].logoAdjust.scale * 100,
                            )}%`}
                          >
                            <input
                              type="range"
                              min="0.5"
                              max="2.2"
                              step="0.01"
                              value={state.teams[side].logoAdjust.scale}
                              onChange={(event) =>
                                updateTeamLogoAdjust(side, {
                                  scale: Number(event.target.value),
                                })
                              }
                            />
                          </Field>
                          <div className="form-grid two">
                            <Field
                              label={`横位置 ${state.teams[side].logoAdjust.offsetX}`}
                            >
                              <input
                                type="range"
                                min="-50"
                                max="50"
                                step="1"
                                value={state.teams[side].logoAdjust.offsetX}
                                onChange={(event) =>
                                  updateTeamLogoAdjust(side, {
                                    offsetX: Number(event.target.value),
                                  })
                                }
                              />
                            </Field>
                            <Field
                              label={`縦位置 ${state.teams[side].logoAdjust.offsetY}`}
                            >
                              <input
                                type="range"
                                min="-50"
                                max="50"
                                step="1"
                                value={state.teams[side].logoAdjust.offsetY}
                                onChange={(event) =>
                                  updateTeamLogoAdjust(side, {
                                    offsetY: Number(event.target.value),
                                  })
                                }
                              />
                            </Field>
                          </div>
                        </div>
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
                    );
                  })}
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
                    <div
                      className={`map-editor ${
                        isMapSelected(map) ? "" : "is-unselected"
                      }`}
                      key={`map-${index}`}
                    >
                      <div className="slot-heading">
                        <span>MAP {index + 1}</span>
                        <label className="map-accent-toggle">
                          <input
                            type="checkbox"
                            checked={map.accentEnabled}
                            disabled={!isMapSelected(map)}
                            onChange={(event) =>
                              updateMap(index, {
                                accentEnabled: event.target.checked,
                              })
                            }
                          />
                          色枠
                        </label>
                        <strong>{mapEditorTitle(map)}</strong>
                      </div>
                      <div className="form-grid two">
                        <Field label="マップ名">
                          <select
                            value={getMapOption(map.name)?.name ?? ""}
                            onChange={(event) => {
                              if (!event.target.value) {
                                updateMap(index, {
                                  name: "",
                                  mode: "",
                                  imageUrl: "",
                                  status: "upcoming",
                                  picker: "none",
                                  winner: "none",
                                  accentEnabled: false,
                                });
                                return;
                              }

                              const selectedMap = mapOptions.find(
                                (option) => option.name === event.target.value,
                              );

                              if (!selectedMap) return;

                              updateMap(index, {
                                name: selectedMap.name,
                                mode: selectedMap.mode,
                                imageUrl: selectedMap.imageUrl,
                              });
                            }}
                          >
                            <option value="">{UNSELECTED_MAP_LABEL}</option>
                            {mapPool.map(({ mode, maps }) => (
                              <optgroup key={mode} label={mode}>
                                {maps.map((map) => (
                                  <option key={map.name} value={map.name}>
                                    {map.name}
                                  </option>
                                ))}
                              </optgroup>
                            ))}
                          </select>
                        </Field>
                        <Field label="モード">
                          <input
                            value={map.mode}
                            readOnly
                            placeholder={UNSELECTED_MAP_LABEL}
                          />
                        </Field>
                        <Field label="状態">
                          <select
                            value={map.status}
                            disabled={!isMapSelected(map)}
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
                            disabled={!isMapSelected(map)}
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
                            disabled={!isMapSelected(map)}
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
                            disabled={!isMapSelected(map)}
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
                            onChange={(event) => {
                              const role = event.target.value as PlayerRole;
                              const hero =
                                findHeroPreset(player.favoriteHero) ??
                                findHeroPresetByImageUrl(player.imageUrl);
                              const shouldClearHero =
                                hero &&
                                !heroBelongsToRoles(hero, [heroRoleForPlayerRole[role]]);

                              updateRoster(side, index, {
                                role,
                                ...(shouldClearHero
                                  ? { favoriteHero: "", imageUrl: "" }
                                  : {}),
                              });
                            }}
                          >
                            {playerRoles.map((role) => (
                              <option key={role} value={role}>
                                {roleLabels[role]}
                              </option>
                            ))}
                          </select>
                          <HeroSelect
                            aria-label={`${side} player ${index + 1} favorite hero`}
                            placeholder="ヒーロー"
                            allowedRoles={[heroRoleForPlayerRole[player.role]]}
                            value={player.favoriteHero || player.imageUrl}
                            onChange={(hero) =>
                              updateRoster(side, index, {
                                favoriteHero: hero?.name ?? "",
                                imageUrl: hero?.imageUrl ?? "",
                              })
                            }
                          />
                          <input
                            aria-label={`${side} player ${index + 1} image`}
                            value={player.imageUrl}
                            onChange={(event) => {
                              const hero = findHeroPresetByImageUrl(event.target.value);

                              updateRoster(side, index, {
                                imageUrl: event.target.value,
                                favoriteHero: hero?.name ?? "",
                              });
                            }}
                            placeholder="画像URL"
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
                      <option key={`${map.name || "unselected"}-${index}`} value={index}>
                        MAP {index + 1}: {mapDisplayName(map, index)}
                      </option>
                    ))}
                  </select>
                </Field>

                <div className="ban-editor-stage">
                  <h3>Map Ban</h3>
                  {visibleMaps.map((map, index) => {
                    const mapBanSet =
                      state.bans.mapBans[index] ?? defaultMapBans[index];

                    return (
                      <div
                        className="ban-editor map-ban-editor"
                        key={`${map.name || "unselected"}-${index}`}
                      >
                        <div className="ban-editor-head">
                          <span>MAP {index + 1}</span>
                          <strong>{mapDisplayName(map, index)}</strong>
                        </div>
                        <label className="ban-first-team">
                          <span>先行BANチーム</span>
                          <select
                            aria-label={`map ${index + 1} initial ban team`}
                            value={mapBanSet.initial.team}
                            onChange={(event) =>
                              updateInitialBanTeam(index, event.target.value as Side)
                            }
                          >
                            <option value="left">{state.teams.left.name}</option>
                            <option value="right">{state.teams.right.name}</option>
                          </select>
                        </label>
                        <div className="ban-editor-grid">
                          {banPhases.map((phase) => {
                            const pick = mapBanSet[phase];
                            const side = pick.team;

                            return (
                              <div className="ban-editor-pick" key={phase}>
                                <span>
                                  {banPhaseLabels[phase]} / {state.teams[side].name}
                                </span>
                                <HeroSelect
                                  aria-label={`map ${index + 1} ${phase} ban hero`}
                                  value={pick.heroName}
                                  onChange={(hero) =>
                                    updateMapBan(index, phase, {
                                      heroName: hero?.name ?? "",
                                      heroImageUrl: hero?.imageUrl ?? "",
                                      heroAdjust: DEFAULT_HERO_ADJUST,
                                    })
                                  }
                                />
                                <input
                                  aria-label={`map ${index + 1} ${phase} ban image`}
                                  value={pick.heroImageUrl}
                                  onChange={(event) =>
                                    updateMapBan(index, phase, {
                                      heroImageUrl: event.target.value,
                                    })
                                  }
                                  placeholder="ヒーロー画像URL"
                                />
                                <div className="logo-adjust-panel hero-adjust-panel">
                                  <div className="logo-adjust-head">
                                    <span>表示調整</span>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        updateMapBan(index, phase, {
                                          heroAdjust: DEFAULT_HERO_ADJUST,
                                        })
                                      }
                                    >
                                      リセット
                                    </button>
                                  </div>
                                  <Field
                                    label={`倍率 ${Math.round(
                                      pick.heroAdjust.scale * 100,
                                    )}%`}
                                  >
                                    <input
                                      type="range"
                                      min="0.45"
                                      max="2.5"
                                      step="0.01"
                                      value={pick.heroAdjust.scale}
                                      onChange={(event) =>
                                        updateBanHeroAdjust(index, phase, {
                                          scale: Number(event.target.value),
                                        })
                                      }
                                    />
                                  </Field>
                                  <div className="form-grid two">
                                    <Field label={`横位置 ${pick.heroAdjust.offsetX}`}>
                                      <input
                                        type="range"
                                        min="-80"
                                        max="80"
                                        step="1"
                                        value={pick.heroAdjust.offsetX}
                                        onChange={(event) =>
                                          updateBanHeroAdjust(index, phase, {
                                            offsetX: Number(event.target.value),
                                          })
                                        }
                                      />
                                    </Field>
                                    <Field label={`縦位置 ${pick.heroAdjust.offsetY}`}>
                                      <input
                                        type="range"
                                        min="-100"
                                        max="100"
                                        step="1"
                                        value={pick.heroAdjust.offsetY}
                                        onChange={(event) =>
                                          updateBanHeroAdjust(index, phase, {
                                            offsetY: Number(event.target.value),
                                          })
                                        }
                                      />
                                    </Field>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
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

function SceneHeader({
  state,
  label,
}: {
  state: NoboriState;
  label: string;
}) {
  return (
    <header className="scene-header">
      <div className="scene-heading">
        <h1>{label}</h1>
        <span>
          {state.matchTitle} / {state.roundName}
        </span>
      </div>
      <img className="scene-mark" src={NOBORI_MARK} alt="" />
    </header>
  );
}

function MapVisual({
  map,
  index,
  useParentImage = false,
}: {
  map: MapPick;
  index: number;
  useParentImage?: boolean;
}) {
  const selected = isMapSelected(map);
  const displayName = mapDisplayName(map, index);

  if (selected && map.imageUrl.trim()) {
    return (
      <div
        className="map-visual"
        style={
          useParentImage
            ? undefined
            : { backgroundImage: `url("${map.imageUrl}")` }
        }
      >
        {useParentImage ? null : <span>MAP {index + 1}</span>}
      </div>
    );
  }

  return (
    <div className={`map-visual map-fallback ${selected ? "" : "is-unselected"}`}>
      <span>MAP {index + 1}</span>
      <strong>{selected ? initials(map.name) : displayName}</strong>
    </div>
  );
}

function PlayerCard({ player }: { player: Player }) {
  return (
    <article
      className={`player-card role-${player.role.toLowerCase()} ${heroCropClass(
        player.favoriteHero,
        player.imageUrl,
      )}`}
    >
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
      <div className="nobori-panel map-panel">
        <div className="map-grid">
          {maps.map((map, index) => {
            const selected = isMapSelected(map);
            const mapImage = selected
              ? map.imageUrl.trim() || mapImageForName(map.name)
              : "";
            const winnerTeam =
              selected && map.winner !== "none" ? state.teams[map.winner] : null;

            return (
              <article
                className={`map-card ${
                  selected
                    ? `status-${map.status} winner-${map.winner} ${
                        mapImage ? "has-map-image" : ""
                      }`
                    : "is-unselected"
                }`}
                style={
                  {
                    "--map-border-color":
                      !selected || !map.accentEnabled
                        ? "rgba(150, 160, 165, 0.55)"
                        : map.picker === "none"
                        ? "var(--nobori-cyan)"
                        : teamColor(state, map.picker),
                    ...(mapImage
                      ? {
                          backgroundImage: `url("${mapImage}")`,
                        }
                      : {}),
                  } as CSSProperties
                }
                key={`${map.name || "unselected"}-${index}`}
              >
                {winnerTeam ? (
                  <div className="map-winner-badge">
                    <IconImage
                      src={winnerTeam.logoUrl}
                      label={winnerTeam.name}
                      className="map-winner-logo"
                    />
                  </div>
                ) : null}
                <MapVisual map={map} index={index} useParentImage />
                <div className="map-card-body">
                  {selected ? (
                    <>
                      <div className="map-title-block">
                        <span>{map.mode}</span>
                        <h2>{mapDisplayName(map, index)}</h2>
                      </div>
                      <div className="map-meta">
                        <em>{statusLabels[map.status]}</em>
                        <strong>{teamName(state, map.picker)}</strong>
                      </div>
                    </>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
        <div className="match-strip">
          {(["left", "right"] as Side[]).map((side) => (
            <div
              className={`match-team ${side}`}
              style={{ "--team-color": state.teams[side].color } as CSSProperties}
              key={side}
            >
              <IconImage
                src={state.teams[side].logoUrl}
                label={state.teams[side].name}
                className="match-logo"
                logoAdjust={state.teams[side].logoAdjust}
              />
              <div>
                <span>{state.teams[side].seed}</span>
                <strong>{state.teams[side].name}</strong>
              </div>
            </div>
          ))}
          <div className="match-center">
            <span>{state.roundName}</span>
            <em>
              {state.teams.left.score} - {state.teams.right.score}
            </em>
            <strong>{state.format}</strong>
          </div>
        </div>
      </div>
    </section>
  );
}

function RosterScene({ state }: { state: NoboriState }) {
  return (
    <section className="scene-content roster-scene">
      <div className="nobori-panel roster-panel">
        <div className="roster-grid">
          {(["left", "right"] as Side[]).map((side) => (
            <div
              className={`roster-team ${side}`}
              style={{ "--team-color": state.teams[side].color } as CSSProperties}
              key={side}
            >
              <div className="roster-team-head">
                <span>{state.teams[side].seed}</span>
                <div className="roster-title-row">
                  <IconImage
                    src={state.teams[side].logoUrl}
                    label={state.teams[side].name}
                    className="roster-logo"
                    logoAdjust={state.teams[side].logoAdjust}
                  />
                  <h2>{state.teams[side].name}</h2>
                  <div aria-hidden="true" />
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
      </div>
    </section>
  );
}

function BanHeroPane({
  side,
  phase,
  pick,
  map,
  state,
}: {
  side: Side;
  phase: BanPhase;
  pick: BanPick;
  map: MapPick;
  state: NoboriState;
}) {
  const team = state.teams[side];
  const heroName = pick.heroName.trim();
  const heroImage = pick.heroImageUrl.trim();
  const mapImage = map.imageUrl.trim();
  const hasBan = Boolean(heroName);
  const backgroundImage = mapImage
    ? `linear-gradient(180deg, rgba(0, 0, 0, 0.42), rgba(0, 0, 0, 0.68)), url("${mapImage}")`
    : undefined;

  return (
    <article
      className={`ban-hero-pane ${side} ${hasBan ? "has-ban" : "no-ban"}`}
      style={{ "--team-color": team.color } as CSSProperties}
    >
      <div className="ban-team-bar">
        <IconImage
          src={team.logoUrl}
          label={team.name}
          className="ban-team-logo"
          logoAdjust={team.logoAdjust}
        />
        <div>
          <strong>{team.name}</strong>
          <span>{team.seed}</span>
        </div>
        <b>{team.score}</b>
      </div>
      <div
        className="ban-hero-portrait"
        style={backgroundImage ? { backgroundImage } : undefined}
      >
        <span className="ban-phase-badge">{banPhaseLabels[phase]}</span>
        {heroImage ? (
          <img
            className={`ban-hero-fullbody ${heroCropClass(heroName, heroImage)}`}
            src={heroImage}
            alt=""
            style={heroAdjustStyle(pick.heroAdjust)}
          />
        ) : (
          <strong>{hasBan ? initials(heroName) : "NB"}</strong>
        )}
      </div>
    </article>
  );
}

function BanInfoCell({
  side,
  phase,
  pick,
  mapIndex,
  state,
}: {
  side: Side;
  phase: BanPhase;
  pick: BanPick;
  mapIndex: number;
  state: NoboriState;
}) {
  const heroName = pick.heroName.trim();

  return (
    <div className={`ban-info-cell ${side}`}>
      <span>{banPhaseLabels[phase]}</span>
      <strong>{heroName || "NB"}</strong>
      <em>{state.teams[side].name}</em>
    </div>
  );
}

function BanScene({ state }: { state: NoboriState }) {
  const visibleMaps = state.maps.slice(0, getMaxMaps(state.format));
  const selectedMapIndex = Math.min(
    visibleMaps.length - 1,
    Math.max(0, state.bans.selectedMapIndex),
  );
  const selectedMap =
    visibleMaps[selectedMapIndex] ?? visibleMaps[0] ?? defaultMaps[0];
  const selectedBans =
    state.bans.mapBans[selectedMapIndex] ?? defaultMapBans[selectedMapIndex];
  const leftBan =
    selectedBans.initial.team === "left"
      ? { phase: "initial" as BanPhase, pick: selectedBans.initial }
      : { phase: "followup" as BanPhase, pick: selectedBans.followup };
  const rightBan =
    selectedBans.initial.team === "right"
      ? { phase: "initial" as BanPhase, pick: selectedBans.initial }
      : { phase: "followup" as BanPhase, pick: selectedBans.followup };

  return (
    <section className="scene-content ban-scene">
      <div className="nobori-panel ban-panel">
        <div className="ban-layout">
          <div className="ban-visual-stage">
            <BanHeroPane
              side="left"
              phase={leftBan.phase}
              pick={leftBan.pick}
              map={selectedMap}
              state={state}
            />
            <div className="ban-map-stage">
              <span>SELECTED MAP</span>
              <MapVisual map={selectedMap} index={selectedMapIndex} />
            </div>
            <BanHeroPane
              side="right"
              phase={rightBan.phase}
              pick={rightBan.pick}
              map={selectedMap}
              state={state}
            />
          </div>
          <div className="ban-info-strip">
            <BanInfoCell
              side="left"
              phase={leftBan.phase}
              pick={leftBan.pick}
              mapIndex={selectedMapIndex}
              state={state}
            />
            <div className="ban-info-cell map">
              <span>SELECTED MAP</span>
              <strong>{mapDisplayName(selectedMap, selectedMapIndex)}</strong>
              {isMapSelected(selectedMap) ? <em>{selectedMap.mode}</em> : null}
            </div>
            <BanInfoCell
              side="right"
              phase={rightBan.phase}
              pick={rightBan.pick}
              mapIndex={selectedMapIndex}
              state={state}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function ObsScene({ view }: { view: SceneView }) {
  const { state } = useNoboriState({ role: "overlay" });
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
