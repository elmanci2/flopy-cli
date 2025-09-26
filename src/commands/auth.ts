// src/commands/auth.ts

import { Command } from "commander";
import inquirer from "inquirer";
import chalk from "chalk";
import ora from "ora";
import config from "../lib/config-store";
import apiClient from "../lib/api-client";
import { handleApiError } from "../lib/error-handler";

export function registerAuthCommands(program: Command) {
  const authCommand = program
    .command("auth")
    .description("Gestiona la autenticación con el servidor Flopy");

  // --- ¡NUEVO COMANDO! ---
  authCommand
    .command("register")
    .description("Crea una nueva cuenta de usuario en el servidor Flopy")
    .action(async () => {
      console.log(chalk.bold("Vamos a crear tu nueva cuenta de Flopy."));
      const answers = await inquirer.prompt([
        { type: "input", name: "email", message: "Introduce tu email:" },
        {
          type: "password",
          name: "password",
          message: "Crea una contraseña:",
          mask: "*",
        },
        {
          type: "password",
          name: "confirmPassword",
          message: "Confirma tu contraseña:",
          mask: "*",
        },
      ]);

      // Validación local antes de llamar a la API
      if (answers.password !== answers.confirmPassword) {
        console.log(
          chalk.red(
            "Error: Las contraseñas no coinciden. Por favor, inténtalo de nuevo.",
          ),
        );
        return;
      }
      if (answers.password.length < 8) {
        console.log(
          chalk.red("Error: La contraseña debe tener al menos 8 caracteres."),
        );
        return;
      }

      const spinner = ora("Registrando tu cuenta...").start();
      try {
        await apiClient.post("/auth/register", {
          email: answers.email,
          password: answers.password,
        });

        spinner.succeed(chalk.green("¡Cuenta creada con éxito!"));
        console.log(
          chalk.cyan("Ahora puedes iniciar sesión con el comando: ") +
            chalk.bold.white("flopy auth login"),
        );
      } catch (error) {
        spinner.fail("No se pudo registrar la cuenta.");
        // Nuestro manejador de errores se encargará de mostrar si el email ya existe (409)
        handleApiError(error);
      }
    });

  authCommand
    .command("login")
    .description("Inicia sesión en el servidor Flopy")
    .action(async () => {
      const answers = await inquirer.prompt([
        { type: "input", name: "email", message: "Introduce tu email:" },
        {
          type: "password",
          name: "password",
          message: "Introduce tu contraseña:",
          mask: "*",
        },
      ]);

      const spinner = ora("Iniciando sesión...").start();
      try {
        const response = await apiClient.post("/auth/login", {
          email: answers.email,
          password: answers.password,
        });

        const token = response.data.token;
        config.set("token", token);
        spinner.succeed(chalk.green(`¡Login exitoso! Bienvenido.`));
      } catch (error) {
        spinner.fail("Fallo en el inicio de sesión.");
        handleApiError(error);
      }
    });

  authCommand
    .command("logout")
    .description("Cierra la sesión actual")
    .action(() => {
      config.delete("token");
      console.log(chalk.green("Has cerrado sesión."));
    });

  authCommand
    .command("whoami")
    .description("Muestra si tienes una sesión activa")
    .action(async () => {
      const token = config.get("token");
      if (!token) {
        console.log(
          chalk.yellow("No has iniciado sesión. Usa `flopy auth login`."),
        );
        return;
      }

      const spinner = ora("Verificando sesión...").start();
      try {
        await apiClient.get("/apps"); // Usamos una ruta protegida para validar el token
        spinner.succeed(chalk.green(`Tu sesión actual es válida.`));
      } catch (error) {
        spinner.fail("La sesión no es válida o ha expirado.");
        handleApiError(error);
      }
    });
}
