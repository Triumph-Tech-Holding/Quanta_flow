
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

