import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { createServer } from "node:net";

const root = fileURLToPath(new URL("../", import.meta.url));
const app = resolve(
  root,
  "src-tauri/target/debug/bundle/macos/SkellySpeak Dev.app",
);
const identifier = "org.skellyspeak.practice";
const identity =
  process.env.SKELLYSPEAK_SIGNING_IDENTITY ?? "SkellySpeak Local Development";

function run(command: string, args: string[], capture = false): string {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    stdio: capture ? ["ignore", "pipe", "inherit"] : "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(`${command} failed (${result.signal ?? result.status}).`);
  return result.stdout ?? "";
}

function signingIdentity(): string {
  if (identity === "-")
    throw new Error(
      "Ad-hoc signing cannot preserve Keychain access across rebuilds. Select a certificate identity.",
    );
  // Self-signed local identities may be listed as untrusted; codesign and its
  // verification are authoritative. Never alter the user's certificate trust.
  const identities = run(
    "/usr/bin/security",
    ["find-identity", "-p", "codesigning"],
    true,
  );
  const matches = [
    ...identities.matchAll(/\) ([A-F0-9]{40}) "([^"]+)"/g),
  ].filter((match) => match[1] === identity || match[2] === identity);
  const fingerprints = [...new Set(matches.map((match) => match[1]!))];
  if (fingerprints.length !== 1) {
    throw new Error(
      `Expected one signing identity for "${identity}"; found ${fingerprints.length}. Check Keychain Access → My Certificates or set SKELLYSPEAK_SIGNING_IDENTITY to its SHA-1 fingerprint. No unsigned app will be launched.`,
    );
  }
  return fingerprints[0]!;
}

function bundle() {
  const metadata = JSON.parse(
    run(
      "cargo",
      [
        "metadata",
        "--manifest-path",
        "src-tauri/Cargo.toml",
        "--no-deps",
        "--format-version",
        "1",
      ],
      true,
    ),
  );
  const pkg = metadata.packages.find(
    (item: { name: string }) => item.name === "skellyspeak",
  );
  if (!pkg) throw new Error("SkellySpeak Cargo package is missing.");
  const binary = resolve(metadata.target_directory, "debug/skellyspeak");
  // Read before replacing the generated bundle so a missing build fails early.
  const executable = readFileSync(binary);
  rmSync(app, { recursive: true, force: true });
  mkdirSync(resolve(app, "Contents/MacOS"), { recursive: true });
  mkdirSync(resolve(app, "Contents/Resources"), { recursive: true });
  writeFileSync(resolve(app, "Contents/MacOS/skellyspeak"), executable, {
    mode: 0o755,
  });
  copyFileSync(
    resolve(root, "src-tauri/Info.plist"),
    resolve(app, "Contents/Info.plist"),
  );
  const properties: Record<string, string> = {
    CFBundleIdentifier: identifier,
    CFBundleName: "SkellySpeak Dev",
    CFBundleDisplayName: "SkellySpeak Dev",
    CFBundleExecutable: "skellyspeak",
    CFBundlePackageType: "APPL",
    CFBundleShortVersionString: pkg.version,
    CFBundleVersion: pkg.version,
    NSHighResolutionCapable: "true",
  };
  for (const [key, value] of Object.entries(properties)) {
    run("/usr/bin/plutil", [
      "-insert",
      key,
      key === "NSHighResolutionCapable" ? "-bool" : "-string",
      value,
      resolve(app, "Contents/Info.plist"),
    ]);
  }
  run("/usr/bin/plutil", ["-lint", resolve(app, "Contents/Info.plist")]);
  console.log(`Development bundle: ${app}`);
}

function sign(fingerprint = signingIdentity()) {
  run("/usr/bin/codesign", [
    "--force",
    "--sign",
    fingerprint,
    "--identifier",
    identifier,
    "--timestamp=none",
    app,
  ]);
  run("/usr/bin/codesign", [
    "--verify",
    "--deep",
    "--strict",
    "--verbose=2",
    app,
  ]);
  run("/usr/bin/codesign", ["--display", "--requirements", "-", app]);
}

function completion(child: ChildProcess): Promise<void> {
  return new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) =>
      code === 0
        ? resolve()
        : reject(new Error(`Child process exited (${signal ?? code}).`)),
    );
  });
}

async function launch() {
  const fingerprint = signingIdentity();
  // Do not accidentally use another checkout's Vite server.
  await new Promise<void>((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(1420, "127.0.0.1", () =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  });
  run("cargo", [
    "build",
    "--manifest-path",
    "src-tauri/Cargo.toml",
    "--bin",
    "skellyspeak",
  ]);
  bundle();
  sign(fingerprint);
  const vite = spawn(
    process.execPath,
    ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1"],
    { cwd: root, stdio: "inherit" },
  );
  const viteDone = completion(vite);
  const viteStopped = viteDone.then(() => {
    throw new Error("Vite stopped before the app exited.");
  });
  // Attach the failure handler immediately while readiness is being checked.
  void viteStopped.catch(() => {});
  let native: ChildProcess | undefined;
  let nativeDone: Promise<void> | undefined;
  const readiness = new AbortController();
  const stop = () => {
    readiness.abort();
    native?.kill("SIGTERM");
    vite.kill("SIGTERM");
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  try {
    const ready = async () => {
      for (let attempt = 0; attempt < 60; attempt++) {
        readiness.signal.throwIfAborted();
        try {
          const response = await fetch("http://127.0.0.1:1420/", {
            signal: AbortSignal.any([
              readiness.signal,
              AbortSignal.timeout(500),
            ]),
          });
          if (!response.ok)
            throw new Error(`Vite returned HTTP ${response.status}.`);
          return;
        } catch (error) {
          if (!(error instanceof TypeError) && !(error instanceof DOMException))
            throw error;
        }
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      throw new Error("Vite did not become ready after 60 attempts.");
    };
    await Promise.race([ready(), viteStopped]);
    // Run the signed bundle executable so logs, exit status and IDE Stop stay
    // attached to this launcher. macOS resolves its enclosing app's Info.plist.
    native = spawn(resolve(app, "Contents/MacOS/skellyspeak"), [], {
      cwd: root,
      stdio: "inherit",
    });
    nativeDone = completion(native);
    await Promise.race([nativeDone, viteStopped]);
  } finally {
    stop();
    await viteDone.catch(() => {});
    await nativeDone?.catch(() => {});
    process.removeListener("SIGINT", stop);
    process.removeListener("SIGTERM", stop);
  }
}

try {
  if (process.platform !== "darwin")
    throw new Error("This launcher requires macOS.");
  switch (process.argv[2]) {
    case "bundle":
      bundle();
      break;
    case "sign":
      sign();
      break;
    case "launch":
      await launch();
      break;
    default:
      throw new Error("Usage: node scripts/macos-dev.ts launch|bundle|sign");
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
