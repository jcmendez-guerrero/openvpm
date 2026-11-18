type ShellKey =
  | "shell.unsupported"
  | "shell.notReady"
  | "shell.timeout"
  | "shell.failed"
  | "shell.notReadyShort"
  | "shell.verifyFailed"
  | "shell.missing";

export async function prepareOfflineShell(
  t: (key: ShellKey) => string,
): Promise<void> {
  if (!window.isSecureContext || !("serviceWorker" in navigator))
    throw new Error(
      t("shell.unsupported"),
    );
  const registration = await navigator.serviceWorker.register(
    "/offline/sw.js",
    { scope: "/offline/", updateViaCache: "none" },
  );
  if (registration.active) return checkInstalled(registration.active, t);
  const worker = registration.installing ?? registration.waiting;
  if (!worker)
    throw new Error(
      t("shell.notReady"),
    );
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(
        new Error(
          t("shell.timeout"),
        ),
      );
    }, 20_000);
    const cleanup = () => {
      clearTimeout(timeout);
      worker.removeEventListener("statechange", check);
    };
    const check = () => {
      if (worker.state === "activated") {
        cleanup();
        resolve();
      }
      if (worker.state === "redundant") {
        cleanup();
        reject(
          new Error(
            t("shell.failed"),
          ),
        );
      }
    };
    worker.addEventListener("statechange", check);
    check();
  });
  if (!registration.active) throw new Error(t("shell.notReadyShort"));
  await checkInstalled(registration.active, t);
}

async function checkInstalled(
  worker: ServiceWorker,
  t: (key: ShellKey) => string,
) {
  await new Promise<void>((resolve, reject) => {
    const channel = new MessageChannel();
    const timeout = setTimeout(() => {
      channel.port1.close();
      reject(
        new Error(
          t("shell.verifyFailed"),
        ),
      );
    }, 10_000);
    channel.port1.onmessage = (event) => {
      clearTimeout(timeout);
      channel.port1.close();
      if (event.data?.ready === true && event.data.schema === 1) resolve();
      else
        reject(
          new Error(
            t("shell.missing"),
          ),
        );
    };
    worker.postMessage({ type: "CHECK_OFFLINE_SHELL" }, [channel.port2]);
  });
}
