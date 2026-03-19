import pool from '../config/db';

export const logAudit = async (
  adminId: number, 
  action: string, 
  entityName: string, 
  entityId: number | null = null, 
  oldValues: any = null, 
  newValues: any = null,
  req: any = null
) => {
  try {
    const ipAddress = req ? req.ip : null;
    const userAgent = req ? req.get('user-agent') : null;

    await pool.execute(
      `INSERT INTO audit_logs (admin_id, action, entity_name, entity_id, old_values, new_values, ip_address, user_agent) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        adminId, 
        action, 
        entityName, 
        entityId, 
        oldValues ? JSON.stringify(oldValues) : null, 
        newValues ? JSON.stringify(newValues) : null, 
        ipAddress, 
        userAgent
      ]
    );
  } catch (error) {
    console.error('Audit Log Error:', error);
  }
};
