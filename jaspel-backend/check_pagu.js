import { Database } from "bun:sqlite";
import fs from "fs";
import path from "path";
const dbDir = path.join('.wrangler', 'state', 'v3', 'd1', 'miniflare-D1DatabaseObject');
const files = fs.readdirSync(dbDir);
const sqliteFile = files.find(f => f.endsWith('.sqlite'));
const db = new Database(path.join(dbDir, sqliteFile)); 
const pagus = db.query('SELECT u.nama, count(p.id) as count FROM pagu_unit_peran p left join unit_pelayanan u on p.unit_id = u.id GROUP BY u.nama').all();
console.log("Pagu data counts per unit:", pagus);
