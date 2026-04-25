import type { AxiosInstance } from "axios";
import axios from "axios";

export const AI_SERVICE_HTTP_CLIENT = "AI_SERVICE_HTTP_CLIENT";

export const aiServiceHttpClientProvider = {
  provide: AI_SERVICE_HTTP_CLIENT,
  useFactory: (): AxiosInstance => axios.create(),
};
