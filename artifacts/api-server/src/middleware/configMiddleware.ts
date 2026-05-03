import type { Request, Response, NextFunction } from "express";
import { configService } from "../services/configService";

interface ConfigRequest extends Request {
  config?: Record<string, string | null>;
}

const REQUIRED_SETTINGS: string[] = [];

export async function injectConfig(
  req: ConfigRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const config: Record<string, string | null> = {};

    for (const key of REQUIRED_SETTINGS) {
      const value = await configService.getSetting(key);
      if (value === null) {
        console.warn(`[config-middleware] Missing required setting: ${key}`);
      }
      config[key] = value;
    }

    req.config = config;
    next();
  } catch (error) {
    console.error("[config-middleware] Error injecting config:", error);
    res.status(503).json({ message: "Serviço de configuração indisponível" });
  }
}

export async function requireConfig(requiredKeys: string[]) {
  return async (req: ConfigRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const config: Record<string, string | null> = {};
      const missing: string[] = [];

      for (const key of requiredKeys) {
        const value = await configService.getSetting(key);
        if (value === null) {
          missing.push(key);
        }
        config[key] = value;
      }

      if (missing.length > 0) {
        res.status(503).json({
          message: "Configurações necessárias não encontradas",
          missing,
        });
        return;
      }

      req.config = config;
      next();
    } catch (error) {
      console.error("[config-middleware] Error:", error);
      res.status(503).json({ message: "Serviço de configuração indisponível" });
    }
  };
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const authReq = req as any;
  if (!authReq.user) {
    res.status(401).json({ message: "Não autenticado" });
    return;
  }
  next();
}
