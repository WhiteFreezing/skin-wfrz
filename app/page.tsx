"use client";

import { useEffect, useRef, useState } from "react";

// Mojang's own api.mojang.com lacks CORS headers — browser fetch is blocked.
// Ashcon is a CORS-enabled mirror of the same data, free, no auth.
const ASHCON = "https://api.ashcon.app/mojang/v2/user";

type Profile = { id: string; name: string };

export default function HomePage() {
  const [name, setName] = useState("Notch");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [skinUrl, setSkinUrl] = useState<string | null>(null);
  const [capeUrl, setCapeUrl] = useState<string | null>(null);
  const [model, setModel] = useState<"default" | "slim">("default");
  const [animation, setAnimation] = useState<"idle" | "walk" | "run" | "fly" | "none">("idle");
  const [err, setErr] = useState("");

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const viewerRef = useRef<any>(null);

  async function lookup() {
    setErr(""); setProfile(null); setSkinUrl(null); setCapeUrl(null);
    try {
      const r = await fetch(`${ASHCON}/${encodeURIComponent(name.trim())}`);
      if (r.status === 404) throw new Error("Username not found");
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      // Ashcon shape:
      //   uuid: '069a79f4-44e9-4726-a5be-fca90e38aaf5'
      //   username: 'Notch'
      //   textures.skin.url: 'http://textures.minecraft.net/texture/<hash>'
      //   textures.cape.url: same shape, or undefined if no cape currently equipped
      const id = (j.uuid as string).replace(/-/g, "");
      setProfile({ id, name: j.username });
      // textures.minecraft.net serves on http (Mojang preserves the http:// in
      // their texture properties). Upgrade to https so mixed-content blocking
      // doesn't kill it on our https origin.
      const skinUrl = (j.textures?.skin?.url || `https://mc-heads.net/skin/${id}`).replace(/^http:\/\//, "https://");
      setSkinUrl(skinUrl);
      const capeRaw = j.textures?.cape?.url;
      setCapeUrl(capeRaw ? capeRaw.replace(/^http:\/\//, "https://") : null);
    } catch (e: any) {
      setErr(e.message);
    }
  }

  // Initial lookup on mount
  useEffect(() => { lookup(); }, []); // eslint-disable-line

  // Load skinview3d dynamically (client-only)
  useEffect(() => {
    if (!skinUrl || !canvasRef.current) return;
    let disposed = false;
    (async () => {
      const skv = await import("skinview3d");
      if (disposed) return;
      if (viewerRef.current) { try { viewerRef.current.dispose(); } catch {} viewerRef.current = null; }
      const viewer = new skv.SkinViewer({
        canvas: canvasRef.current!,
        width: canvasRef.current!.clientWidth,
        height: 480,
        skin: skinUrl,
        model: model,
      });
      if (capeUrl) {
        try { await viewer.loadCape(capeUrl); } catch {}
      }
      viewer.controls.enableRotate = true;
      viewer.controls.enableZoom = true;
      viewer.controls.enablePan = false;
      const anim =
        animation === "walk" ? new skv.WalkingAnimation() :
        animation === "run"  ? new skv.RunningAnimation() :
        animation === "fly"  ? new skv.FlyingAnimation()  :
        animation === "idle" ? new skv.IdleAnimation()    : null;
      if (anim) viewer.animation = anim;
      viewerRef.current = viewer;
    })();
    return () => { disposed = true; };
  }, [skinUrl, capeUrl, model, animation]);

  return (
    <main className="min-h-screen">
      <header className="max-w-5xl mx-auto px-5 pt-10">
        <div className="text-xs uppercase tracking-[0.18em] text-dim mb-2">wfrz.eu · open source</div>
        <h1 className="text-4xl md:text-5xl font-extrabold leading-tight">
          MC skin viewer<span className="text-brand">.</span>
        </h1>
        <p className="text-dim mt-3 max-w-2xl">
          3D rotatable Minecraft skin + cape viewer. Paste a username, see the model.
          Drag to rotate, scroll to zoom. Download the original skin PNG with one click.
        </p>
      </header>

      <section className="max-w-5xl mx-auto px-5 pt-6 pb-24 grid lg:grid-cols-[1fr_320px] gap-5">
        <div className="space-y-4">
          <div className="card p-4 space-y-3">
            <div className="flex gap-2">
              <input value={name} onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && lookup()}
                className="input input-mono text-lg !py-3 flex-1"
                placeholder="MC username" spellCheck={false} autoFocus />
              <button onClick={lookup} className="btn-brand">Lookup</button>
            </div>
            <div className="flex flex-wrap gap-1.5 text-xs">
              <span className="text-dim self-center mr-1">Cape examples:</span>
              {["Dinnerbone", "jeb_", "Marc", "Notch"].map((u) => (
                <button key={u} onClick={() => { setName(u); setTimeout(lookup, 0); }} className="chip">{u}</button>
              ))}
            </div>
          </div>

          {err && <div className="card p-4 border-red-500/50 bg-red-500/5 text-sm text-red-200">{err}</div>}

          <div className="card overflow-hidden">
            <canvas ref={canvasRef} className="w-full block" style={{ height: 480, background: "radial-gradient(circle at 50% 30%, #1c2026, #0a0b0d)" }} />
          </div>
        </div>

        <aside className="space-y-4">
          {profile && (
            <div className="card p-4 space-y-3">
              <div className="text-2xl font-extrabold">{profile.name}</div>
              <div className="text-xs text-dim space-y-1">
                <div>UUID:</div>
                <code className="text-brand block break-all">{profile.id}</code>
              </div>
              <div className="flex gap-2 flex-wrap">
                <a className="chip" href={`https://namemc.com/profile/${profile.id}`} target="_blank" rel="noopener">NameMC ↗</a>
                <a className="chip" href={`https://uuid.wfrz.eu`} target="_blank" rel="noopener">uuid.wfrz.eu</a>
              </div>
            </div>
          )}

          <div className="card p-4 space-y-3">
            <div className="text-xs uppercase tracking-wider text-dim">Model</div>
            <div className="flex gap-1.5">
              <button onClick={() => setModel("default")} className={`chip ${model === "default" ? "chip-on" : ""}`}>Default (4 px arms)</button>
              <button onClick={() => setModel("slim")}    className={`chip ${model === "slim"    ? "chip-on" : ""}`}>Slim (3 px arms / Alex)</button>
            </div>

            <div className="text-xs uppercase tracking-wider text-dim mt-3">Animation</div>
            <div className="grid grid-cols-2 gap-1.5">
              {(["idle","walk","run","fly","none"] as const).map((a) => (
                <button key={a} onClick={() => setAnimation(a)} className={`chip ${animation === a ? "chip-on" : ""}`}>{a}</button>
              ))}
            </div>
          </div>

          {skinUrl && (
            <div className="card p-4 space-y-2">
              <div className="text-xs uppercase tracking-wider text-dim">Download</div>
              <a className="block chip" download={`${profile?.name}-skin.png`} href={skinUrl}>Skin PNG (64×64)</a>
              {capeUrl ? (
                <a className="block chip" download={`${profile?.name}-cape.png`} href={capeUrl}>Cape PNG (64×32)</a>
              ) : (
                <div className="text-xs text-dim italic">No cape equipped on this profile.</div>
              )}
              <code className="text-xs text-dim block break-all mt-2">{skinUrl}</code>
            </div>
          )}
        </aside>
      </section>

      <footer className="border-t border-border/70 py-8 text-sm text-dim">
        <div className="max-w-5xl mx-auto px-5 flex items-center justify-between flex-wrap gap-4">
          <div>Renders by <a className="hover:text-text" href="https://github.com/bs-community/skinview3d" target="_blank" rel="noopener">skinview3d</a>. Profile via <a className="hover:text-text" href="https://github.com/Electroid/mojang-api" target="_blank" rel="noopener">Ashcon</a> (Mojang mirror). Skin / cape PNGs from <code>textures.minecraft.net</code> (Mojang CDN).</div>
          <a href="https://github.com/WhiteFreezing/skin-wfrz" target="_blank" rel="noopener" className="hover:text-text">GitHub →</a>
        </div>
      </footer>
    </main>
  );
}
