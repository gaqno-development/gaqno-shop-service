import { Injectable, Logger } from "@nestjs/common";
import type {
  GoogleTokenVerifier,
  GoogleUserProfile,
} from "./auth-oauth.service";

const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";
const REQUEST_TIMEOUT_MS = 5000;

interface GoogleUserInfoResponse {
  readonly sub?: string;
  readonly email?: string;
  readonly email_verified?: boolean;
  readonly name?: string;
  readonly given_name?: string;
  readonly family_name?: string;
  readonly picture?: string;
}

function isValidProfile(
  data: GoogleUserInfoResponse,
): data is Required<Pick<GoogleUserInfoResponse, "sub" | "email">> &
  GoogleUserInfoResponse {
  return typeof data.sub === "string" && typeof data.email === "string";
}

@Injectable()
export class GoogleTokenVerifierHttp implements GoogleTokenVerifier {
  private readonly logger = new Logger(GoogleTokenVerifierHttp.name);

  async verify(accessToken: string): Promise<GoogleUserProfile | null> {
    if (!accessToken) return null;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(GOOGLE_USERINFO_URL, {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: controller.signal,
      });
      if (!response.ok) {
        this.logger.warn(`Google userinfo rejected token: ${response.status}`);
        return null;
      }
      const data = (await response.json()) as GoogleUserInfoResponse;
      if (!isValidProfile(data)) {
        return null;
      }
      return {
        sub: data.sub,
        email: data.email,
        email_verified: Boolean(data.email_verified),
        name: data.name,
        given_name: data.given_name,
        family_name: data.family_name,
        picture: data.picture,
      };
    } catch (error) {
      this.logger.warn(
        `Google verification failed: ${(error as Error).message}`,
      );
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }
}
