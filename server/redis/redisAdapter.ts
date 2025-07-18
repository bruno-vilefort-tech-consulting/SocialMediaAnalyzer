/**
 * Redis Adapter - Adaptador para usar Redis Simulator com BullMQ
 * Implementa interface compatível com ioredis
 */

import { redisSimulator } from './redisSimulator.js';

export class RedisAdapter {
  private simulator = redisSimulator;
  public status = 'ready';

  constructor() {
    // Inicializar automaticamente
    this.simulator.connect();
  }

  // Métodos básicos do Redis
  async set(key: string, value: any, ...args: any[]): Promise<string> {
    // Parse argumentos opcionais (EX, PX, etc.)
    const options: any = {};
    
    for (let i = 0; i < args.length; i += 2) {
      const flag = args[i];
      const flagValue = args[i + 1];
      
      if (flag === 'EX' && typeof flagValue === 'number') {
        options.EX = flagValue;
      }
    }
    
    return this.simulator.set(key, value, options);
  }

  async get(key: string): Promise<string | null> {
    return this.simulator.get(key);
  }

  async del(key: string): Promise<number> {
    return this.simulator.del(key);
  }

  async exists(key: string): Promise<number> {
    return this.simulator.exists(key);
  }

  async expire(key: string, seconds: number): Promise<number> {
    // Simular expiração definindo tempo de vida
    const value = await this.simulator.get(key);
    if (value) {
      await this.simulator.set(key, JSON.parse(value), { EX: seconds });
      return 1;
    }
    return 0;
  }

  async ttl(key: string): Promise<number> {
    // Retornar -1 para chaves sem expiração, -2 para chaves que não existem
    const exists = await this.simulator.exists(key);
    return exists ? -1 : -2;
  }

  // Métodos de hash
  async hset(key: string, field: string, value: any): Promise<number> {
    return this.simulator.hset(key, field, value);
  }

  async hget(key: string, field: string): Promise<string | null> {
    return this.simulator.hget(key, field);
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    return this.simulator.hgetall(key);
  }

  async hincrby(key: string, field: string, increment: number): Promise<number> {
    return this.simulator.hincrby(key, field, increment);
  }

  async hdel(key: string, ...fields: string[]): Promise<number> {
    let deleted = 0;
    const hash = await this.simulator.hgetall(key);
    
    if (Object.keys(hash).length > 0) {
      for (const field of fields) {
        if (field in hash) {
          delete hash[field];
          deleted++;
        }
      }
      
      if (Object.keys(hash).length === 0) {
        await this.simulator.del(key);
      } else {
        // Recriar hash sem os campos deletados
        await this.simulator.del(key);
        for (const [field, value] of Object.entries(hash)) {
          await this.simulator.hset(key, field, value);
        }
      }
    }
    
    return deleted;
  }

  // Métodos de lista
  async lpush(key: string, ...values: any[]): Promise<number> {
    return this.simulator.lpush(key, ...values);
  }

  async rpush(key: string, ...values: any[]): Promise<number> {
    // Implementar rpush usando lpush e reordenação
    const currentData = await this.simulator.get(key);
    const list = currentData ? JSON.parse(currentData) : [];
    
    values.forEach(value => list.push(value));
    await this.simulator.set(key, list);
    
    return list.length;
  }

  async lpop(key: string): Promise<string | null> {
    const currentData = await this.simulator.get(key);
    if (!currentData) return null;
    
    const list = JSON.parse(currentData);
    if (list.length === 0) return null;
    
    const value = list.shift();
    await this.simulator.set(key, list);
    
    return value;
  }

  async rpop(key: string): Promise<string | null> {
    return this.simulator.rpop(key);
  }

  async llen(key: string): Promise<number> {
    return this.simulator.llen(key);
  }

  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    const currentData = await this.simulator.get(key);
    if (!currentData) return [];
    
    const list = JSON.parse(currentData);
    
    // Tratar índices negativos
    const len = list.length;
    const startIdx = start < 0 ? Math.max(0, len + start) : Math.min(start, len);
    const stopIdx = stop < 0 ? Math.max(-1, len + stop) : Math.min(stop, len - 1);
    
    if (startIdx > stopIdx) return [];
    
