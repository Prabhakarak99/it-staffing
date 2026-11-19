// Run inside the Fly app machine: creates the empty multi-company database TENANT_DB_NAME (or the name
// given as the first argument) on the same server as DATABASE_URL. Does nothing if it already exists.
const { Client } = require("pg");
const name = process.argv[2] || process.env.TENANT_DB_NAME;
if (!/^[a-z][a-z0-9_]{2,40}$/.test(name || "")) {
  console.error("Give the new database name (lowercase letters, digits, _)");
  process.exit(1);
}
const c = new Client({ connectionString: process.env.DATABASE_URL });
c.connect()
  .then(async () => {
    const { rows } = await c.query("select current_database() as cur, (select count(*)::int from pg_database where datname = $1) as n", [name]);
    if (rows[0].cur === name) throw new Error("That is the database the app already uses");
    if (rows[0].n) console.log(`Database ${name} already exists`);
    else {
      await c.query(`CREATE DATABASE "${name}"`);
      console.log(`Created database ${name}`);
    }
    await c.end();
  })
  .catch((e) => {
    console.error("ERR " + e.message);
    process.exit(1);
  });
