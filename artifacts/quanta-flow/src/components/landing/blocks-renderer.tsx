import { useEffect, useState } from "react";
import DOMPurify from "dompurify";

export type Block = any;

function safeUrl(u: unknown, fallback = "#"): string {
  if (typeof u !== "string") return fallback;
  const t = u.trim();
  if (!t) return fallback;
  if (/^(javascript|data|vbscript):/i.test(t)) return fallback;
  return t;
}
function safeImg(u: unknown): string | null {
  if (typeof u !== "string") return null;
  const t = u.trim();
  if (!t) return null;
  if (!/^(https?:|\/|data:image\/)/i.test(t)) return null;
  return t;
}

interface RendererProps {
  blocks: Block[];
  branding: { companyName: string | null; primaryColor: string; secondaryColor: string; logoUrl: string | null };
  onSubmit?: (blockId: string, values: Record<string, unknown>) => Promise<{ ok: boolean; successMessage?: string; redirectUrl?: string | null; error?: string }>;
  onEvent?: (type: string, blockId?: string) => void;
}

const padMap: Record<string, string> = { sm: "py-8", md: "py-12", lg: "py-20", xl: "py-28" };
const widthMap: Record<string, string> = { narrow: "max-w-3xl", default: "max-w-5xl", wide: "max-w-7xl" };

export function BlocksRenderer({ blocks, branding, onSubmit, onEvent }: RendererProps) {
  return (
    <div className="min-h-screen bg-background text-foreground" style={{ ['--brand-primary' as any]: branding.primaryColor, ['--brand-secondary' as any]: branding.secondaryColor }}>
      {blocks.map((b) => (
        <BlockView key={b.id} block={b} branding={branding} onSubmit={onSubmit} onEvent={onEvent} />
      ))}
    </div>
  );
}

