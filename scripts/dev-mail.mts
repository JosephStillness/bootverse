import { SMTPServer } from "smtp-server";
import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";

if (process.env.NODE_ENV === "production")
  throw new Error("Local mail capture must not run in production.");
await mkdir(".local/mail", { recursive: true, mode: 0o700 });
const server = new SMTPServer({
  authOptional: true,
  disabledCommands: ["STARTTLS", "AUTH"],
  logger: false,
  size: 1024 * 1024,
  onData(stream, _session, callback) {
    const chunks: Buffer[] = [];
    stream.on("data", (chunk: Buffer) => chunks.push(chunk));
    stream.on("end", async () => {
      if (stream.sizeExceeded) {
        callback(new Error("Message is too large."));
        return;
      }
      try {
        const path = `.local/mail/${randomUUID()}.eml`;
        await writeFile(path, Buffer.concat(chunks), { mode: 0o600 });
        console.log(
          `Local email saved to ${path}. Open it to use the verification link.`,
        );
        callback();
      } catch {
        callback(new Error("Could not save local email."));
      }
    });
    stream.on("error", callback);
  },
});
server.on("error", () => {
  console.error("Local SMTP could not start; check port 1025.");
  process.exitCode = 1;
});
server.listen(1025, "127.0.0.1", () =>
  console.log(
    "Development-only SMTP capture on 127.0.0.1:1025; no email is delivered externally.",
  ),
);
process.on("SIGINT", () => server.close());
process.on("SIGTERM", () => server.close());
