// src/lib/bundler.ts
import shell from "shelljs";
import fs from "fs";
import path from "path";
import ora from "ora";
import chalk from "chalk";
import os from "os";

/**
 * Detecta si es un proyecto Expo
 */
function isExpoProject(): boolean {
  if (!fs.existsSync("package.json")) {
    return false;
  }
  const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  return !!(deps["expo"] || fs.existsSync("app.json") && hasExpoConfig());
}

/**
 * Verifica si app.json tiene configuración de Expo
 */
function hasExpoConfig(): boolean {
  try {
    if (fs.existsSync("app.json")) {
      const appConfig = JSON.parse(fs.readFileSync("app.json", "utf8"));
      return !!appConfig.expo;
    }
    if (fs.existsSync("app.config.js") || fs.existsSync("app.config.ts")) {
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

/**
 * Detecta la ruta de hermesc según la plataforma
 */
function getHermescPath(): string | null {
  const hermescPaths = {
    darwin: "node_modules/react-native/sdks/hermesc/osx-bin/hermesc",
    linux: "node_modules/react-native/sdks/hermesc/linux64-bin/hermesc",
    win32: "node_modules/react-native/sdks/hermesc/win64-bin/hermesc.exe",
  };

  const platform = os.platform() as keyof typeof hermescPaths;
  const hermescPath = hermescPaths[platform];

  if (!hermescPath) {
    return null;
  }

  const fullPath = path.join(process.cwd(), hermescPath);
  return fs.existsSync(fullPath) ? fullPath : null;
}

/**
 * Crea un bundle para proyectos Expo
 */
function createExpoBundle(spinner: ReturnType<typeof ora>): string | null {
  const buildDir = path.join(process.cwd(), "temp_flopy_build");
  if (fs.existsSync(buildDir)) shell.rm("-rf", buildDir);
  fs.mkdirSync(buildDir, { recursive: true });

  spinner.text = "Generando bundle de Expo...";

  // Expo usa `npx expo export` para generar bundles
  const exportDir = path.join(buildDir, "dist");
  const bundleCommand = `npx expo export --platform android --output-dir "${exportDir}"`;

  const result = shell.exec(bundleCommand, { silent: true });
  if (result.code !== 0) {
    // Intentar con el formato antiguo de expo
    spinner.text = "Intentando con expo export (formato alternativo)...";
    const altCommand = `npx expo export:embed --platform android --entry-file node_modules/expo/AppEntry.js --bundle-output "${path.join(buildDir, "index.android.bundle")}" --assets-dest "${buildDir}"`;

    if (shell.exec(altCommand, { silent: true }).code !== 0) {
      // Fallback a react-native bundle con entry-file de Expo
      spinner.text = "Usando react-native bundle con entry de Expo...";
      const entryFile = getExpoEntryFile();
      const rnBundleCommand = `npx react-native bundle --platform android --dev false --minify true --entry-file "${entryFile}" --bundle-output "${path.join(buildDir, "index.android.bundle")}" --assets-dest "${buildDir}"`;

      if (shell.exec(rnBundleCommand, { silent: true }).code !== 0) {
        spinner.fail("Error al crear el bundle de Expo.");
        console.log(
          chalk.red(
            "Asegúrate de que `npx expo export` o `npx react-native bundle` funciona en tu proyecto.",
          ),
        );
        shell.rm("-rf", buildDir);
        return null;
      }
    }
  }

  spinner.text = "Bundle de Expo creado. Comprimiendo en .zip...";

  const zipPath = path.join(process.cwd(), "flopy_bundle.zip");
  if (fs.existsSync(zipPath)) shell.rm(zipPath);

  // Determinar qué directorio comprimir
  const dirToZip = fs.existsSync(exportDir) ? exportDir : buildDir;

  shell.cd(dirToZip);
  if (shell.exec(`zip -r "${zipPath}" .`, { silent: true }).code !== 0) {
    spinner.fail("Error al comprimir el bundle.");
    console.log(
      chalk.red("Asegúrate de tener el comando `zip` instalado en tu sistema."),
    );
    shell.cd(process.cwd());
    shell.rm("-rf", buildDir);
    return null;
  }

  shell.cd(process.cwd());
  shell.rm("-rf", buildDir);

  const stats = fs.statSync(zipPath);
  const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);

  spinner.succeed(`Bundle de Expo creado con éxito (${sizeMB} MB)`);
  console.log(
    chalk.green(`✓ Bundle generado para proyecto Expo`),
  );

  return zipPath;
}

/**
 * Obtiene el entry file para proyectos Expo
 */
function getExpoEntryFile(): string {
  // Verificar si existe index.js personalizado
  if (fs.existsSync("index.js")) {
    return "index.js";
  }
  // Verificar App.js/App.tsx
  if (fs.existsSync("App.js") || fs.existsSync("App.tsx")) {
    return "node_modules/expo/AppEntry.js";
  }
  // Default de Expo
  return "node_modules/expo/AppEntry.js";
}

/**
 * Detecta un proyecto de React Native, ejecuta el bundle, lo compila a Hermes bytecode y lo comprime.
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

  // 2. Detectar si es un proyecto Expo
  if (isExpoProject()) {
    const spinner = ora(
      "Detectado proyecto Expo. Creando bundle...",
    ).start();
    return createExpoBundle(spinner);
  }

  const spinner = ora(
    "Detectado proyecto React Native. Creando bundle optimizado...",
  ).start();

  // 2. Verificar que hermesc esté disponible
  const hermescPath = getHermescPath();
  if (!hermescPath) {
    spinner.warn(
      "No se encontró hermesc. Creando bundle JS normal (sin bytecode de Hermes).",
    );
    return createRegularBundle(spinner);
  }

  // 3. Crear directorios temporales
  const buildDir = path.join(process.cwd(), "temp_flopy_build");
  if (fs.existsSync(buildDir)) shell.rm("-rf", buildDir);
  fs.mkdirSync(buildDir);

  const bundlePath = path.join(buildDir, "index.android.bundle");
  const sourceMapPath = path.join(buildDir, "index.android.bundle.map");

  // 4. Ejecutar el comando de bundle con minificación y source maps
  spinner.text = "Generando bundle de React Native...";
  const bundleCommand = `npx react-native bundle \
    --platform android \
    --dev false \
    --minify true \
    --entry-file index.js \
    --bundle-output ${bundlePath} \
    --sourcemap-output ${sourceMapPath} \
    --assets-dest ${buildDir}`;

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

  // 5. Compilar a Hermes bytecode
  spinner.text = "Compilando a bytecode de Hermes...";
  const hbcPath = path.join(buildDir, "index.android.bundle.hbc");
  const hbcMapPath = path.join(buildDir, "index.android.bundle.hbc.map");

  const hermesCommand = `"${hermescPath}" -O -emit-binary -output-source-map -out="${hbcPath}" "${bundlePath}"`;

  if (shell.exec(hermesCommand, { silent: true }).code !== 0) {
    spinner.fail("Error al compilar con Hermes.");
    console.log(
      chalk.red(
        "Falló la compilación de Hermes. Verifica que el bundle sea válido.",
      ),
    );
    shell.rm("-rf", buildDir);
    return null;
  }

  // 6. Reemplazar el bundle JS con el bytecode de Hermes
  shell.rm("-f", bundlePath);
  shell.mv(hbcPath, bundlePath);

  // 7. Componer source maps (opcional, para debugging)
  if (fs.existsSync(sourceMapPath) && fs.existsSync(hbcMapPath)) {
    spinner.text = "Componiendo source maps...";
    const packagerMapPath = path.join(
      buildDir,
      "index.android.bundle.packager.map",
    );
    shell.mv(sourceMapPath, packagerMapPath);

    const composeCommand = `node node_modules/react-native/scripts/compose-source-maps.js "${packagerMapPath}" "${hbcMapPath}" -o "${sourceMapPath}"`;

    shell.exec(composeCommand, { silent: true });

    // Limpiar archivos temporales de source maps
    shell.rm("-f", packagerMapPath);
    shell.rm("-f", hbcMapPath);
  }

  spinner.text = "Bundle Hermes creado. Comprimiendo en .zip...";

  // 8. Comprimir el resultado
  const zipPath = path.join(process.cwd(), "flopy_bundle.zip");
  if (fs.existsSync(zipPath)) shell.rm(zipPath);

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

  const stats = fs.statSync(zipPath);
  const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);

  spinner.succeed(`Bundle Hermes bytecode creado con éxito (${sizeMB} MB)`);
  console.log(
    chalk.green(
      `✓ Bundle pre-compilado con Hermes - no requiere parsing en runtime`,
    ),
  );

  return zipPath;
}

/**
 * Fallback: crea un bundle JS regular si Hermes no está disponible
 */
function createRegularBundle(spinner: any): string | null {
  const buildDir = path.join(process.cwd(), "temp_flopy_build");
  if (fs.existsSync(buildDir)) shell.rm("-rf", buildDir);
  fs.mkdirSync(buildDir);

  const bundlePath = path.join(buildDir, "index.android.bundle");

  spinner.text = "Creando bundle JS estándar...";
  const bundleCommand = `npx react-native bundle --platform android --dev false --minify true --entry-file index.js --bundle-output ${bundlePath} --assets-dest ${buildDir}`;

  if (shell.exec(bundleCommand, { silent: true }).code !== 0) {
    spinner.fail("Error al crear el bundle de React Native.");
    shell.rm("-rf", buildDir);
    return null;
  }

  spinner.text = "Bundle creado. Comprimiendo en .zip...";

  const zipPath = path.join(process.cwd(), "flopy_bundle.zip");
  if (fs.existsSync(zipPath)) shell.rm(zipPath);

  shell.cd(buildDir);
  if (shell.exec(`zip -r ${zipPath} .`, { silent: true }).code !== 0) {
    spinner.fail("Error al comprimir el bundle.");
    shell.cd("..");
    shell.rm("-rf", buildDir);
    return null;
  }

  shell.cd("..");
  shell.rm("-rf", buildDir);

  spinner.succeed("Bundle JS creado con éxito.");
  return zipPath;
}
