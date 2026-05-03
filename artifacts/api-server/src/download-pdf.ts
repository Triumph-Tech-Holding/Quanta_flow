import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const DATA_DIR = process.env.DATA_DIR ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

const router = express.Router();

router.get('/api/download-docs', (req, res) => {
  try {
    const filePath = path.join(DATA_DIR, 'DOCUMENTACAO_COMPLETA.md');
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="QUANTA_FLOW_DOCUMENTACAO.md"');
    res.send(fileContent);
  } catch (error) {
    res.status(500).json({ error: 'Arquivo não encontrado' });
  }
});

export default router;
