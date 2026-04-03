import { eq } from "drizzle-orm";
import { users } from "../db/schema";
import { DbClient } from "../db";

export class AuthRepository {
  constructor(private db: DbClient) {}

  async findByUsername(username: string) {
    const result = await this.db.select().from(users).where(eq(users.username, username)).limit(1);
    return result[0] || null;
  }
}
