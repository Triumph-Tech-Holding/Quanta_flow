

> 🕒 **Última atualização:** v0.5.0 — 27/05/2026, 16:43 (BRT)
## [0.5.0] — 2026-05-27

### Adicionado
- Endpoint de metadata da documentação e exibição do timestamp "Última atualização" nas páginas de documentação.
- Automação de atualização de documentação: scripts que geram/atualizam docs e realizam push no GitHub após merges (inclui hook/post-merge e utilitários em scripts/).
- Integração de um fluxo assistido por IA para sugerir/atualizar automaticamente a documentação e empurrar mudanças para o repositório.
- Rastreamento de entrega por mensagem em campanhas: persistência do status por mensagem, contagem de falhas por campanha e notificação ao operador quando limites configuráveis são atingidos.
- Exibição do número de telefone do remetente nas interfaces de campanha/inbox e recurso de errata para envio de mensagens corretivas.
- Suporte a anexos para variantes de mensagem de campanha (upload, armazenamento e vinculação de arquivos às variantes).
- Visualização e download do manual do usuário em PDF diretamente da interface administrativa.
- Builder de landing pages públicas e página de configurações da empresa para branding/customização.
- Gamificação e motor de pontuação para rastreamento de progresso; testes automatizados iniciais para o score engine.

### Modificado
- Workers, rotas e camada de storage atualizados para suportar o novo fluxo de rastreamento de entrega e tratamento de attachments.
- Comunicação em tempo real refatorada: socket no servidor e hook no front-end adaptados para emissão/consumo de eventos de status de entrega; UI atualizada para exibir status e controles de errata.
- Reorganização e ampliação da documentação técnica (novas referências) e inclusão de metadados de docs; scripts de repositório ajustados para automação contínua (scripts/src/update-docs.ts, github-push.sh, package.json).
- Atualização da senha do administrador nas configurações para corresponder às credenciais vigentes.

### Corrigido
- Correção de falhas na geração de PDFs causadas por arquivos de fonte, melhorando criação e download do manual.
- Correções de tipagem, validações e tratamento de erros na API para aumentar robustez.
- Ajustes de compatibilidade em componentes de UI e esquemas de banco de dados.

---

## [0.4.0] — 2026-05-27

### Adicionado
- Rastreamento de entrega por mensagem em campanhas: persistência de status por mensagem, contagem de falhas por campanha e marcação automática de campanha como "falha" quando limites configuráveis são atingidos, com notificações ao operador.
- Suporte a anexos nas variantes de mensagem de campanha (upload, armazenamento e vinculação de arquivos às variantes).
- Exibição do número do remetente nas interfaces de campanha e inbox e recurso de errata para envio de mensagens corretivas/retificativas.
- Visualização e download do manual do usuário em PDF a partir da interface administrativa.
- Builder de landing pages para criação de sites públicos e página de configurações da empresa para branding/customização.
- Testes automatizados e funcionalidades de gamificação/motor de pontuação para rastreamento de progresso e performance.

### Modificado
- Worker, rotas e camada de storage atualizados para suportar o novo fluxo de rastreamento de entrega e o tratamento de anexos (ex.: mudanças em workers, routes e storage).
- Comunicação em tempo real reforçada: socket no servidor e hook no front-end refatorados para emissão/consumo de eventos de status de entrega; UI atualizada para exibir status de entrega, remetente e controles de errata (ex.: socket.ts, useSocket.ts, componentes de Inbox).
- Documentação técnica reorganizada e ampliada com referências; adicionado mecanismo automatizado para gerar/atualizar docs e empurrar mudanças para o GitHub (scripts/).
- Scripts de repositório e automações ajustados (post-merge, package.json, scripts/src/update-docs.ts, scripts/src/github-push.sh) para automatizar atualizações de documentação após merges.
- Atualização da senha de administrador nas configurações para corresponder às credenciais vigentes.

### Corrigido
- Geração de PDF: resolução de falhas causadas por arquivos de fonte, melhorando criação e download do manual.
- Correções de tipagem e aumento da robustez da API (validações e tratamento de erros aprimorados).
- Correções de compatibilidade em componentes de UI e definições de esquema do banco de dados.

