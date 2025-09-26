// src/lib/bundler.ts
import shell from "shelljs";
import fs from "fs";
import path from "path";
import ora from "ora";
import chalk from "chalk";

/**
 * Detecta un proyecto de React Native, ejecuta el bundle y lo comprime.
 * @returns La ruta al archivo .zip temporal creado, o null si falla.
 */
export function createBundleAndZip(): string | null {
  // 1. Detectar si estamos en un proyecto de React Native
  if (!fs.existsSync("package.json")) {
    return null;
  }
  const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
  if (!pkg.dependencies || !pkg.dependencies["react-native"]) {
    return null; // No es un proyecto de RN
  }

  const spinner = ora(
    "Detectado proyecto React Native. Creando bundle...",
  ).start();

  // 2. Crear directorios temporales
  const buildDir = path.join(process.cwd(), "temp_flopy_build");
  if (fs.existsSync(buildDir)) shell.rm("-rf", buildDir);
  fs.mkdirSync(buildDir);

  const bundlePath = path.join(buildDir, "index.android.bundle");

  // 3. Ejecutar el comando de bundle
  const bundleCommand = `npx react-native bundle --platform android --dev false --entry-file index.js --bundle-output ${bundlePath} --assets-dest ${buildDir}`;
  if (shell.exec(bundleCommand, { silent: true }).code !== 0) {
    spinner.fail("Error al crear el bundle de React Native.");
    console.log(
      chalk.red(
        "Asegúrate de que `npx react-native bundle` funciona en tu proyecto.",
      ),
    );
    shell.rm("-rf", buildDir);
    return null;
  }
  spinner.text = "Bundle creado. Comprimiendo en .zip...";

  // 4. Comprimir el resultado
  const zipPath = path.join(process.cwd(), "flopy_bundle.zip");
  if (fs.existsSync(zipPath)) shell.rm(zipPath);

  // `shell.cd()` cambia el directorio actual para el proceso
  shell.cd(buildDir);
  if (shell.exec(`zip -r ${zipPath} .`, { silent: true }).code !== 0) {
    spinner.fail("Error al comprimir el bundle.");
    console.log(
      chalk.red("Asegúrate de tener el comando `zip` instalado en tu sistema."),
    );
    shell.cd("..");
    shell.rm("-rf", buildDir);
    return null;
  }

  // Limpieza
  shell.cd("..");
  shell.rm("-rf", buildDir);

  spinner.succeed("Bundle y .zip creados con éxito.");
  return zipPath;
}