function BlockView({ block, branding, onSubmit, onEvent }: { block: Block; branding: RendererProps["branding"]; onSubmit?: RendererProps["onSubmit"]; onEvent?: RendererProps["onEvent"] }) {
  const style = block.style ?? {};
  const sectionClass = `w-full ${padMap[style.paddingY ?? "lg"]}`;
  const innerClass = `mx-auto px-4 ${widthMap[style.width ?? "default"]} ${style.align === "center" ? "text-center" : style.align === "right" ? "text-right" : "text-left"}`;
  const bg = style.background || undefined;

  const sectionStyle: React.CSSProperties = bg ? { backgroundColor: bg } : {};

  switch (block.type) {
    case "header":
      return (
        <header className="w-full border-b bg-background/95 backdrop-blur sticky top-0 z-10">
          <div className="mx-auto max-w-7xl px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {block.props.logoUrl ? <img src={safeImg(block.props.logoUrl) ?? ""} alt={block.props.companyName || "Logo"} className="h-8 object-contain" /> : <span className="font-bold text-lg" style={{ color: branding.primaryColor }}>{block.props.companyName || branding.companyName || "Marca"}</span>}
            </div>
            <nav className="hidden md:flex items-center gap-6 text-sm">
              {(block.props.menuLinks ?? []).map((l: any, i: number) => <a key={i} href={l.href} className="hover:opacity-70">{l.label}</a>)}
            </nav>
            {block.props.ctaLabel && <a href={safeUrl(block.props.ctaHref)} onClick={() => onEvent?.("cta_click", block.id)} className="inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium text-white" style={{ backgroundColor: branding.primaryColor }}>{block.props.ctaLabel}</a>}
          </div>
        </header>
      );
    case "hero":
      return (
        <section className={sectionClass} style={sectionStyle}>
          <div className={innerClass + (block.props.layout === "split" ? " grid md:grid-cols-2 gap-10 items-center text-left" : "")}>
            <div>
              {block.props.eyebrow && <div className="inline-block uppercase tracking-wider text-xs font-semibold mb-3 px-3 py-1 rounded-full" style={{ backgroundColor: branding.primaryColor + "22", color: branding.primaryColor }}>{block.props.eyebrow}</div>}
              <h1 className="text-4xl md:text-5xl font-bold leading-tight mb-4">{block.props.title}</h1>
              {block.props.subtitle && <p className="text-lg md:text-xl text-muted-foreground mb-6">{block.props.subtitle}</p>}
              {block.props.ctaLabel && <a href={safeUrl(block.props.ctaHref)} onClick={() => onEvent?.("cta_click", block.id)} className="inline-flex items-center justify-center rounded-md px-6 py-3 text-base font-semibold text-white shadow" style={{ backgroundColor: branding.primaryColor }}>{block.props.ctaLabel}</a>}
            </div>
            {block.props.layout === "split" && (
              <div>
                {block.props.mediaUrl ? <img src={safeImg(block.props.mediaUrl) ?? ""} alt={block.props.mediaAlt || ""} className="w-full rounded-lg shadow-lg" /> : <div className="w-full aspect-video rounded-lg bg-muted flex items-center justify-center text-muted-foreground">Imagem do hero</div>}
              </div>
            )}
          </div>
        </section>
      );
    case "benefits":
      return (
        <section className={sectionClass} style={sectionStyle}>
          <div className={innerClass}>
            {block.props.title && <h2 className="text-3xl font-bold mb-10 text-center">{block.props.title}</h2>}
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6">
              {block.props.items.map((it: any, i: number) => (
                <div key={i} className="rounded-lg border p-6 bg-card">
                  <div className="w-10 h-10 rounded-md mb-3 flex items-center justify-center" style={{ backgroundColor: branding.primaryColor + "22", color: branding.primaryColor }}>★</div>
                  <h3 className="font-semibold text-lg mb-1">{it.title}</h3>
                  {it.description && <p className="text-sm text-muted-foreground">{it.description}</p>}
                </div>
              ))}
            </div>
          </div>
        </section>
      );
    case "testimonials":
      return (
        <section className={sectionClass} style={sectionStyle}>
          <div className={innerClass}>
            {block.props.title && <h2 className="text-3xl font-bold mb-10 text-center">{block.props.title}</h2>}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {block.props.items.map((t: any, i: number) => (
                <figure key={i} className="rounded-lg border p-6 bg-card">
                  <blockquote className="text-base mb-4">"{t.quote}"</blockquote>
                  <figcaption className="flex items-center gap-3">
                    {t.avatarUrl && <img src={safeImg(t.avatarUrl) ?? ""} alt={t.name} className="h-10 w-10 rounded-full object-cover" />}
                    <div><div className="font-semibold text-sm">{t.name}</div>{t.role && <div className="text-xs text-muted-foreground">{t.role}</div>}</div>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
      );
    case "faq":
      return (
        <section className={sectionClass} style={sectionStyle}>
          <div className={innerClass + " max-w-3xl mx-auto"}>
            {block.props.title && <h2 className="text-3xl font-bold mb-8 text-center">{block.props.title}</h2>}
            <div className="space-y-3">
              {block.props.items.map((q: any, i: number) => (
                <details key={i} className="group rounded-lg border bg-card p-4">
                  <summary className="cursor-pointer font-semibold list-none flex justify-between items-center">{q.question}<span className="ml-4 transition group-open:rotate-180">▾</span></summary>
                  <p className="mt-3 text-muted-foreground">{q.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      );
    case "video":
      return (
        <section className={sectionClass} style={sectionStyle}>
          <div className={innerClass + " max-w-4xl mx-auto"}>
            <div className="aspect-video w-full rounded-lg overflow-hidden border" onClick={() => onEvent?.("video_play", block.id)}>
              <iframe src={block.props.url} className="w-full h-full" allow="autoplay; encrypted-media" allowFullScreen title={block.props.caption || "Vídeo"} />
            </div>
            {block.props.caption && <p className="text-center text-sm text-muted-foreground mt-3">{block.props.caption}</p>}
          </div>
        </section>
      );
    case "gallery":
      return (
        <section className={sectionClass} style={sectionStyle}>
          <div className={innerClass}>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {block.props.images.map((img: any, i: number) => (
                <img key={i} src={safeImg(img.url) ?? ""} alt={img.alt || ""} className="w-full h-48 object-cover rounded-md" />
              ))}
            </div>
          </div>
        </section>
      );
    case "countdown":
      return <CountdownBlock block={block} sectionClass={sectionClass} innerClass={innerClass} sectionStyle={sectionStyle} primary={branding.primaryColor} />;
    case "socialProof":
      return (
        <section className={sectionClass + " bg-muted/30"} style={sectionStyle}>
          <div className={innerClass}>
            {block.props.title && <p className="text-center text-sm uppercase tracking-wider text-muted-foreground mb-6">{block.props.title}</p>}
            <div className="flex flex-wrap justify-center items-center gap-8 opacity-70">
              {(block.props.logos ?? []).map((l: any, i: number) => <img key={i} src={safeImg(l.url) ?? ""} alt={l.alt || ""} className="h-10 object-contain grayscale" />)}
              {(!block.props.logos || block.props.logos.length === 0) && <div className="text-sm text-muted-foreground">Adicione os logotipos no editor.</div>}
            </div>
          </div>
        </section>
      );
    case "pricing":
      return (
        <section id="pricing" className={sectionClass} style={sectionStyle}>
          <div className={innerClass}>
            {block.props.title && <h2 className="text-3xl font-bold mb-10 text-center">{block.props.title}</h2>}
            <div className="grid md:grid-cols-3 gap-6">
              {block.props.plans.map((p: any, i: number) => (
                <div key={i} className={"rounded-lg border p-6 " + (p.highlight ? "shadow-lg ring-2" : "bg-card")} style={p.highlight ? { borderColor: branding.primaryColor, boxShadow: `0 0 0 2px ${branding.primaryColor}` } : undefined}>
                  <div className="font-semibold text-lg">{p.name}</div>
                  <div className="my-3 text-3xl font-bold">{p.price}<span className="text-base font-normal text-muted-foreground">{p.period || ""}</span></div>
                  <ul className="space-y-2 text-sm mb-6">{p.features.map((f: string, j: number) => <li key={j} className="flex gap-2"><span style={{ color: branding.primaryColor }}>✓</span> {f}</li>)}</ul>
                  {p.ctaLabel && <a href={safeUrl(p.ctaHref)} onClick={() => onEvent?.("cta_click", block.id)} className="block w-full text-center rounded-md px-4 py-2 font-semibold text-white" style={{ backgroundColor: branding.primaryColor }}>{p.ctaLabel}</a>}
                </div>
              ))}
            </div>
          </div>
        </section>
      );
    case "richText":
      return (
        <section className={sectionClass} style={sectionStyle}>
          <div className={innerClass + " prose dark:prose-invert max-w-3xl mx-auto"} dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(block.props.html || "") }} />
        </section>
      );
    case "cta":
      return (
        <section id="cta" className={sectionClass} style={sectionStyle}>
          <div className={innerClass + " text-center rounded-2xl p-10"} style={{ background: `linear-gradient(135deg, ${branding.primaryColor}, ${branding.secondaryColor})`, color: "#fff" }}>
            <h2 className="text-3xl font-bold mb-2">{block.props.title}</h2>
            {block.props.subtitle && <p className="opacity-90 mb-6">{block.props.subtitle}</p>}
            <a href={safeUrl(block.props.ctaHref)} onClick={() => onEvent?.("cta_click", block.id)} className="inline-flex items-center justify-center rounded-md bg-white px-6 py-3 font-semibold" style={{ color: branding.primaryColor }}>{block.props.ctaLabel}</a>
          </div>
        </section>
      );
    case "form":
      return <FormBlock block={block} sectionClass={sectionClass} innerClass={innerClass} sectionStyle={sectionStyle} primary={branding.primaryColor} onSubmit={onSubmit} onEvent={onEvent} />;
    case "calendarEmbed":
      return (
        <section className={sectionClass} style={sectionStyle}>
          <div className={innerClass}>
            <iframe src={block.props.url} className="w-full rounded-lg border" style={{ height: block.props.height || 700 }} title="Agenda" />
          </div>
        </section>
      );
    case "rawEmbed":
      return (
        <section className={sectionClass} style={sectionStyle}>
          <div className={innerClass} dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(block.props.html || "", { ADD_TAGS: ["iframe"], ADD_ATTR: ["allow", "allowfullscreen", "frameborder", "scrolling"] }) }} />
        </section>
      );
    case "footer":
      return (
        <footer className="w-full border-t mt-10">
          <div className="mx-auto max-w-7xl px-4 py-10 flex flex-col md:flex-row gap-4 items-center justify-between text-sm text-muted-foreground">
            <div>{block.props.text || ""}</div>
            <div className="flex gap-4">{(block.props.links ?? []).map((l: any, i: number) => <a key={i} href={l.href} className="hover:underline">{l.label}</a>)}</div>
          </div>
        </footer>
      );
    default:
      return null;
  }
}

function CountdownBlock({ block, sectionClass, innerClass, sectionStyle, primary }: any) {
  const target = new Date(block.props.deadline).getTime();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const diff = Math.max(0, target - now);
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return (
    <section className={sectionClass} style={sectionStyle}>
      <div className={innerClass + " text-center"}>
        {block.props.label && <p className="text-sm uppercase tracking-wider mb-3 text-muted-foreground">{block.props.label}</p>}
        <div className="flex justify-center gap-4">
          {[{ v: d, l: "dias" }, { v: h, l: "horas" }, { v: m, l: "min" }, { v: s, l: "seg" }].map((u, i) => (
            <div key={i} className="rounded-lg p-4 min-w-[80px]" style={{ backgroundColor: primary + "11" }}>
              <div className="text-3xl font-bold tabular-nums" style={{ color: primary }}>{String(u.v).padStart(2, "0")}</div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">{u.l}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FormBlock({ block, sectionClass, innerClass, sectionStyle, primary, onSubmit, onEvent }: any) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState<{ message?: string; redirect?: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => { onEvent?.("form_view", block.id); }, [block.id, onEvent]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!onSubmit) { setSubmitted({ message: "Pré-visualização: o envio não é gravado." }); return; }
    setLoading(true); setError(null);
    const r = await onSubmit(block.id, values);
    setLoading(false);
    if (!r.ok) { setError(r.error || "Erro ao enviar"); return; }
    if (r.redirectUrl) { window.location.href = r.redirectUrl; return; }
    setSubmitted({ message: r.successMessage || "Recebemos suas informações!" });
  }
  return (
    <section id="form" className={sectionClass} style={sectionStyle}>
      <div className={innerClass + " max-w-xl mx-auto"}>
        <div className="rounded-2xl border bg-card p-8 shadow-sm">
          {block.props.title && <h2 className="text-2xl font-bold mb-2">{block.props.title}</h2>}
          {block.props.description && <p className="text-muted-foreground mb-6">{block.props.description}</p>}
          {submitted ? (
            <div className="text-center py-8"><div className="text-3xl mb-3" style={{ color: primary }}>✓</div><p className="text-lg font-semibold">{submitted.message}</p></div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {block.props.fields.map((f: any) => (
                <div key={f.id} className="space-y-1">
                  <label className="text-sm font-medium" htmlFor={`f-${f.id}`}>{f.label}{f.required && <span className="text-destructive ml-1">*</span>}</label>
                  {f.type === "textarea" ? (
                    <textarea id={`f-${f.id}`} required={f.required} placeholder={f.placeholder} value={values[f.name] || ""} onChange={(e) => setValues({ ...values, [f.name]: e.target.value })} className="w-full min-h-[100px] rounded-md border px-3 py-2 bg-background" />
                  ) : f.type === "select" ? (
                    <select id={`f-${f.id}`} required={f.required} value={values[f.name] || ""} onChange={(e) => setValues({ ...values, [f.name]: e.target.value })} className="w-full rounded-md border px-3 py-2 bg-background">
                      <option value="">Selecione…</option>
                      {(f.options ?? []).map((o: any) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  ) : f.type === "checkbox" ? (
                    <label className="flex items-start gap-2 text-sm"><input type="checkbox" required={f.required} checked={!!values[f.name]} onChange={(e) => setValues({ ...values, [f.name]: e.target.checked ? "1" : "" })} />{f.placeholder || f.label}</label>
                  ) : (
                    <input id={`f-${f.id}`} type={f.type === "email" ? "email" : f.type === "phone" ? "tel" : "text"} required={f.required} placeholder={f.placeholder} value={values[f.name] || ""} onChange={(e) => setValues({ ...values, [f.name]: e.target.value })} className="w-full rounded-md border px-3 py-2 bg-background" />
                  )}
                </div>
              ))}
              {block.props.consentText && <p className="text-xs text-muted-foreground">{block.props.consentText}</p>}
              {error && <p className="text-sm text-destructive">{error}</p>}
              <button type="submit" disabled={loading} className="w-full rounded-md px-4 py-3 font-semibold text-white disabled:opacity-60" style={{ backgroundColor: primary }}>{loading ? "Enviando…" : (block.props.submitLabel || "Enviar")}</button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
