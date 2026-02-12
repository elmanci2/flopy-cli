#!/usr/bin/env node

import { Command } from "commander";
import { registerAuthCommands } from "./commands/auth";
import { registerAppCommands } from "./commands/app";
import { registerReleaseCommands } from "./commands/release";
import { registerConfigCommands } from "./commands/config";

const program = new Command();

const pkg = require("../package.json");

program
  .name("flopy")
  .description(
    "Una CLI profesional para gestionar el servicio de actualizaciones OTA Flopy",
  )
  .version(pkg.version)
  .usage("<command> [options]");

registerConfigCommands(program);
registerAuthCommands(program);
registerAppCommands(program);
registerReleaseCommands(program);

program.parse(process.argv);
