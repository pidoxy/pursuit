export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.DISABLE_SCHEDULER === "true") return;
  const { syncAll } = await import("./lib/gmail");
  const { runBriefs } = await import("./lib/brief");
  const tick = async () => {
    try {
      await syncAll();
      await runBriefs();
    } catch (err) {
      console.error("[scheduler]", err);
    }
  };
  setInterval(tick, 15 * 60_000).unref();
  setTimeout(tick, 20_000).unref();
}
