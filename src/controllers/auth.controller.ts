import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { successResponse, errorResponse } from '../utils/response';
import { generateToken } from '../utils/jwt';
import pool from '../config/db';

export const login = async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return errorResponse(res, 'Username and password are required', 400);
    }

    console.log('Attempting login for username:', username);
    const [rows]: any = await pool.execute(
      `SELECT a.*, r.role_name, r.display_name_en, r.display_name_ar 
       FROM admins a 
       JOIN roles r ON a.role_id = r.role_id 
       WHERE a.username = ? AND a.deleted_at IS NULL AND a.status = 'active'`,
      [username]
    );

    if (!rows || rows.length === 0) {
      console.log('❌ LOGIN FAILED: User not found or inactive');
      return errorResponse(res, 'Invalid credentials or account inactive', 401);
    }

    const admin = rows[0];
    console.log('✅ LOGIN SUCCESS: User found. Comparing passwords...');
    console.log('Found user:', admin.username);
    console.log('Found ID:', admin.admin_id);

    const isMatch = await bcrypt.compare(password, admin.password);
    
    if (!isMatch) {
       console.log('❌ LOGIN FAILED: Password mismatch');
       return errorResponse(res, 'Invalid credentials', 401);
    }

    console.log('✅ PASSWORDS MATCH! Generating token for admin:', admin.admin_id);
    const token = generateToken({ 
      admin_id: admin.admin_id, 
      username: admin.username, 
      role: admin.role_name,
      display_name: admin.display_name_en 
    });

    console.log('Logging audit entry for:', admin.admin_id);
    await pool.execute(
      'INSERT INTO audit_logs (admin_id, action, entity_name, ip_address) VALUES (?, ?, ?, ?)',
      [admin.admin_id, 'LOGIN', 'auth', req.ip]
    );
    console.log('Audit log entry created');

    return successResponse(res, {
      admin: { 
        admin_id: admin.admin_id, 
        username: admin.username, 
        role: admin.role_name,
        firstName: admin.first_name,
        lastName: admin.last_name
      },
      token,
    }, 'Login successful');
    
  } catch (error) {
    console.error('Login Error:', error);
    return errorResponse(res, 'Login failed during processing', 500, error);
  }
};

export const getRoles = async (req: Request, res: Response) => {
  try {
    const [roles] = await pool.execute('SELECT role_id, role_name, display_name_en, display_name_ar FROM roles WHERE deleted_at IS NULL');
    return successResponse(res, roles);
  } catch (error) {
    return errorResponse(res, 'Failed to fetch roles', 500, error);
  }
};

export const getProfile = async (req: any, res: Response) => {
  return successResponse(res, { admin: req.user });
};
