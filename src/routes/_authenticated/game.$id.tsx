import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Save, Share2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GameCanvas } from "@/components/GameCanvas";
import { MadeWithBadge } from "@/components/MadeWithBadge";
import { ShareModal } from "@/components/ShareModal";
import { useI18n } from "@/i18n";
import { getGame, updateGame, type GameRecord } from "@/lib/games";
import { DIFFICULTIES, THEMES } from "@/lib/engine/types";
import type { Difficulty, GameConfig, Theme } from "@/lib/engine/types";
import { track } from "@/lib/analytics";

export const Route = createFileRoute("/_authenticated/game/$id")({
  head: () => ({
    meta: [{ title: "Game Preview — GameForge AI" }],
  }),
  component: GamePreviewPage,
});

function ConfigSlider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-sm">
        <span className="font-medium text-foreground">{label}</span>
        <span className="text-muted-foreground">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step ?? 1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-primary"
      />
    </div>
  );
}

function GamePreviewPage() {
  const { t } = useI18n();
  const { id } = Route.useParams();
  const navigate = useNavigate();

  const [game, setGame] = useState<GameRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [shareOpen, setShareOpen] = useState(false);

  // Editor state (kept in sync with game config)
  const [editName, setEditName] = useState("");
  const [editConfig, setEditConfig] = useState<GameConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [liveConfig, setLiveConfig] = useState<GameConfig | null>(null);
  const [hasUnsavedEdits, setHasUnsavedEdits] = useState(false);

  useEffect(() => {
    getGame(id)
      .then((record) => {
        if (record) {
          setGame(record);
          setEditName(record.name);
          setEditConfig({ ...record.game_config });
          setLiveConfig(record.game_config);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  const applyEdit = () => {
    if (!editConfig) return;
    setLiveConfig({ ...editConfig });
    setHasUnsavedEdits(true);
    toast.success(t("editor.applied"));
  };

  const saveChanges = async () => {
    if (!game || !editConfig) return;
    const name = editName.trim();
    if (!name) {
      toast.error(t("editor.nameRequired"));
      return;
    }
    setSaving(true);
    try {
      const updated = await updateGame(game.id, { name, game_config: editConfig });
      setGame(updated);
      setLiveConfig(updated.game_config);
      setHasUnsavedEdits(false);
      toast.success(t("common.saved"));
      track("game_saved", { game_type: game.game_type });
      // Track game_edited if config actually changed from original
      if (JSON.stringify(game.game_config) !== JSON.stringify(editConfig) || game.name !== name) {
        track("game_edited", { game_type: game.game_type });
      }
    } catch {
      toast.error(t("common.error"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-sm text-muted-foreground">{t("preview.loading")}</p>
      </div>
    );
  }

  if (!game || !liveConfig || !editConfig) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
        <p className="text-sm text-muted-foreground">{t("preview.notFound")}</p>
        <Button asChild variant="outline" size="sm">
          <Link to="/games">
            <ArrowLeft className="mr-1 size-4" /> {t("preview.backToGames")}
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Topbar */}
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link to="/games">
            <ArrowLeft className="mr-1 size-4" /> {t("preview.backToGames")}
          </Link>
        </Button>
        <h1 className="flex-1 truncate text-lg font-semibold text-foreground" title={game.name}>
          {game.name}
        </h1>
        <Button variant="outline" size="sm" onClick={() => setShareOpen(true)}>
          <Share2 className="mr-1 size-4" /> {t("preview.share")}
        </Button>
      </div>

      <Tabs defaultValue="game" className="w-full">
        <TabsList>
          <TabsTrigger value="game">{t("preview.game")}</TabsTrigger>
          <TabsTrigger value="edit">{t("preview.edit")}</TabsTrigger>
          <TabsTrigger value="info">{t("preview.info")}</TabsTrigger>
        </TabsList>

        {/* ── GAME TAB ── */}
        <TabsContent value="game" className="mt-4">
          <GameCanvas config={liveConfig} />
        </TabsContent>

        {/* ── EDIT TAB ── */}
        <TabsContent value="edit" className="mt-4">
          <div className="panel space-y-6 rounded-2xl p-6">
            {/* Game name */}
            <div className="space-y-1.5">
              <Label htmlFor="edit-name">{t("editor.gameName")}</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                maxLength={60}
              />
            </div>

            {/* Difficulty */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">{t("editor.difficulty")}</p>
              <div className="flex flex-wrap gap-2">
                {DIFFICULTIES.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setEditConfig((c) => c ? { ...c, difficulty: d } : c)}
                    className={`rounded-full px-3 py-1 text-sm transition-colors ${
                      editConfig.difficulty === d
                        ? "bg-primary text-primary-foreground"
                        : "border border-border bg-card text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {t(`difficulty.${d}`)}
                  </button>
                ))}
              </div>
            </div>

            {/* Theme */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">{t("editor.theme")}</p>
              <div className="flex flex-wrap gap-2">
                {THEMES.map((th) => (
                  <button
                    key={th}
                    type="button"
                    onClick={() => setEditConfig((c) => c ? { ...c, theme: th } : c)}
                    className={`rounded-full px-3 py-1 text-sm transition-colors ${
                      editConfig.theme === th
                        ? "bg-primary text-primary-foreground"
                        : "border border-border bg-card text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {t(`themes.${th}`)}
                  </button>
                ))}
              </div>
            </div>

            {/* Numeric sliders (type-specific) */}
            {game.game_type === "coin_collector" && (
              <>
                <ConfigSlider
                  label={t("editor.coins")}
                  value={editConfig.coins}
                  min={3}
                  max={30}
                  onChange={(v) => setEditConfig((c) => c ? { ...c, coins: v } : c)}
                />
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">Collectible Type</p>
                  <div className="flex flex-wrap gap-2">
                    {["coin", "gem", "crystal"].map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setEditConfig((c) => c ? { ...c, collectibleType: type as any } : c)}
                        className={`rounded-full px-3 py-1 text-sm transition-colors ${
                          editConfig.collectibleType === type
                            ? "bg-primary text-primary-foreground"
                            : "border border-border bg-card text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">Character</p>
                  <div className="flex flex-wrap gap-2">
                    {["astronaut", "ninja", "soldier", "robot"].map((char) => (
                      <button
                        key={char}
                        type="button"
                        onClick={() => setEditConfig((c) => c ? { ...c, character: char as any } : c)}
                        className={`rounded-full px-3 py-1 text-sm transition-colors ${
                          editConfig.character === char
                            ? "bg-primary text-primary-foreground"
                            : "border border-border bg-card text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {char.charAt(0).toUpperCase() + char.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
            {game.game_type === "shooter" && (
              <>
                <ConfigSlider
                  label={t("editor.enemies")}
                  value={editConfig.enemies}
                  min={2}
                  max={20}
                  onChange={(v) => setEditConfig((c) => c ? { ...c, enemies: v } : c)}
                />
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">Weapon</p>
                  <div className="flex flex-wrap gap-2">
                    {["blaster", "pistol", "shotgun", "rifle"].map((w) => (
                      <button
                        key={w}
                        type="button"
                        onClick={() => setEditConfig((c) => c ? { ...c, weapon: w as any } : c)}
                        className={`rounded-full px-3 py-1 text-sm transition-colors ${
                          editConfig.weapon === w
                            ? "bg-primary text-primary-foreground"
                            : "border border-border bg-card text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {w.charAt(0).toUpperCase() + w.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">Enemy Type</p>
                  <div className="flex flex-wrap gap-2">
                    {["robot", "alien", "drone", "monster"].map((et) => (
                      <button
                        key={et}
                        type="button"
                        onClick={() => setEditConfig((c) => c ? { ...c, enemyType: et as any } : c)}
                        className={`rounded-full px-3 py-1 text-sm transition-colors ${
                          editConfig.enemyType === et
                            ? "bg-primary text-primary-foreground"
                            : "border border-border bg-card text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {et.charAt(0).toUpperCase() + et.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">Power-ups</p>
                  <div className="flex flex-wrap gap-2">
                    {["health", "shield", "speed", "double_score"].map((pu) => (
                      <button
                        key={pu}
                        type="button"
                        onClick={() => {
                          const current = editConfig.powerUps ?? [];
                          const updated = current.includes(pu as any)
                            ? current.filter((p) => p !== pu)
                            : [...current, pu as any];
                          setEditConfig((c) => c ? { ...c, powerUps: updated as any } : c);
                        }}
                        className={`rounded-full px-3 py-1 text-sm transition-colors ${
                          (editConfig.powerUps ?? []).includes(pu as any)
                            ? "bg-primary text-primary-foreground"
                            : "border border-border bg-card text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {pu.replace("_", " ").charAt(0).toUpperCase() + pu.replace("_", " ").slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">Boss</p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setEditConfig((c) => c ? { ...c, boss: { ...c.boss, enabled: !c.boss.enabled } } : c)}
                      className={`rounded-full px-3 py-1 text-sm transition-colors ${
                        editConfig.boss?.enabled
                          ? "bg-primary text-primary-foreground"
                          : "border border-border bg-card text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {editConfig.boss?.enabled ? "Enabled" : "Disabled"}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">Character</p>
                  <div className="flex flex-wrap gap-2">
                    {["astronaut", "ninja", "soldier", "robot"].map((char) => (
                      <button
                        key={char}
                        type="button"
                        onClick={() => setEditConfig((c) => c ? { ...c, character: char as any } : c)}
                        className={`rounded-full px-3 py-1 text-sm transition-colors ${
                          editConfig.character === char
                            ? "bg-primary text-primary-foreground"
                            : "border border-border bg-card text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {char.charAt(0).toUpperCase() + char.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
            {game.game_type === "dodge" && (
              <>
                <ConfigSlider
                  label={t("editor.obstacles")}
                  value={editConfig.obstacles}
                  min={2}
                  max={20}
                  onChange={(v) => setEditConfig((c) => c ? { ...c, obstacles: v } : c)}
                />
                <ConfigSlider
                  label="Obstacle Speed"
                  value={editConfig.obstacleSpeed}
                  min={0.5}
                  max={2}
                  step={0.1}
                  onChange={(v) => setEditConfig((c) => c ? { ...c, obstacleSpeed: v } : c)}
                />
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">Obstacle Type</p>
                  <div className="flex flex-wrap gap-2">
                    {["rock", "spike", "meteor", "barrier"].map((ot) => (
                      <button
                        key={ot}
                        type="button"
                        onClick={() => setEditConfig((c) => c ? { ...c, obstacleType: ot as any } : c)}
                        className={`rounded-full px-3 py-1 text-sm transition-colors ${
                          editConfig.obstacleType === ot
                            ? "bg-primary text-primary-foreground"
                            : "border border-border bg-card text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {ot.charAt(0).toUpperCase() + ot.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">Character</p>
                  <div className="flex flex-wrap gap-2">
                    {["astronaut", "ninja", "soldier", "robot"].map((char) => (
                      <button
                        key={char}
                        type="button"
                        onClick={() => setEditConfig((c) => c ? { ...c, character: char as any } : c)}
                        className={`rounded-full px-3 py-1 text-sm transition-colors ${
                          editConfig.character === char
                            ? "bg-primary text-primary-foreground"
                            : "border border-border bg-card text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {char.charAt(0).toUpperCase() + char.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
            <ConfigSlider
              label={t("editor.levels")}
              value={editConfig.levels}
              min={1}
              max={10}
              onChange={(v) => setEditConfig((c) => c ? { ...c, levels: v } : c)}
            />

            <div className="flex flex-wrap gap-3 pt-2">
              <Button variant="secondary" onClick={applyEdit}>
                {t("editor.applied")}
              </Button>
              <Button onClick={saveChanges} disabled={saving}>
                {saving ? t("common.saving") : (
                  <>
                    <Save className="mr-1 size-4" /> {t("editor.saveChanges")}
                  </>
                )}
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* ── INFO TAB ── */}
        <TabsContent value="info" className="mt-4">
          <div className="panel space-y-4 rounded-2xl p-6">
            {[
              { label: t("info.gameType"), value: t(`templates.${game.game_type}`) },
              { label: t("info.difficulty"), value: t(`difficulty.${game.game_config.difficulty}`) },
              { label: t("info.theme"), value: t(`themes.${game.game_config.theme}`) },
              {
                label: t("info.created"),
                value: new Date(game.created_at).toLocaleString(),
              },
              {
                label: t("info.updated"),
                value: new Date(game.updated_at).toLocaleString(),
              },
              { label: t("info.prompt"), value: game.original_prompt },
            ].map(({ label, value }) => (
              <div key={label} className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
                <span className="w-36 shrink-0 text-xs font-medium text-muted-foreground">
                  {label}
                </span>
                <span className="text-sm text-foreground">{value}</span>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      <ShareModal
        game={game}
        open={shareOpen}
        onOpenChange={setShareOpen}
        onChanged={(updated) => {
          setGame(updated);
        }}
      />

      <MadeWithBadge />
    </div>
  );
}
