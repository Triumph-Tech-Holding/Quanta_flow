import { useEffect, useMemo, useRef } from "react";
import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { BlocksRenderer, type Block } from "@/components/landing/blocks-renderer";
import { Loader2, AlertCircle } from "lucide-react";

interface PublicLanding {
  id: string;
  slug: string;
  name: string;
  blocks: Block[];
  seo: { title?: string | null; description?: string | null; ogImage?: string | null; canonical?: string | null; noindex?: boolean };
  branding: { companyName: string | null; primaryColor: string; secondaryColor: string; logoUrl: string | null; faviconUrl: string | null };
}

function getSession(): string {
  try {
    const k = "ql_sid";
    let s = sessionStorage.getItem(k);
    if (!s) { s = Math.random().toString(36).slice(2) + Date.now().toString(36); sessionStorage.setItem(k, s); }
    return s;
  } catch { return Math.random().toString(36).slice(2); }
}

function readUtm(): Record<string, string> {
  const out: Record<string, string> = {};
  const sp = new URLSearchParams(window.location.search);
  for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"]) {
    const v = sp.get(k); if (v) out[k] = v;
  }
  return out;
}

export default function LandingPublic() {
  const { slug } = useParams<{ slug: string }>();
  const sessionId = useMemo(getSession, []);
  const utm = useMemo(readUtm, []);
  const sentRef = useRef(false);

  const { data, isLoading, error } = useQuery<PublicLanding>({
    queryKey: [`/api/public/landing/${slug}`],
    queryFn: async () => {
      const r = await fetch(`/api/public/landing/${slug}`);
      if (!r.ok) throw new Error("not_found");
      return r.json();
    },
    retry: false,
  });

  useEffect(() => {
    if (!data) return;
    document.title = data.seo?.title || data.name || "Landing";
    if (data.seo?.description) {
      let m = document.querySelector('meta[name="description"]');
      if (!m) { m = document.createElement("meta"); m.setAttribute("name", "description"); document.head.appendChild(m); }
      m.setAttribute("content", data.seo.description);
    }
    if (data.branding?.faviconUrl) {
      let l = document.querySelector('link[rel="icon"]');
      if (!l) { l = document.createElement("link"); l.setAttribute("rel", "icon"); document.head.appendChild(l); }
      l.setAttribute("href", data.branding.faviconUrl);
    }
    if (data.seo?.noindex) {
      let r = document.querySelector('meta[name="robots"]');
      if (!r) { r = document.createElement("meta"); r.setAttribute("name", "robots"); document.head.appendChild(r); }
      r.setAttribute("content", "noindex,nofollow");
    }
    if (!sentRef.current) {
      sentRef.current = true;
      fetch(`/api/public/landing/${slug}/event`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "page_view", sessionId }) }).catch(() => {});
    }
  }, [data, slug, sessionId]);

  useEffect(() => {
    const seen = new Set<string>();
    function onScroll() {
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      if (max <= 0) return;
      const pct = Math.round((window.scrollY / max) * 100);
      for (const t of [25, 50, 75, 100]) {
        if (pct >= t && !seen.has(`s${t}`)) {
          seen.add(`s${t}`);
          fetch(`/api/public/landing/${slug}/event`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: `scroll_${t}`, sessionId }) }).catch(() => {});
        }
      }
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [slug, sessionId]);

  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  if (error || !data) return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="text-center">
        <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-3" />
        <h1 className="text-xl font-semibold">Página não encontrada</h1>
        <p className="text-sm text-muted-foreground mt-1">Confira o link e tente novamente.</p>
      </div>
    </div>
  );

  return (
    <BlocksRenderer
      blocks={data.blocks}
      branding={data.branding}
      onEvent={(type, blockId) => {
        fetch(`/api/public/landing/${slug}/event`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type, blockId, sessionId }) }).catch(() => {});
      }}
      onSubmit={async (blockId, values) => {
        const r = await fetch(`/api/public/landing/${slug}/submit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ blockId, values, utm }),
        });
        const json = await r.json().catch(() => ({} as any));
        if (!r.ok) return { ok: false, error: json?.message || "Erro ao enviar" };
        return { ok: true, successMessage: json.successMessage, redirectUrl: json.redirectUrl };
      }}
    />
  );
}
