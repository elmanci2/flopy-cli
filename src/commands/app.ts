// src/commands/app.ts

import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import Table from "cli-table3";
import inquirer from "inquirer";
import apiClient from "../lib/api-client";
import { handleApiError } from "../lib/error-handler";
import { resolveAppId } from "../lib/app-resolver";

export function registerAppCommands(program: Command) {
  const appCommand = program
    .command("app")
    .description("Gestiona tus aplicaciones en Flopy");

  appCommand
    .command("list")
    .alias("ls")
    .description("Lista todas tus aplicaciones")
    .action(async () => {
      const spinner = ora("Obteniendo lista de aplicaciones...").start();
      try {
        const response = await apiClient.get("/apps");
        spinner.succeed("Aplicaciones encontradas:");

        const table = new Table({
          head: [
            chalk.cyan("Nombre"),
            chalk.cyan("ID de App"),
            chalk.cyan("API Key"),
          ],
          colWidths: [20, 30, 30],
        });

        response.data.forEach((app: any) => {
          table.push([app.name, app.id, app.apiKey]);
        });

        console.log(table.toString());
      } catch (error) {
        spinner.fail("No se pudieron obtener las aplicaciones.");
        handleApiError(error);
      }
    });

  appCommand
    .command("add <name>")
    .description("Crea una nueva aplicación")
    .action(async (name: string) => {
      const spinner = ora(`Creando aplicación '${name}'...`).start();
      try {
        const response = await apiClient.post("/apps", { name });
        spinner.succeed(chalk.green(`¡Aplicación '${name}' creada con éxito!`));
        console.log(`  ${chalk.bold("ID:")} ${response.data.id}`);
        console.log(`  ${chalk.bold("API Key:")} ${response.data.apiKey}`);
      } catch (error) {
        spinner.fail(`No se pudo crear la aplicación.`);
        handleApiError(error);
      }
    });

  appCommand
    .command("remove <appId>")
    .alias("rm")
    .description("Elimina una aplicación permanentemente")
    .action(async (appId: string) => {
      const { confirm } = await inquirer.prompt([
        {
          type: "confirm",
          name: "confirm",
          message: chalk.yellow(
            `¿Estás seguro de que quieres eliminar la aplicación con ID '${appId}'? Esta acción es irreversible.`,
          ),
          default: false,
        },
      ]);

      if (!confirm) {
        console.log(chalk.gray("Operación cancelada."));
        return;
      }

      const spinner = ora(`Eliminando aplicación '${appId}'...`).start();
      try {
        await apiClient.delete(`/apps/${appId}`);
        spinner.succeed(
          chalk.green(`Aplicación '${appId}' eliminada con éxito.`),
        );
      } catch (error) {
        spinner.fail(`No se pudo eliminar la aplicación.`);
        handleApiError(error);
      }
    });

  const deploymentCommand = appCommand
    .command("deployment")
    .description(
      "Gestiona las claves de despliegue (deployment keys) de una aplicación",
    );

  deploymentCommand
    .command("add <appName> <channel>")
    .description(
      "Crea una nueva clave de despliegue para un canal (ej. Staging, Production)",
    )
    .action(async (appName: string, channel: string) => {
      const appId = await resolveAppId(appName);
      if (!appId) return;

      const spinner = ora(
        `Creando clave para el canal '${channel}'...`,
      ).start();
      try {
        const response = await apiClient.post(`/apps/${appId}/deployments`, {
          channel,
        });
        spinner.succeed(chalk.green(`¡Clave de despliegue creada con éxito!`));
        console.log(`  ${chalk.bold("Canal:")} ${response.data.channel}`);
        console.log(
          `  ${chalk.bold("Clave:")} ${chalk.yellow(response.data.key)}`,
        );
        console.log(
          chalk.cyan(
            "\nCopia esta clave y pégala en la configuración de CodePush de tu app nativa.",
          ),
        );
      } catch (error) {
        spinner.fail("No se pudo crear la clave de despliegue.");
        handleApiError(error);
      }
    });

  deploymentCommand
    .command("list <appName>")
    .alias("ls")
    .description("Lista todas las claves de despliegue para una aplicación")
    .action(async (appName: string) => {
      const appId = await resolveAppId(appName);
      if (!appId) return;

      const spinner = ora(
        `Obteniendo claves de despliegue para '${appName}'...`,
      ).start();
      try {
        const response = await apiClient.get(`/apps/${appId}/deployments`);
        spinner.succeed(`Claves de despliegue para '${appName}':`);

        const table = new Table({
          head: [chalk.cyan("Canal"), chalk.cyan("Clave de Despliegue")],
          colWidths: [20, 40],
        });

        response.data.forEach((key: any) => {
          table.push([key.channel, key.key]);
        });

        console.log(table.toString());
      } catch (error) {
        spinner.fail("No se pudieron obtener las claves de despliegue.");
        handleApiError(error);
      }
    });
}
