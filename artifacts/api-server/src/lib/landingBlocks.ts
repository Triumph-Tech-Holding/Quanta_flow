import { z } from "zod/v4";

export const blockStyleSchema = z.object({
  background: z.string().optional(),
  paddingY: z.enum(["sm", "md", "lg", "xl"]).optional(),
  align: z.enum(["left", "center", "right"]).optional(),
  width: z.enum(["narrow", "default", "wide"]).optional(),
}).partial();

const baseBlock = {
  id: z.string().min(1),
  style: blockStyleSchema.optional(),
};

export const formFieldSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["text", "email", "phone", "textarea", "select", "checkbox"]),
  name: z.string().min(1),
  label: z.string().min(1),
  placeholder: z.string().optional(),
  required: z.boolean().optional(),
  options: z.array(z.object({ label: z.string(), value: z.string() })).optional(),
});
export type FormField = z.infer<typeof formFieldSchema>;

export const blockSchema = z.discriminatedUnion("type", [
  z.object({ ...baseBlock, type: z.literal("header"), props: z.object({ logoUrl: z.string().nullish(), companyName: z.string().nullish(), menuLinks: z.array(z.object({ label: z.string(), href: z.string() })).optional(), ctaLabel: z.string().nullish(), ctaHref: z.string().nullish() }) }),
  z.object({ ...baseBlock, type: z.literal("hero"), props: z.object({ eyebrow: z.string().nullish(), title: z.string(), subtitle: z.string().nullish(), ctaLabel: z.string().nullish(), ctaHref: z.string().nullish(), mediaUrl: z.string().nullish(), mediaAlt: z.string().nullish(), layout: z.enum(["split", "center"]).optional() }) }),
  z.object({ ...baseBlock, type: z.literal("benefits"), props: z.object({ title: z.string().nullish(), items: z.array(z.object({ icon: z.string().nullish(), title: z.string(), description: z.string().nullish() })) }) }),
  z.object({ ...baseBlock, type: z.literal("testimonials"), props: z.object({ title: z.string().nullish(), items: z.array(z.object({ name: z.string(), role: z.string().nullish(), avatarUrl: z.string().nullish(), quote: z.string() })) }) }),
  z.object({ ...baseBlock, type: z.literal("faq"), props: z.object({ title: z.string().nullish(), items: z.array(z.object({ question: z.string(), answer: z.string() })) }) }),
  z.object({ ...baseBlock, type: z.literal("video"), props: z.object({ url: z.string(), caption: z.string().nullish() }) }),
  z.object({ ...baseBlock, type: z.literal("gallery"), props: z.object({ images: z.array(z.object({ url: z.string(), alt: z.string().nullish() })) }) }),
  z.object({ ...baseBlock, type: z.literal("countdown"), props: z.object({ deadline: z.string(), label: z.string().nullish() }) }),
  z.object({ ...baseBlock, type: z.literal("socialProof"), props: z.object({ title: z.string().nullish(), logos: z.array(z.object({ url: z.string(), alt: z.string().nullish() })) }) }),
  z.object({ ...baseBlock, type: z.literal("pricing"), props: z.object({ title: z.string().nullish(), plans: z.array(z.object({ name: z.string(), price: z.string(), period: z.string().nullish(), features: z.array(z.string()), ctaLabel: z.string().nullish(), ctaHref: z.string().nullish(), highlight: z.boolean().optional() })) }) }),
  z.object({ ...baseBlock, type: z.literal("richText"), props: z.object({ html: z.string() }) }),
  z.object({ ...baseBlock, type: z.literal("cta"), props: z.object({ title: z.string(), subtitle: z.string().nullish(), ctaLabel: z.string(), ctaHref: z.string() }) }),
  z.object({ ...baseBlock, type: z.literal("form"), props: z.object({ title: z.string().nullish(), description: z.string().nullish(), submitLabel: z.string().default("Enviar"), successMessage: z.string().nullish(), redirectUrl: z.string().nullish(), flowId: z.string().nullish(), campaignId: z.string().nullish(), fields: z.array(formFieldSchema).min(1), consentText: z.string().nullish() }) }),
  z.object({ ...baseBlock, type: z.literal("calendarEmbed"), props: z.object({ url: z.string(), height: z.number().optional() }) }),
  z.object({ ...baseBlock, type: z.literal("rawEmbed"), props: z.object({ html: z.string() }) }),
  z.object({ ...baseBlock, type: z.literal("footer"), props: z.object({ text: z.string().nullish(), links: z.array(z.object({ label: z.string(), href: z.string() })).optional() }) }),
]);
export type Block = z.infer<typeof blockSchema>;
export type BlockType = Block["type"];

export const blocksSchema = z.array(blockSchema);

export const seoSchema = z.object({
  title: z.string().nullish(),
  description: z.string().nullish(),
  ogImage: z.string().nullish(),
  canonical: z.string().nullish(),
  noindex: z.boolean().optional(),
}).partial();
export type Seo = z.infer<typeof seoSchema>;

export const settingsSchema = z.object({
  language: z.string().optional(),
  primaryColor: z.string().nullish(),
  secondaryColor: z.string().nullish(),
  fontFamily: z.string().nullish(),
  successRedirectUrl: z.string().nullish(),
}).partial();
export type LandingSettings = z.infer<typeof settingsSchema>;

export function findFormBlock(blocks: Block[], blockId?: string): Extract<Block, { type: "form" }> | undefined {
  if (blockId) {
    const b = blocks.find(b => b.id === blockId && b.type === "form");
    if (b && b.type === "form") return b;
  }
  const first = blocks.find(b => b.type === "form");
  return first && first.type === "form" ? first : undefined;
}
