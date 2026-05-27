import { execSync } from "child_process";
import { readFileSync, writeFileSync, existsSync } from "fs";
import OpenAI from "openai";

const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY ?? "placeholder",
});

function run(cmd: string): string {
  try {
    return execSync(cmd, { encoding: "utf8", cwd: process.cwd() }).trim();
  } catch {
    return "";
  }
}

function readFile(path: string): string {
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

async function ask(prompt: string): Promise<string> {
  const res = await openai.chat.completions.create({
    model: "gpt-5-mini",
    max_completion_tokens: 2048,
    messages: [{ role: "user", content: prompt }],
  });
  return res.choices[0]?.message?.content ?? "";
}

async function updateChangelog(diff: string, log: string): Promise<void> {
  const current = readFile("CHANGELOG.md");
  const today = new Date().toISOString().slice(0, 10);

  const lastVersion = current.match(/## \[(\d+\.\d+\.\d+)\]/)?.[1] ?? "0.0.0";
  const [major, minor, patch] = lastVersion.split(".").map(Number);
  const nextVersion = `${major}.${minor + 1}.${patch}`;

  const entry = await ask(
    `Você é um mantenedor técnico do projeto Quanta Flow. Com base no diff e nos commits abaixo, escreva uma nova entrada para o CHANGELOG.md no formato "Keep a Changelog" em português.

Formato esperado:
## [${nextVersion}] — ${today}

### Adicionado
- (lista de itens adicionados, se houver)

### Modificado
- (lista de itens modificados, se houver)

### Corrigido
- (lista de correções, se houver)

Regras:
- Seja objetivo e técnico, focado no que muda para o usuário/desenvolvedor
- Omita seções sem itens
- NÃO repita a linha "## [${nextVersion}]..." no output — apenas o conteúdo das seções
- Máximo 15 bullets no total

Commits recentes:
${log}

Git diff resumido (primeiras 4000 chars):
${diff.slice(0, 4000)}`
  );

  const newEntry = `## [${nextVersion}] — ${today}\n\n${entry.trim()}\n\n---\n\n`;
  const insertAt = current.indexOf("## [");
  const updated =
    insertAt === -1
      ? current + "\n" + newEntry
      : current.slice(0, insertAt) + newEntry + current.slice(insertAt);

  writeFileSync("CHANGELOG.md", updated, "utf8");
  console.log(`[update-docs] CHANGELOG.md updated → v${nextVersion}`);
}

async function updateReplitMd(diff: string, log: string): Promise<void> {
  const current = readFile("replit.md");

  const patch = await ask(
    `Você é o arquiteto do Quanta Flow. Analise o diff e os commits abaixo e identifique se alguma seção do replit.md precisa de atualização.

replit.md atual:
${current}

Commits recentes:
${log}

Git diff resumido (primeiras 3000 chars):
${diff.slice(0, 3000)}

Tarefa:
- Se houve mudança de stack, schema, novos endpoints/módulos ou padrões arquiteturais relevantes, retorne APENAS o conteúdo completo do arquivo replit.md atualizado.
- Se NÃO há nada relevante a mudar, retorne exatamente: NO_CHANGE
- Mantenha o estilo e estrutura existentes.
- Atualize somente o necessário — não reescreva partes que não mudaram.`
  );

  if (patch.trim() === "NO_CHANGE") {
    console.log("[update-docs] replit.md — no changes needed");
    return;
  }

  writeFileSync("replit.md", patch.trim(), "utf8");
  console.log("[update-docs] replit.md updated");
}

async function updateFeaturesMd(diff: string, log: string): Promise<void> {
  const featuresPath = "FEATURES.md";
  const current = readFile(featuresPath);
  const today = new Date().toISOString().slice(0, 10);

  const patch = await ask(
    `Você é o Product Manager do Quanta Flow. Com base no diff e commits abaixo, atualize o arquivo FEATURES.md que cataloga as features do sistema.

${current ? `Conteúdo atual do FEATURES.md:\n${current}\n\n` : "O arquivo ainda não existe — crie-o do zero.\n\n"}

Commits recentes:
${log}

Git diff resumido (primeiras 3000 chars):
${diff.slice(0, 3000)}

Tarefa:
- Adicione novas features implementadas ou marque features existentes como modificadas
- Use o formato: "- **[YYYY-MM-DD] Nome da Feature** — descrição breve (arquivo principal: \`path\`)"
- Se NÃO há features novas/modificadas, retorne: NO_CHANGE
- Mantenha features existentes intactas, apenas adicione/atualize o necessário`
  );

  if (patch.trim() === "NO_CHANGE") {
    console.log("[update-docs] FEATURES.md — no changes needed");
    return;
  }

  const content = current
    ? current.trim() + `\n- **[${today}]** (atualizado automaticamente)\n`
    : `# Quanta Flow — Catálogo de Features\n\n${patch.trim()}\n`;

  writeFileSync(featuresPath, content, "utf8");
  console.log("[update-docs] FEATURES.md updated");
}

async function main(): Promise<void> {
  console.log("[update-docs] Starting documentation update...");

  if (!process.env.AI_INTEGRATIONS_OPENAI_BASE_URL) {
    console.log("[update-docs] No AI integration available — skipping");
    process.exit(0);
  }

  const log = run("git log --oneline -20");
  const diff = run("git diff HEAD~1 --stat") + "\n\n" + run("git diff HEAD~1 -- '*.ts' '*.tsx' '*.sql' '*.md' ':!*.d.ts' ':!dist/*' ':!node_modules/*'");

  if (!log && !diff) {
    console.log("[update-docs] No git history found — skipping");
    process.exit(0);
  }

  await Promise.allSettled([
    updateChangelog(diff, log),
    updateReplitMd(diff, log),
    updateFeaturesMd(diff, log),
  ]);

  console.log("[update-docs] Documentation update complete");
}

main().catch((err) => {
  console.error("[update-docs] Error:", err);
  process.exit(0);
});
