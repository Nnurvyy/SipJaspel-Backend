import { Database } from "bun:sqlite";
import fs from "fs";
import path from "path";
const dbDir = path.join('.wrangler', 'state', 'v3', 'd1', 'miniflare-D1DatabaseObject');
const files = fs.readdirSync(dbDir);
const sqliteFile = files.find(f => f.endsWith('.sqlite'));
const db = new Database(path.join(dbDir, sqliteFile)); 
console.log(db.query('SELECT nama FROM unit_pelayanan').all());
