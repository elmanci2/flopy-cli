// src/commands/config.ts
import { Command } from "commander";
import config from "../lib/config-store";
import chalk from "chalk";

export function registerConfigCommands(program: Command) {
  const configCommand = program
    .command("config")
    .description("Gestiona la configuración de la CLI");

  configCommand
    .command("set-url <url>")
    .description("Establece la URL del servidor Flopy al que apuntará la CLI")
    .action((url: string) => {
      config.set("serverUrl", url);
      console.log(
        chalk.green(`✅ URL del servidor establecida a: ${chalk.bold(url)}`),
      );
    });

  configCommand
    .command("get-url")
    .description("Muestra la URL del servidor configurada actualmente")
    .action(() => {
      const url = config.get("serverUrl");
      if (url) {
        console.log(`La URL del servidor actual es: ${chalk.bold(url)}`);
      } else {
        console.log(chalk.yellow("La URL del servidor no está configurada."));
      }
    });
}
