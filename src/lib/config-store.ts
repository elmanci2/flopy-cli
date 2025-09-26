// src/lib/config-store.ts
import Conf from "conf";

interface ConfigSchema {
  serverUrl?: string;
  token?: string;
}

const config = new Conf<ConfigSchema>({ projectName: "flopy-cli" });

export default config;
