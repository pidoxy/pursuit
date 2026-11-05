// Prints a fictional import file with dates relative to today.
// Usage: node --experimental-strip-types scripts/demo-data.mjs > demo.json
import { demoMessages } from "../src/lib/demo.ts";

process.stdout.write(JSON.stringify({ messages: demoMessages() }, null, 2) + "\n");
