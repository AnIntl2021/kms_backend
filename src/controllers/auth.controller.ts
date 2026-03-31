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

    console.log('Attempting login for:', username);
    const [rows]: any = await pool.execute(
      `SELECT a.*, r.role_name, r.display_name_en, r.display_name_ar 
       FROM admins a 
       JOIN roles r ON a.role_id = r.role_id 
       WHERE (a.username = ? OR a.email = ?) AND a.deleted_at IS NULL AND a.status = 'active'`,
      [username, username] // Check both fields with the same input
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

export const getUsers = async (req: Request, res: Response) => {
  try {
    const [users]: any = await pool.execute(`
      SELECT a.admin_id, a.username, a.email, a.first_name, a.last_name, a.status, a.created_at, r.role_name 
      FROM admins a 
      JOIN roles r ON a.role_id = r.role_id 
      WHERE a.deleted_at IS NULL
    `);
    return successResponse(res, users);
  } catch (error) {
    return errorResponse(res, 'Failed to fetch users', 500, error);
  }
};

export const getAuditLogs = async (req: Request, res: Response) => {
  try {
    const [logs]: any = await pool.execute(`
      SELECT al.*, a.username 
      FROM audit_logs al 
      LEFT JOIN admins a ON al.admin_id = a.admin_id 
      ORDER BY al.created_at DESC 
      LIMIT 200
    `);
    return successResponse(res, logs);
  } catch (error) {
    return errorResponse(res, 'Failed to fetch audit logs', 500, error);
  }
};

export const createUser = async (req: any, res: Response) => {
  try {
    const { username, email, password, role_id, first_name, last_name, status } = req.body;

    // Check if exists
    const [existing]: any = await pool.execute('SELECT admin_id FROM admins WHERE username = ? OR email = ?', [username, email]);
    if (existing.length > 0) return errorResponse(res, 'Username or Email already exists', 400);

    const hashedPassword = await bcrypt.hash(password, 10);
    const [result]: any = await pool.execute(
      'INSERT INTO admins (username, email, password, role_id, first_name, last_name, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [username, email, hashedPassword, role_id, first_name, last_name, status || 'active']
    );

    await pool.execute(
      'INSERT INTO audit_logs (admin_id, action, entity_name, entity_id) VALUES (?, ?, ?, ?)',
      [req.user?.admin_id || 1, 'USER_CREATED', 'Admin', result.insertId]
    );

    return successResponse(res, { admin_id: result.insertId }, 'User created successfully', 201);
  } catch (error) {
    return errorResponse(res, 'Failed to create user', 500, error);
  }
};
