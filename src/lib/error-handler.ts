// src/lib/error-handler.ts
import chalk from "chalk";
import { AxiosError } from "axios";

export function handleApiError(error: any) {
  if (error.isAxiosError) {
    const axiosError = error as AxiosError;
    if (axiosError.response) {
      console.log(
        chalk.red(`Error del servidor (${axiosError.response.status}):`),
      );
      const responseData = axiosError.response.data as any;
      if (responseData.message) {
        console.log(chalk.red(`  ${responseData.message}`));
      }
      if (responseData.errors) {
        responseData.errors.forEach((err: any) =>
          console.log(chalk.red(`  - ${err.path}: ${err.message}`)),
        );
      }
    } else if (axiosError.request) {
      console.log(chalk.red("Error de red: No se pudo conectar al servidor."));
      console.log(
        chalk.yellow(
          "Verifica que la URL del servidor es correcta con `flopy config get-url`.",
        ),
      );
    } else {
      console.log(
        chalk.red(
          "Error en la configuración de la petición:",
          axiosError.message,
        ),
      );
    }
  } else {
    console.log(chalk.red("Ocurrió un error inesperado:", error.message));
  }
}
