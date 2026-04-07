import { Database } from "bun:sqlite";
import fs from "fs";
import path from "path";
const dbDir = path.join('.wrangler', 'state', 'v3', 'd1', 'miniflare-D1DatabaseObject');
const files = fs.readdirSync(dbDir);
const sqliteFile = files.find(f => f.endsWith('.sqlite'));
const db = new Database(path.join(dbDir, sqliteFile)); 
const res = db.query('SELECT u.nama, count(k.id) as count FROM kinerja_tindakan_peran k left join unit_pelayanan u on k.unit_id = u.id GROUP BY u.nama').all();
console.log("Kinerja data counts per unit:", res);
