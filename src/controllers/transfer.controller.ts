import { Request, Response } from 'express';
import { successResponse, errorResponse } from '../utils/response';
import pool from '../config/db';

export const getTransfers = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    let query = `
      SELECT t.*, 
             b1.name_en as from_branch_name, 
             b2.name_en as to_branch_name,
             a.first_name as created_by_name
      FROM stock_transfers t
      LEFT JOIN branches b1 ON t.from_branch_id = b1.branch_id
      LEFT JOIN branches b2 ON t.to_branch_id = b2.branch_id
      LEFT JOIN admins a ON t.created_by = a.admin_id
    `;
    const params: any[] = [];

    // Enforce scoping
    if (user && user.brand_id) {
      // Return transfers where either the source or destination branch belongs to this brand
      query += ` WHERE (b1.brand_id = ? OR b2.brand_id = ? OR t.from_branch_id IS NULL)`;
      params.push(user.brand_id, user.brand_id);
    } else if (user && user.branch_id) {
      query += ` WHERE (t.from_branch_id = ? OR t.to_branch_id = ?)`;
      params.push(user.branch_id, user.branch_id);
    }

    query += ' ORDER BY t.created_at DESC';

    const [rows]: any = await pool.execute(query, params);

    // Fetch items for each transfer
    if (rows.length > 0) {
      const transferIds = rows.map((r: any) => r.transfer_id);
      const [items]: any = await pool.execute(`
        SELECT ti.*, ii.name_en, ii.name_ar, ii.unit_en
        FROM stock_transfer_items ti
        JOIN inventory_items ii ON ti.inventory_item_id = ii.inventory_item_id
        WHERE ti.transfer_id IN (${transferIds.join(',')})
      `);

      rows.forEach((row: any) => {
        row.items = items.filter((i: any) => i.transfer_id === row.transfer_id);
      });
    }

    return successResponse(res, rows);
  } catch (error) {
    console.error('getTransfers Error:', error);
    return errorResponse(res, 'Failed to fetch transfers', 500, error);
  }
};

export const createTransfer = async (req: Request, res: Response) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const user = (req as any).user;
    const { from_branch_id, to_branch_id, notes, items } = req.body;
    const admin_id = user?.admin_id || 1;

    if (!to_branch_id) {
      return errorResponse(res, 'Destination branch is required', 400);
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return errorResponse(res, 'Transfer items are required', 400);
    }

    // 1. Create Stock Transfer Log
    const [result]: any = await connection.execute(
      'INSERT INTO stock_transfers (from_branch_id, to_branch_id, notes, created_by, status) VALUES (?, ?, ?, ?, ?)',
      [from_branch_id || null, to_branch_id, notes || null, admin_id, 'pending']
    );
    const transfer_id = result.insertId;

    // 2. Add items to Transfer Log
    for (const item of items) {
      await connection.execute(
        'INSERT INTO stock_transfer_items (transfer_id, inventory_item_id, quantity) VALUES (?, ?, ?)',
        [transfer_id, item.inventory_item_id, item.quantity]
      );
    }

    await connection.commit();
    return successResponse(res, { transfer_id }, 'Stock transfer requested successfully', 201);
  } catch (error) {
    await connection.rollback();
    console.error('createTransfer Error:', error);
    return errorResponse(res, 'Failed to request stock transfer', 500, error);
  } finally {
    connection.release();
  }
};

export const updateTransferStatus = async (req: Request, res: Response) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const { id } = req.params;
    const { status } = req.body; // 'completed' or 'cancelled'

    if (!['completed', 'cancelled'].includes(status)) {
      return errorResponse(res, 'Invalid status update', 400);
    }

    // 1. Fetch Transfer details
    const [transfers]: any = await connection.execute('SELECT * FROM stock_transfers WHERE transfer_id = ?', [id]);
    if (transfers.length === 0) {
      return errorResponse(res, 'Transfer request not found', 404);
    }
    const transfer = transfers[0];

    if (transfer.status !== 'pending') {
      return errorResponse(res, 'Transfer is already processed', 400);
    }

    // 2. If completed, perform stock movements
    if (status === 'completed') {
      const [items]: any = await connection.execute('SELECT * FROM stock_transfer_items WHERE transfer_id = ?', [id]);
      
      const sourceBranchId = transfer.from_branch_id || 1; // Fallback to branch ID 1 (Head Office/Warehouse)

      for (const item of items) {
        // Validate source stock
        const [sourceStock]: any = await connection.execute(
          'SELECT quantity FROM branch_stock WHERE branch_id = ? AND inventory_item_id = ?',
          [sourceBranchId, item.inventory_item_id]
        );

        const currentQty = (sourceStock && sourceStock.length > 0) ? Number(sourceStock[0].quantity) : 0;
        if (currentQty < Number(item.quantity) && transfer.from_branch_id !== null) {
          // If transferring from a specific branch (not main office), block if insufficient stock
          await connection.rollback();
          return errorResponse(res, `Insufficient stock for item ID ${item.inventory_item_id} in source branch. Available: ${currentQty}`, 400);
        }

        // Deduct from source branch stock
        await connection.execute(
          'INSERT INTO branch_stock (branch_id, inventory_item_id, quantity) VALUES (?, ?, 0) ON DUPLICATE KEY UPDATE quantity = quantity',
          [sourceBranchId, item.inventory_item_id]
        );
        await connection.execute(
          'UPDATE branch_stock SET quantity = quantity - ? WHERE branch_id = ? AND inventory_item_id = ?',
          [item.quantity, sourceBranchId, item.inventory_item_id]
        );

        // Add to destination branch stock
        await connection.execute(
          'INSERT INTO branch_stock (branch_id, inventory_item_id, quantity) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE quantity = quantity + ?',
          [transfer.to_branch_id, item.inventory_item_id, item.quantity, item.quantity]
        );
      }
    }

    // 3. Update status
    await connection.execute('UPDATE stock_transfers SET status = ? WHERE transfer_id = ?', [status, id]);

    await connection.commit();
    return successResponse(res, null, `Stock transfer marked as ${status} successfully`);
  } catch (error) {
    await connection.rollback();
    console.error('updateTransferStatus Error:', error);
    return errorResponse(res, 'Failed to update stock transfer status', 500, error);
  } finally {
    connection.release();
  }
};