    return list.slice(startIdx, stopIdx + 1);
  }

  async lrem(key: string, count: number, element: any): Promise<number> {
    const currentData = await this.simulator.get(key);
    if (!currentData) return 0;
    
    const list = JSON.parse(currentData);
    let removed = 0;
    
    if (count === 0) {
      // Remover todas as ocorrências
      const newList = list.filter((item: any) => {
        if (item === element) {
          removed++;
          return false;
        }
        return true;
      });
      await this.simulator.set(key, newList);
    } else if (count > 0) {
      // Remover N ocorrências do início
      const newList = [];
      let toRemove = count;
      
      for (const item of list) {
        if (item === element && toRemove > 0) {
          toRemove--;
          removed++;
        } else {
          newList.push(item);
        }
      }
      await this.simulator.set(key, newList);
    } else {
      // Remover N ocorrências do final
      const newList = [...list];
      let toRemove = Math.abs(count);
      
      for (let i = newList.length - 1; i >= 0 && toRemove > 0; i--) {
        if (newList[i] === element) {
          newList.splice(i, 1);
          toRemove--;
          removed++;
        }
      }
      await this.simulator.set(key, newList);
    }
    
    return removed;
  }

  // Métodos de sorted sets (implementação básica)
  async zadd(key: string, score: number, member: string): Promise<number> {
    const currentData = await this.simulator.get(key);
    const sortedSet = currentData ? JSON.parse(currentData) : {};
    
    const wasNew = !(member in sortedSet);
    sortedSet[member] = score;
    
    await this.simulator.set(key, sortedSet);
    return wasNew ? 1 : 0;
  }

  async zrange(key: string, start: number, stop: number, withScores?: boolean): Promise<string[]> {
    const currentData = await this.simulator.get(key);
    if (!currentData) return [];
    
    const sortedSet = JSON.parse(currentData);
    const members = Object.entries(sortedSet)
      .sort(([, a], [, b]) => (a as number) - (b as number))
      .map(([member, score]) => withScores ? [member, score.toString()] : member)
      .flat();
    
    const startIdx = start < 0 ? Math.max(0, members.length + start) : start;
    const stopIdx = stop < 0 ? Math.max(-1, members.length + stop) : stop;
    
    return members.slice(startIdx, stopIdx + 1) as string[];
  }

  async zrem(key: string, member: string): Promise<number> {
    const currentData = await this.simulator.get(key);
    if (!currentData) return 0;
    
    const sortedSet = JSON.parse(currentData);
    if (member in sortedSet) {
      delete sortedSet[member];
      await this.simulator.set(key, sortedSet);
      return 1;
    }
    
    return 0;
  }

  // Métodos de transação (implementação simplificada)
  multi(): RedisMulti {
    return new RedisMulti(this);
  }

  // Métodos de pipeline (redirecionar para operações normais)
  pipeline(): RedisPipeline {
    return new RedisPipeline(this);
  }

  // Métodos de pub/sub (implementação básica)
  async publish(channel: string, message: string): Promise<number> {
    return 1; // Simular 1 subscriber
  }

  async subscribe(channel: string): Promise<void> {
    //
  }

  // Métodos de conexão
  async connect(): Promise<void> {
    await this.simulator.connect();
  }

  async disconnect(): Promise<void> {
    await this.simulator.disconnect();
  }

  async quit(): Promise<void> {
    await this.disconnect();
  }

  // Métodos de informação
  async ping(): Promise<string> {
    return 'PONG';
  }

  async info(section?: string): Promise<string> {
    const stats = this.simulator.getStats();
    return `# Redis Simulator Info
redis_version:7.0.0-simulator
used_memory:${stats.memoryUsage}
connected_clients:1
total_commands_processed:1000
instantaneous_ops_per_sec:10`;
  }

  // Event emitter methods (para compatibilidade)
  on(event: string, callback: Function): this {
    return this;
  }

  emit(event: string, ...args: any[]): boolean {
    return true;
  }

  off(event: string, callback?: Function): this {
    return this;
  }
}

// Classes auxiliares para Multi e Pipeline
class RedisMulti {
  private commands: Array<{ method: string; args: any[] }> = [];
  
  constructor(private adapter: RedisAdapter) {}

  set(key: string, value: any, ...args: any[]): this {
    this.commands.push({ method: 'set', args: [key, value, ...args] });
    return this;
  }

  get(key: string): this {
    this.commands.push({ method: 'get', args: [key] });
    return this;
  }

  del(key: string): this {
    this.commands.push({ method: 'del', args: [key] });
    return this;
  }

  async exec(): Promise<any[]> {
    const results = [];
    for (const cmd of this.commands) {
      try {
        const result = await (this.adapter as any)[cmd.method](...cmd.args);
        results.push([null, result]);
      } catch (error) {
        results.push([error, null]);
      }
    }
    return results;
  }
}

class RedisPipeline extends RedisMulti {
  // Pipeline é similar ao Multi mas com comportamento ligeiramente diferente
  constructor(adapter: RedisAdapter) {
    super(adapter);
  }
}

// Singleton para compatibilidade com BullMQ
export const redisAdapter = new RedisAdapter();