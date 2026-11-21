import "dotenv/config";
import mysql from "mysql2/promise";
import { readFile, readdir } from "node:fs/promises";
import { spawn } from "node:child_process";

// A disposable database is mandatory. Never run integration mutations on asset_tracker.
if (!process.env.DATABASE_URL)
  throw new Error(
    "DATABASE_URL is required to connect to the local test MySQL server."
  );
const source = new URL(process.env.DATABASE_URL);
if (!["127.0.0.1", "localhost", "[::1]"].includes(source.hostname))
  throw new Error(
    "Integration runner requires local MySQL. It will not create test databases on a remote server."
  );
const database = `asset_tracker_verification_test_${Date.now()}`;
const testUrl = new URL(source);
testUrl.pathname = `/${database}`;
const serverUrl = new URL(source);
serverUrl.pathname = "/";
let connection;
let created = false;
try {
  connection = await mysql.createConnection(serverUrl.toString());
  await connection.query(`CREATE DATABASE \`${database}\``);
  created = true;
  const testConnection = await mysql.createConnection({
    uri: testUrl.toString(),
    multipleStatements: true,
  });
  try {
    const migrations = (await readdir(new URL("../drizzle/", import.meta.url)))
      .filter(file => /^\d+_.+\.sql$/.test(file))
      .sort();
    for (const migration of migrations) {
      const sql = await readFile(
        new URL(`../drizzle/${migration}`, import.meta.url),
        "utf8"
      );
      await testConnection.query(
        sql.replaceAll("--> statement-breakpoint", "")
      );
    }
  } finally {
    await testConnection.end();
  }
  console.log(
    "Applied all migrations to a disposable physical verification test database."
  );
  const exitCode = await new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [
        "node_modules/vitest/vitest.mjs",
        "run",
        "server/physicalVerification.integration.test.ts",
      ],
      {
        stdio: "inherit",
        env: {
          ...process.env,
          DATABASE_URL: testUrl.toString(),
          VERIFICATION_TEST_DATABASE_URL: testUrl.toString(),
          APP_BASE_URL: "http://localhost:3000",
          NODE_ENV: "test",
        },
      }
    );
    child.on("error", reject);
    child.on("exit", code => resolve(code ?? 1));
  });
  process.exitCode = exitCode;
} finally {
  if (connection) {
    // The target name was created here and cannot refer to the application database.
    if (created)
      await connection.query(`DROP DATABASE IF EXISTS \`${database}\``);
    await connection.end();
    console.log("Removed the disposable physical verification test database.");
  }
}
