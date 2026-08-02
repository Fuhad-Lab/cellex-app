import { Injectable, Inject } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * DatabaseService
 *
 * Wraps Supabase client with the SERVICE ROLE key.
 * This is the ONLY place in NestJS that has DB access.
 *
 * Service role bypasses RLS — this is safe because:
 * 1. NestJS is behind Edge Functions (which validate auth)
 * 2. NestJS verifies the internal token (not exposed to frontend)
 * 3. NestJS does server-side authorization checks before queries
 *
 * NEVER expose this client to the frontend.
 * NEVER log the service role key.
 */
@Injectable()
export class DatabaseService {
  private client: SupabaseClient;

  constructor() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      throw new Error('Missing Supabase credentials. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
    }

    this.client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  get supabase(): SupabaseClient {
    return this.client;
  }

  /**
   * Select rows from a table with filters.
   * Always uses service role (bypasses RLS).
   */
  async select(table: string, columns: string = '*', filters: Record<string, any> = {}, options: { limit?: number; order?: string; ascending?: boolean } = {}) {
    let query = this.client.from(table).select(columns);

    for (const [key, value] of Object.entries(filters)) {
      query = query.eq(key, value);
    }

    if (options.order) {
      query = query.order(options.order, { ascending: options.ascending ?? false });
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;
    if (error) throw new Error(`DB select error: ${error.message}`);
    return data || [];
  }

  /**
   * Insert a row into a table.
   */
  async insert(table: string, data: Record<string, any>) {
    const { data: result, error } = await this.client
      .from(table)
      .insert(data)
      .select()
      .single();

    if (error) throw new Error(`DB insert error: ${error.message}`);
    return result;
  }

  /**
   * Update rows in a table.
   */
  async update(table: string, data: Record<string, any>, filters: Record<string, any>) {
    let query = this.client.from(table).update(data);
    for (const [key, value] of Object.entries(filters)) {
      query = query.eq(key, value);
    }
    const { data: result, error } = await query.select();
    if (error) throw new Error(`DB update error: ${error.message}`);
    return result || [];
  }

  /**
   * Delete rows from a table.
   */
  async delete(table: string, filters: Record<string, any>) {
    let query = this.client.from(table).delete();
    for (const [key, value] of Object.entries(filters)) {
      query = query.eq(key, value);
    }
    const { error } = await query;
    if (error) throw new Error(`DB delete error: ${error.message}`);
    return true;
  }

  /**
   * Execute a raw SQL query (for complex joins).
   * Uses the RPC endpoint.
   */
  async rpc(functionName: string, params: Record<string, any>) {
    const { data, error } = await this.client.rpc(functionName, params);
    if (error) throw new Error(`DB RPC error: ${error.message}`);
    return data;
  }
}
