import express from 'express';
import fs from 'fs';
import path from 'path';

const router = express.Router();

// Endpoint para download da documentação
router.get('/api/download-docs', (req, res) => {
  try {
    const filePath = path.join(process.cwd(), 'DOCUMENTACAO_COMPLETA.md');
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    
    // Retornar como arquivo para download
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="QUANTA_FLOW_DOCUMENTACAO.md"');
    res.send(fileContent);
  } catch (error) {
    res.status(500).json({ error: 'Arquivo não encontrado' });
  }
});

export default router;
