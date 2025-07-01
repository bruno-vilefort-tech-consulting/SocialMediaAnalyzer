import { type User, type InsertUser } from "@shared/schema";
import { db } from "./db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcrypt";

export interface IAuthStorage {
  // Authentication methods using PostgreSQL
  getUserById(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  validateUserPassword(email: string, password: string): Promise<User | null>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, user: Partial<User>): Promise<User>;
  deleteUser(id: string): Promise<void>;
  getUsers(): Promise<User[]>;
}

class AuthStorage implements IAuthStorage {
  private generateId(): string {
    return Date.now().toString();
  }

  async getUserById(id: string): Promise<User | undefined> {
    try {
      if (!db) {
        console.error('Database connection not available');
        return undefined;
      }
      const [user] = await db.select().from(users).where(eq(users.id, id));
      return user || undefined;
    } catch (error) {
      console.error('Erro ao buscar usuário:', error);
      return undefined;
    }
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    try {
      if (!db) {
        console.error('Database connection not available');
        return undefined;
      }
      const [user] = await db.select().from(users).where(eq(users.email, email));
      return user || undefined;
    } catch (error) {
      console.error('Erro ao buscar usuário por email:', error);
      return undefined;
    }
  }

  async validateUserPassword(email: string, password: string): Promise<User | null> {
    try {
      const user = await this.getUserByEmail(email);
      if (!user) return null;
      
      const isValid = await bcrypt.compare(password, user.password);
      return isValid ? user : null;
    } catch (error) {
      console.error('Erro ao validar senha:', error);
      return null;
    }
  }

  async createUser(user: InsertUser): Promise<User> {
    try {
      if (!db) throw new Error('Database connection not available');
      
      const hashedPassword = await bcrypt.hash(user.password, 10);
      const id = this.generateId();
      
      const newUser = {
        id,
        ...user,
        password: hashedPassword,
        createdAt: new Date(),
      };

      await db.insert(users).values(newUser);
      return newUser as User;
    } catch (error) {
      console.error('Erro ao criar usuário:', error);
      throw error;
    }
  }

  async updateUser(id: string, user: Partial<User>): Promise<User> {
    try {
      if (!db) throw new Error('Database connection not available');
      
      if (user.password) {
        user.password = await bcrypt.hash(user.password, 10);
      }

      const [updatedUser] = await db
        .update(users)
        .set(user)
        .where(eq(users.id, id))
        .returning();
      
      return updatedUser;
    } catch (error) {
      console.error('Erro ao atualizar usuário:', error);
      throw error;
    }
  }

  async deleteUser(id: string): Promise<void> {
    try {
      if (!db) throw new Error('Database connection not available');
      await db.delete(users).where(eq(users.id, id));
    } catch (error) {
      console.error('Erro ao deletar usuário:', error);
      throw error;
    }
  }

  async getUsers(): Promise<User[]> {
    try {
      if (!db) {
        console.error('Database connection not available');
        return [];
      }
      return await db.select().from(users);
    } catch (error) {
      console.error('Erro ao buscar usuários:', error);
      return [];
    }
  }
}

export const authStorage = new AuthStorage();