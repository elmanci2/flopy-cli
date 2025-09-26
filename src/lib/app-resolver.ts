// src/lib/app-resolver.ts
import apiClient from "./api-client";
import ora from "ora";

/**
 * Toma un nombre de app y devuelve su ID.
 * Si no se encuentra, manejará el error y terminará el proceso.
 * @param appName El nombre de la aplicación a buscar.
 * @returns El ID de la aplicación.
 */
export async function resolveAppId(appName: string): Promise<string | null> {
  const spinner = ora(`Buscando la aplicación '${appName}'...`).start();
  try {
    const response = await apiClient.get("/apps");
    const apps = response.data as any[];
    const foundApp = apps.find((app) => app.name === appName);

    if (foundApp) {
      spinner.succeed(
        `Aplicación '${appName}' encontrada (ID: ${foundApp.id}).`,
      );
      return foundApp.id;
    } else {
      spinner.fail(
        `Error: No se encontró ninguna aplicación con el nombre '${appName}'.`,
      );
      console.log("Puedes listar tus aplicaciones con `flopy app ls`.");
      return null;
    }
  } catch (error) {
    spinner.fail("No se pudieron obtener las aplicaciones del servidor.");
    return null; // El error ya será manejado por el interceptor
  }
}
