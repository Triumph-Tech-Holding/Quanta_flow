import { log } from "../index";

interface CreateInstanceResponse {
  instance: {
    instanceName: string;
    instanceId: string;
    status: string;
  };
  hash: string;
  qrcode?: {
    base64: string;
  };
}

interface QRCodeResponse {
  pairingCode: string | null;
  code: string;
  base64: string;
  count: number;
}

interface ConnectionStatusResponse {
  instance: {
    instanceName: string;
    state: string;
  };
}

interface SendMessageResponse {
  key: {
    remoteJid: string;
    fromMe: boolean;
    id: string;
  };
  message: {
    conversation?: string;
  };
  messageTimestamp: string;
  status: string;
}

function getBaseUrl(): string {
  if (process.env.REPLIT_DEV_DOMAIN) {
    return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  }
  if (process.env.BASE_URL) {
    return process.env.BASE_URL;
  }
  return `http://localhost:${process.env.PORT || 5000}`;
}

export class EvolutionService {
  private evolutionUrl: string;
  private globalToken: string;

  constructor(evolutionUrl: string, globalToken: string) {
    this.evolutionUrl = evolutionUrl.replace(/\/$/, "");
    this.globalToken = globalToken;
  }

  private async request<T>(
    method: string,
    endpoint: string,
    body?: unknown,
    retries = 3
  ): Promise<T> {
    const url = `${this.evolutionUrl}${endpoint}`;
    
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const response = await fetch(url, {
          method,
          headers: {
            "Content-Type": "application/json",
            "apikey": this.globalToken,
          },
          body: body ? JSON.stringify(body) : undefined,
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Evolution API error: ${response.status} - ${errorText}`);
        }

        return await response.json() as T;
      } catch (error) {
        log(`Evolution API attempt ${attempt}/${retries} failed: ${error}`, "evolution");
        if (attempt === retries) {
          throw error;
        }
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
    throw new Error("Max retries reached");
  }

  async validateToken(): Promise<boolean> {
    try {
      await this.request<unknown>("GET", "/instance/fetchInstances");
      return true;
    } catch (error) {
      log(`Token validation failed: ${error}`, "evolution");
      return false;
    }
  }

  async createInstance(instanceName: string): Promise<CreateInstanceResponse> {
    const webhookUrl = `${getBaseUrl()}/webhooks/evolution`;
    log(`Creating instance with webhook URL: ${webhookUrl}`, "evolution");

    const payload = {
      instanceName,
      qrcode: true,
      integration: "WHATSAPP-BAILEYS",
      webhook: {
        url: webhookUrl,
        byEvents: true,
        base64: false,
        events: [
          "MESSAGES_UPSERT",
          "MESSAGES_UPDATE",
          "CONNECTION_UPDATE",
          "QRCODE_UPDATED"
        ],
      },
    };

    const response = await this.request<CreateInstanceResponse>(
      "POST",
      "/instance/create",
      payload
    );

    log(`Instance created: ${response.instance.instanceName}`, "evolution");
    return response;
  }

  async getQRCode(instanceName: string): Promise<QRCodeResponse | null> {
    try {
      const response = await this.request<QRCodeResponse>(
        "GET",
        `/instance/connect/${instanceName}`
      );
      return response;
    } catch (error) {
      log(`Failed to get QR Code: ${error}`, "evolution");
      return null;
    }
  }

  async getConnectionStatus(instanceName: string): Promise<string> {
    try {
      const response = await this.request<ConnectionStatusResponse>(
        "GET",
        `/instance/connectionState/${instanceName}`
      );
      return response.instance?.state || "disconnected";
    } catch (error) {
      log(`Failed to get connection status: ${error}`, "evolution");
      return "disconnected";
    }
  }

  async sendMessage(
    instanceName: string,
    phoneNumber: string,
    message: string
  ): Promise<SendMessageResponse> {
    const remoteJid = phoneNumber.includes("@s.whatsapp.net")
      ? phoneNumber
      : `${phoneNumber.replace(/\D/g, "")}@s.whatsapp.net`;

    const payload = {
      number: remoteJid,
      text: message,
    };

    const response = await this.request<SendMessageResponse>(
      "POST",
      `/message/sendText/${instanceName}`,
      payload
    );

    log(`Message sent to ${phoneNumber}`, "evolution");
    return response;
  }

  async deleteInstance(instanceName: string): Promise<void> {
    try {
      await this.request<unknown>(
        "DELETE",
        `/instance/delete/${instanceName}`
      );
      log(`Instance ${instanceName} deleted`, "evolution");
    } catch (error) {
      log(`Failed to delete instance: ${error}`, "evolution");
    }
  }
}

export function createEvolutionService(evolutionUrl: string, globalToken: string): EvolutionService {
  return new EvolutionService(evolutionUrl, globalToken);
}
