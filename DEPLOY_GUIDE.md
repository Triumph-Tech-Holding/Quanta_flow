# Quanta Flow — Guia de Deploy

> Procedimento padrão de publicação na infraestrutura Replit.

## 1. Visão Geral

O Quanta Flow é publicado via **Replit Deployments**, que gerencia automaticamente:
- Build do frontend (Vite) + bundle do backend
- Hosting (`*.replit.app` ou domínio custom)
- TLS/HTTPS
- Health checks
- Ambiente de produção isolado (DB de produção separado do DB de dev)

## 2. Pré-requisitos

```
[ ] Workflow "Start application" rodando localmente sem erros
[ ] npm run build executa com sucesso (sem erros TypeScript)
[ ] Smoke tests do Lab passando (10/10)
[ ] DATABASE_URL de produção configurado pela plataforma Replit
[ ] Secrets em produção: SESSION_SECRET, OPENAI_API_KEY (via Integrations)
[ ] Branding configurado (logo, cores, slogan)
```

## 3. Fluxo de Deploy

```
1. Validar localmente   ─► Smoke tests + DoD 12/12
2. Atualizar CHANGELOG  ─► Adicionar entrada da versão
3. Commit               ─► Mensagem descritiva
4. Suggest Deploy       ─► Acionar suggest_deploy no agente
5. Usuário publica      ─► Botão de publish na UI Replit
6. Pós-deploy           ─► Monitorar logs + smoke em produção
```

## 4. Variáveis de Ambiente

### Obrigatórias
| Var | Onde configurar | Notas |
|---|---|---|
| `DATABASE_URL` | Replit (auto) | Postgres managed |
| `SESSION_SECRET` | Replit Secrets | gerar random 32+ chars |

### Integrações (via Replit AI Integrations)
| Integração | Modelos usados |
|---|---|
| `javascript_openai_ai_integrations` | gpt-4o-mini, tts-1, dall-e-3 |

### Por usuário (criptografado em `settings`)
- `meta_phone_number_id`, `meta_access_token`, `meta_verify_token`
- `zapi_token`, `zapi_instance_id`
- `elevenlabs_api_key`, `heygen_api_key` (via projeto Social)

## 5. Migrations / Schema

> Use a skill `database` com `environment: "production"` para queries.

### Quando há mudanças no schema:
1. Após merge na main, o Replit detecta a mudança via `npm run db:push` (se configurado)
2. Caso falhe ou não haja, aplicar manualmente:
   ```bash
   DATABASE_URL=<prod-url> npx drizzle-kit push
   ```
3. Verificar com queries read-only se a tabela/coluna apareceu.

### Seeds automáticos no startup
O `server/index.ts` chama no boot:
- `seedRoles()` — re-seedáveis (idempotente)
- `seedAdminUser()` — só cria se faltar
- `seedFlowTemplates()` — 5 templates built-in
- `seedDocumentationVersions()` — v7.0.0
- `migrateProjectStatusItems()` — cria tabela se faltar
- `seedProjectStatusItems()` — 25 features (idempotente)

## 6. Health Check

`GET /api/health` retorna:
```json
{ "status": "ok", "db": "connected", "uptime": 1234 }
```

A plataforma usa esse endpoint para liveness/readiness.

## 7. Logs em Produção

Use a skill `deployment` com `fetch_deployment_logs` para investigar erros.

Padrões úteis:
- `(?i)error` — todos os erros
- `(?i)database` — issues de DB
- `(?i)webhook` — falhas de integração
- `\[express\] serving on port` — boot OK

## 8. Rollback

Se o deploy quebrar:
1. Identificar último deploy estável (UI Replit Deployments)
2. Clicar em "Redeploy previous version"
3. Investigar logs do deploy quebrado
4. Corrigir em dev → novo deploy

> Para problemas de DB, usar a skill `diagnostics` para sugerir checkpoint rollback do banco.

## 9. Monitoramento Pós-Deploy (15 min)

```
[ ] Smoke tests via UI do Lab passam em prod
[ ] Login admin funciona
[ ] Inbox recebe mensagem teste
[ ] Webhooks externos respondem
[ ] OpenAI calls funcionam (testar agente IA)
[ ] CampaignWorker logado: "Campaign worker started (every 60s)"
[ ] LearningWorker logado: "LearningWorker: started (5min interval)"
```

## 10. Domínio Custom

1. Replit Deployments → Settings → Custom domain
2. Adicionar CNAME no DNS apontando para `<deploy>.replit.app`
3. Aguardar provisionamento de TLS (até 24h)
4. Atualizar `branding_config.faviconUrl`/`logoUrl` se usar URL absoluta

## 11. Checklist Final

```
[ ] CHANGELOG.md com entrada da versão (data + features)
[ ] replit.md reflete arquitetura atual
[ ] Smoke tests passando (10/10) em dev
[ ] DoD 12/12 marcados
[ ] suggest_deploy chamado
[ ] Após publicar: smoke tests passam em prod
[ ] Logs limpos por 5min
```

## 12. Contatos & Suporte

- Bugs em produção → criar item no painel **Lab > Progresso** com status `pendente` + prioridade `alta`
- Issues de billing/checkpoint Replit → contatar Replit Support
- Issues de integrações externas (Z-API, Meta, OpenAI) → conferir status oficial dos providers
