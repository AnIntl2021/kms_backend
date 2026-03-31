import { Request, Response } from 'express';
import { successResponse, errorResponse } from '../utils/response';
import pool from '../config/db';

export const getPurchaseOrders = async (req: Request, res: Response) => {
  try {
    const [orders] = await pool.execute(`
      SELECT po.*, v.name_en as vendor_name, b.name_en as branch_name
      FROM purchase_orders po
      JOIN vendors v ON po.vendor_id = v.vendor_id
      LEFT JOIN branches b ON po.branch_id = b.branch_id
      WHERE po.deleted_at IS NULL 
      ORDER BY po.created_at DESC
    `);
    return successResponse(res, orders);
  } catch (error) {
    return errorResponse(res, 'Failed to fetch purchase orders', 500, error);
  }
};

export const getPurchaseOrderById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const [orders]: any = await pool.execute(`
      SELECT po.*, v.name_en as vendor_name, v.name_ar as vendor_name_ar, b.name_en as branch_name
      FROM purchase_orders po
      JOIN vendors v ON po.vendor_id = v.vendor_id
      LEFT JOIN branches b ON po.branch_id = b.branch_id
      WHERE po.purchase_id = ?
    `, [id]);

    if (orders.length === 0) return errorResponse(res, 'PO not found', 404);

    const [items] = await pool.execute(`
      SELECT poi.*, ii.name_en, ii.name_ar, ii.unit_en 
      FROM purchase_order_items poi
      JOIN inventory_items ii ON poi.inventory_item_id = ii.inventory_item_id
      WHERE poi.purchase_id = ?
    `, [id]);

    return successResponse(res, { ...orders[0], items });
  } catch (error) {
    return errorResponse(res, 'Failed to fetch PO details', 500, error);
  }
};

export const createPurchaseOrder = async (req: Request, res: Response) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const { 
      vendor_id, 
      branch_id,
      po_number, 
      invoice_type,
      tax_amount,
      discount_amount,
      discount_percentage,
      additional_charges,
      final_amount,
      items, 
      notes,
      date 
    } = req.body;
    const admin_id = (req as any).user.admin_id;

    // 1. Create Header
    const [result]: any = await connection.execute(
      `INSERT INTO purchase_orders (
        vendor_id, admin_id, branch_id, po_number, date, invoice_type, 
        total_amount, tax_amount, discount_amount, discount_percentage, 
        additional_charges, final_amount, notes, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        vendor_id, 
        admin_id, 
        branch_id || 1, 
        po_number, 
        date || new Date().toISOString().split('T')[0],
        invoice_type || 'tax_invoice',
        0, // total_amount calculated from items
        tax_amount || 0,
        discount_amount || 0,
        discount_percentage || 0,
        additional_charges || 0,
        final_amount || 0,
        notes || null, 
        'pending'
      ]
    );
    const purchase_id = result.insertId;

    // 2. Add Items & Calculate Total
    let total_amount = 0;
    for (const item of items) {
      const line_total = Number(item.quantity) * Number(item.unit_price);
      total_amount += line_total;
      await connection.execute(
        `INSERT INTO purchase_order_items (
          purchase_id, inventory_item_id, variant_id, package_id, quantity, unit_price, 
          amount, discount_amount, additional_charges_percentage, additional_charges_amount, 
          final_amount, expiry_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          purchase_id, 
          item.inventory_item_id, 
          item.variant_id || null,
          item.package_id || null,
          item.quantity, 
          item.unit_price,
          item.amount || line_total,
          item.discount_amount || 0,
          item.additional_charges_percentage || 0,
          item.additional_charges_amount || 0,
          item.final_amount || line_total,
          item.expiry_date || null
        ]
      );
    }

    // 3. Update Total in Header if needed (or ensure final_amount is correctly stored)
    await connection.execute('UPDATE purchase_orders SET total_amount = ? WHERE purchase_id = ?', [total_amount, purchase_id]);

    await connection.commit();
    return successResponse(res, { purchase_id }, 'Purchase order created successfully', 201);
  } catch (error) {
    await connection.rollback();
    return errorResponse(res, 'Failed to create PO', 500, error);
  } finally {
    connection.release();
  }
};

