// src/lib/api-client.ts
import axios from "axios";
import config from "./config-store";

const apiClient = axios.create();

apiClient.interceptors.request.use(
  (axiosConfig) => {
    const serverUrl = config.get("serverUrl");
    const token = config.get("token");

    if (!serverUrl) {
      throw new Error(
        "La URL del servidor no está configurada. Usa `flopy config set-url <url>` para configurarla.",
      );
    }

    axiosConfig.baseURL = serverUrl;

    if (token) {
      axiosConfig.headers["Authorization"] = `Bearer ${token}`;
    }

    return axiosConfig;
  },
  (error) => {
    return Promise.reject(error);
  },
);

export default apiClient;
