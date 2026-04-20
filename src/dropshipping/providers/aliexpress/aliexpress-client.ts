import axios, { AxiosError, AxiosInstance } from "axios";
import { signRequest } from "./aliexpress-signer";
import type {
  AliExpressConfig,
  AliExpressErrorEnvelope,
  AliExpressRequest,
  AliExpressResponse,
  AliExpressSuccessEnvelope,
} from "./aliexpress.types";

const SYNC_PATH = "/sync";

export class AliExpressApiError extends Error {
  readonly name = "AliExpressApiError";
  constructor(
    readonly code: string,
    readonly subCode: string | undefined,
    message: string,
  ) {
    super(message);
  }
}

export class AliExpressClient {
  private readonly http: AxiosInstance;

  constructor(private readonly config: AliExpressConfig) {
    this.http = axios.create({
      baseURL: config.baseUrl,
      timeout: config.requestTimeoutMs,
      headers: { "content-type": "application/x-www-form-urlencoded" },
    });
  }

  async call<TBody>(request: AliExpressRequest): Promise<TBody> {
    const body = this.buildSignedBody(request);
    const response = await this.post(body);
    return this.unwrap<TBody>(response);
  }

  private buildSignedBody(request: AliExpressRequest): Record<string, string> {
    const params: Record<string, string | number | boolean | undefined> = {
      app_key: this.config.appKey,
      method: request.method,
      timestamp: formatTimestamp(new Date()),
      format: "json",
      sign_method: "hmac-sha256",
      v: "2.0",
      ...request.params,
    };
    const sign = signRequest({
      apiPath: SYNC_PATH,
      params,
      appSecret: this.config.appSecret,
    });
    const stringified: Record<string, string> = {};
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) stringified[key] = String(value);
    });
    stringified.sign = sign;
    return stringified;
  }

  private async post(body: Record<string, string>): Promise<unknown> {
    try {
      const response = await this.http.post<unknown>(
        SYNC_PATH,
        new URLSearchParams(body).toString(),
      );
      return response.data;
    } catch (error) {
      if (error instanceof AxiosError && error.response) {
        throw new Error(
          `HTTP ${error.response.status} from AliExpress: ${safeStringify(error.response.data)}`,
        );
      }
      throw error;
    }
  }

  private unwrap<TBody>(raw: unknown): TBody {
    const envelope = raw as AliExpressResponse<TBody>;
    if ("error_response" in envelope) {
      throw this.toError(envelope);
    }
    return (envelope as AliExpressSuccessEnvelope<TBody>).resp_result.result;
  }

  private toError(envelope: AliExpressErrorEnvelope): AliExpressApiError {
    const { code, msg, sub_code, sub_msg } = envelope.error_response;
    return new AliExpressApiError(
      String(code),
      sub_code,
      sub_msg ?? msg ?? "AliExpress API error",
    );
  }
}

function safeStringify(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function formatTimestamp(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = date.getUTCFullYear();
  const MM = pad(date.getUTCMonth() + 1);
  const dd = pad(date.getUTCDate());
  const HH = pad(date.getUTCHours());
  const mm = pad(date.getUTCMinutes());
  const ss = pad(date.getUTCSeconds());
  return `${yyyy}-${MM}-${dd} ${HH}:${mm}:${ss}`;
}