export const receivePurchaseOrder = async (req: Request, res: Response) => {
  const connection = await pool.getConnection();
  try {
    const { id } = req.params;
    const admin_id = (req as any).user.admin_id;

    await connection.beginTransaction();

    // 1. Check if PO exists and is still pending
    const [orders]: any = await connection.execute('SELECT status FROM purchase_orders WHERE purchase_id = ? FOR UPDATE', [id]);
    if (orders.length === 0) throw new Error('PO not found');
    if (orders[0].status !== 'pending' && orders[0].status !== 'partially_received') throw new Error('PO is not in a receivable state');

    // 2. Get PO items
    const [items]: any = await connection.execute('SELECT inventory_item_id, quantity FROM purchase_order_items WHERE purchase_id = ?', [id]);

    // 3. Update stock levels
    for (const item of items) {
      await connection.execute(
        'UPDATE inventory_items SET current_stock = current_stock + ? WHERE inventory_item_id = ?',
        [item.quantity, item.inventory_item_id]
      );
      
      // Log individual stock movements
      await connection.execute(
        'INSERT INTO audit_logs (admin_id, action, entity_name, entity_id, new_values) VALUES (?, ?, ?, ?, ?)',
        [admin_id, 'Purchase In', 'InventoryItem', item.inventory_item_id, JSON.stringify({ received_qty: item.quantity, purchase_id: id })]
      );
    }

    // 4. Mark PO as received
    await connection.execute(
      'UPDATE purchase_orders SET status = ?, received_at = CURRENT_TIMESTAMP, received_by = ? WHERE purchase_id = ?',
      ['received', admin_id, id]
    );

    await connection.commit();
    return successResponse(res, null, 'Stock received and inventory updated successfully');
  } catch (error: any) {
    await connection.rollback();
    console.error('SERVER PO RECEIVE ERROR:', error);
    return errorResponse(res, error.message || 'Failed to receive PO', 500);
  } finally {
    connection.release();
  }
};

export const updatePurchaseOrder = async (req: Request, res: Response) => {
  const connection = await pool.getConnection();
  try {
    const { id } = req.params;
    const { 
      vendor_id, 
      branch_id,
      invoice_type,
      tax_amount,
      discount_amount,
      discount_percentage,
      additional_charges,
      final_amount,
      items, 
      notes,
      date 
    } = req.body;

    await connection.beginTransaction();

    // 1. Check status (only draft/pending/partially_received can be edited)
    const [orders]: any = await connection.execute('SELECT status FROM purchase_orders WHERE purchase_id = ? FOR UPDATE', [id]);
    if (orders.length === 0) throw new Error('PO not found');
    if (orders[0].status === 'received' || orders[0].status === 'cancelled') {
       throw new Error(`Cannot edit order in ${orders[0].status} status`);
    }

    // 2. Update Header
    let total_amount = 0;
    items.forEach((item: any) => total_amount += (Number(item.quantity) * Number(item.unit_price)));
    
    await connection.execute(
      `UPDATE purchase_orders SET 
        vendor_id = ?, 
        branch_id = ?,
        invoice_type = ?,
        total_amount = ?, 
        tax_amount = ?,
        discount_amount = ?,
        discount_percentage = ?,
        additional_charges = ?,
        final_amount = ?,
        notes = ?,
        date = ?
      WHERE purchase_id = ?`,
      [
        vendor_id, 
        branch_id || 1,
        invoice_type || 'tax_invoice',
        total_amount, 
        tax_amount || 0,
        discount_amount || 0,
        discount_percentage || 0,
        additional_charges || 0,
        final_amount || 0,
        notes || null, 
        date || new Date().toISOString().split('T')[0],
        id
      ]
    );

    // 3. Simple approach: Delete existing items and re-insert
    await connection.execute('DELETE FROM purchase_order_items WHERE purchase_id = ?', [id]);
    for (const item of items) {
      const line_total = Number(item.quantity) * Number(item.unit_price);
      await connection.execute(
        `INSERT INTO purchase_order_items (
          purchase_id, inventory_item_id, variant_id, package_id, quantity, unit_price, 
          amount, discount_amount, additional_charges_percentage, additional_charges_amount, 
          final_amount, expiry_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id, 
          item.inventory_item_id, 
          item.variant_id || null, 
          item.package_id || null,
          item.quantity, 
          item.unit_price,
          item.amount || line_total,
          item.discount_amount || 0,
          item.additional_charges_percentage || 0,
          item.additional_charges_amount || 0,
          item.final_amount || line_total,
          item.expiry_date || null
        ]
      );
    }

    await connection.commit();
    return successResponse(res, null, 'Purchase order updated successfully');
  } catch (error: any) {
    await connection.rollback();
    return errorResponse(res, error.message || 'Failed to update PO', 500);
  } finally {
    connection.release();
  }
};