---

## [0.3.0] — 2026-05-27



---

## [0.2.0] — 2026-05-27

### Adicionado
- Rastreamento de entrega por mensagem em campanhas: persistência do status por mensagem, contagem de falhas por campanha e marcação automática de campanha como "falha" ao atingir limites configuráveis, com notificações ao operador.
- Suporte a anexos em variantes de mensagem de campanha (upload, armazenamento e vinculação de arquivos às variantes).
- Exibição do número do remetente nas interfaces de campanha e inbox, e recurso de errata para envio de mensagens de correção/retificação.
- Visualização e download do manual do usuário em PDF a partir da interface administrativa; automação de atualização de documentação (scripts e integração para gerar/atualizar docs).
- Testes automatizados adicionados e melhorias no motor de pontuação/gamificação para rastreamento de progresso e performance.
- Builder de landing pages e página de configurações da empresa (branding) para criação de sites públicos e customização da marca.

### Modificado
- Worker, rotas e camada de storage atualizados para suportar o novo fluxo de rastreamento de entrega e o tratamento de anexos (ex.: campaignWorker.ts, storage.ts).
- Comunicação em tempo real reforçada: socket e hook de frontend refatorados para emitir/consumir eventos de status de entrega; front-end atualizado para exibir status de entrega, número do remetente e controles de errata (ex.: socket.ts, useSocket.ts, admin-campaigns.tsx, ChatWindow.tsx).
- Documentação técnica reorganizada e ampliada com referências e instruções de acesso; inclusão do manual do usuário e guias técnicos no repositório.
- Scripts de repositório e automação ajustados (post-merge, package.json) e senha de admin atualizada para corresponder às credenciais vigentes.

### Corrigido
- Geração de PDF: resolução de falhas causadas por arquivos de fonte, melhorando a criação e o download do manual.
- Correções de tipagem e aumento da robustez da API (validações e tratamento de erros aprimorados).
- Problemas de compatibilidade em componentes de UI e nas definições de esquema do banco de dados corrigidos.

---

## [0.1.0] — 2026-05-27

### Adicionado
- Rastreamento de entrega por mensagem em campanhas: persistência de status por mensagem e marcação automática de campanhas como "falha" ao atingir limites configurados, com notificações para o operador.
- Suporte a anexos em variantes de mensagem de campanha (upload e associação de arquivos às variantes).
- Exibição do número do remetente nas interfaces de campanha e na inbox; recurso de "errata" em campanhas para envio de mensagens de correção.
- Visualização e download do manual do usuário em PDF a partir da interface administrativa; guia do usuário e documentação técnica incorporados ao projeto.
- Testes automatizados adicionados e melhorias no motor de pontuação/gamificação para tracking de progresso e performance.

### Modificado
- Worker, rotas e armazenamento: campaignWorker.ts, routes.ts e storage.ts atualizados para suportar o novo fluxo de rastreamento de entrega e o tratamento de anexos.
- Websocket e hook de socket: socket.ts e useSocket.ts adaptados para emitir e consumir eventos de status de entrega em tempo real.
- UI: ChatWindow.tsx e ConversationList.tsx alterados para mostrar status de entrega, número do remetente e controles de errata; admin-campaigns.tsx ajustada para novas funcionalidades.
- Documentação: atualização e reorganização da documentação técnica com referências e instruções de acesso; inclusão de documentação detalhada do sistema CRM e do builder de landing pages.
- Scripts e configuração: atualização de scripts de repositório (scripts/post-merge.sh, package.json) e ajuste da senha admin para corresponder às credenciais atuais.

### Corrigido
- Geração de PDF: resolução de falhas causadas por arquivos de fonte, melhorando a geração e download de manuais.
- Correções de tipagem e aumento da robustez da API (erros de tipos e validações tratados).
- Problemas de compatibilidade em componentes de UI e nas definições de esquema do banco de dados corrigidos.

---

