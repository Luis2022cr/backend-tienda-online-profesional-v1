// services/dbService.ts
import client from '../db/turso';

export const executeQuery = async (sql: string, args: any[] = []) => {
    try {
        return await client.execute({ sql, args });
    } catch (error) {
        console.error('Database query error:', error);
        throw error;
    }
};
