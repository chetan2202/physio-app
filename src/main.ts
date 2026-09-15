import "./styles.css";
import { registerSW } from "virtual:pwa-register";
import { Repository } from "./storage/repository.js";
import { AppController } from "./ui/app.js";

async function boot(): Promise<void> {
  const root = document.querySelector<HTMLDivElement>("#app");
  if (!root) return;

  // Register the service worker (offline + updates). registerType is 'prompt', so a new
  // version waits until the user chooses to apply it.
  let controller: AppController | undefined;
  const updateSW = registerSW({
    onNeedRefresh() {
      controller?.showUpdateAvailable(() => void updateSW(true));
    },
  });

  try {
    const repo = new Repository();
    await repo.load();
    controller = new AppController(root, repo);
    controller.mount();
  } catch (err) {
    root.textContent = "Could not start the app.";
    console.error(err);
  }
}

void boot();
