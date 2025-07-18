/**
 * Redis Simulator para ambiente Replit
 * Simula funcionalidades básicas do Redis em memória
 */

interface RedisData {
  [key: string]: any;
}

interface RedisExpiration {
  [key: string]: number;
}

class RedisSimulator {
  private data: RedisData = {};
  private expirations: RedisExpiration = {};
  private isConnected = false;

  constructor() {
    this.connect();
    // Limpeza periódica de chaves expiradas
    setInterval(() => this.cleanExpired(), 60000); // A cada 1 minuto
  }

  async connect(): Promise<void> {
    this.isConnected = true;
  }

  async disconnect(): Promise<void> {
    this.isConnected = false;
  }

  private cleanExpired(): void {
    const now = Date.now();
    const expiredKeys = Object.keys(this.expirations).filter(key => 
      this.expirations[key] <= now
    );
    
    expiredKeys.forEach(key => {
      delete this.data[key];
      delete this.expirations[key];
    });
  }

  // Operações básicas do Redis
  async set(key: string, value: any, options?: { EX?: number }): Promise<string> {
    this.data[key] = JSON.stringify(value);
    
    if (options?.EX) {
      this.expirations[key] = Date.now() + (options.EX * 1000);
    }
    
    return 'OK';
  }

  async get(key: string): Promise<string | null> {
    if (this.isExpired(key)) {
      delete this.data[key];
      delete this.expirations[key];
      return null;
    }
    
    return this.data[key] || null;
  }

  async del(key: string): Promise<number> {
    const existed = key in this.data;
    delete this.data[key];
    delete this.expirations[key];
    return existed ? 1 : 0;
  }

  async exists(key: string): Promise<number> {
    if (this.isExpired(key)) {
      delete this.data[key];
      delete this.expirations[key];
      return 0;
    }
    return key in this.data ? 1 : 0;
  }

  async hset(key: string, field: string, value: any): Promise<number> {
    if (!this.data[key]) {
      this.data[key] = JSON.stringify({});
    }
    
    const hash = JSON.parse(this.data[key]);
    const isNew = !(field in hash);
    hash[field] = value;
    this.data[key] = JSON.stringify(hash);
    
    return isNew ? 1 : 0;
  }

  async hget(key: string, field: string): Promise<string | null> {
    if (this.isExpired(key) || !this.data[key]) {
      return null;
    }
    
    const hash = JSON.parse(this.data[key]);
    return hash[field] || null;
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    if (this.isExpired(key) || !this.data[key]) {
      return {};
    }
    
    return JSON.parse(this.data[key]);
  }

  async hincrby(key: string, field: string, increment: number): Promise<number> {
    if (!this.data[key]) {
      this.data[key] = JSON.stringify({});
    }
    
    const hash = JSON.parse(this.data[key]);
    const currentValue = parseInt(hash[field] || '0');
    const newValue = currentValue + increment;
    hash[field] = newValue.toString();
    this.data[key] = JSON.stringify(hash);
    
    return newValue;
  }

  // Operações de lista para filas
  async lpush(key: string, ...values: any[]): Promise<number> {
    if (!this.data[key]) {
      this.data[key] = JSON.stringify([]);
    }
    
    const list = JSON.parse(this.data[key]);
    values.reverse().forEach(value => list.unshift(value));
    this.data[key] = JSON.stringify(list);
    
    return list.length;
  }

  async rpop(key: string): Promise<string | null> {
    if (!this.data[key]) {
      return null;
    }
    
    const list = JSON.parse(this.data[key]);
    if (list.length === 0) {
      return null;
    }
    
    const value = list.pop();
    this.data[key] = JSON.stringify(list);
    
    return value;
  }

  async llen(key: string): Promise<number> {
    if (!this.data[key]) {
      return 0;
    }
    
    const list = JSON.parse(this.data[key]);
    return list.length;
  }

  private isExpired(key: string): boolean {
    if (!(key in this.expirations)) {
      return false;
    }
    
    return this.expirations[key] <= Date.now();
  }

  // Status da conexão
  get status(): string {
    return this.isConnected ? 'ready' : 'connecting';
  }

  // Estatísticas para monitoramento
  getStats(): { totalKeys: number; expiredKeys: number; memoryUsage: string } {
    const totalKeys = Object.keys(this.data).length;
    const expiredKeys = Object.keys(this.expirations).filter(key => this.isExpired(key)).length;
    const memoryUsage = JSON.stringify(this.data).length + ' bytes';
    
    return { totalKeys, expiredKeys, memoryUsage };
  }
}

export const redisSimulator = new RedisSimulator();