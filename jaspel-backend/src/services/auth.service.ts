import { sign } from "hono/jwt";
import { AuthRepository } from "../repositories/auth.repository";

export class AuthService {
  constructor(private authRepo: AuthRepository) {}

  async login(username: string, passwordHash: string, jwtSecret: string) {
    const user = await this.authRepo.findByUsername(username);
    
    if (!user || user.passwordHash !== passwordHash) {
      return null;
    }

    const payload = {
      sub: user.username,
      role: user.role,
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24, // 1 day
    };

    const token = await sign(payload, jwtSecret);
    return token;
  }
}
