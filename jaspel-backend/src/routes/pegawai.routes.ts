import { Hono } from "hono";
import { getDb } from "../db";
import { PegawaiRepository } from "../repositories/pegawai.repository";
import { Bindings } from "../utils/types";

const app = new Hono<{ Bindings: Bindings }>();

app.get("/", async (c) => {
  const db = getDb(c.env.DB);
  const repo = new PegawaiRepository(db);
  const data = await repo.findAll();
  return c.json(data);
});

app.post("/", async (c) => {
  const db = getDb(c.env.DB);
  const repo = new PegawaiRepository(db);
  const body = await c.req.json();
  
  if (!body.id) {
    body.id = "pegawai_" + Date.now().toString();
  }
  
  const created = await repo.create(body);
  return c.json(created, 201);
});

app.put("/:id", async (c) => {
  const db = getDb(c.env.DB);
  const repo = new PegawaiRepository(db);
  const id = c.req.param("id");
  const body = await c.req.json();
  
  const updated = await repo.update(id, body);
  return c.json(updated);
});

app.delete("/:id", async (c) => {
  const db = getDb(c.env.DB);
  const repo = new PegawaiRepository(db);
  const id = c.req.param("id");
  
  const result = await repo.delete(id);
  return c.json(result);
});

export default app;
