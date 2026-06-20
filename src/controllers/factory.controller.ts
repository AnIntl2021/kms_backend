import { Request, Response } from 'express';
import pool from '../config/db';
import { successResponse, errorResponse } from '../utils/response';

export const produceSandwiches = async (req: Request, res: Response) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const { menu_item_id, quantity } = req.body;
    const admin_id = (req as any).user.admin_id;

    const [ingredients]: any = await connection.execute(
      `SELECT mii.inventory_item_id, mii.quantity, mii.package_id, ip.multiplier 
       FROM menu_item_ingredients mii 
       LEFT JOIN inventory_item_packages ip ON mii.package_id = ip.package_id 
       WHERE mii.menu_item_id = ?`,
      [menu_item_id]
    );

    for (const ing of ingredients) {
      const multiplier = Number(ing.multiplier || 1);
      const required = Number(ing.quantity) * Number(quantity) * multiplier;
      
      const [stock]: any = await connection.execute(
        'SELECT current_stock, name_en FROM inventory_items WHERE inventory_item_id = ? FOR UPDATE',
        [ing.inventory_item_id]
      );
      
      if (!stock[0] || stock[0].current_stock < required) {
        throw new Error(`Insufficient ${stock[0]?.name_en || 'Ingredient'}. Need ${required}, have ${stock[0]?.current_stock || 0}`);
      }
      
      await connection.execute(
        'UPDATE inventory_items SET current_stock = current_stock - ? WHERE inventory_item_id = ?',
        [required, ing.inventory_item_id]
      );
    }

    await connection.execute(
      'UPDATE menu_items SET current_stock = current_stock + ? WHERE menu_item_id = ?',
      [quantity, menu_item_id]
    );

    await connection.execute(
      'INSERT INTO production_logs (menu_item_id, quantity_produced, admin_id) VALUES (?, ?, ?)',
      [menu_item_id, quantity, admin_id]
    );

    await connection.commit();
    return successResponse(res, null, 'Production completed and stock updated.');
  } catch (error: any) {
    await connection.rollback();
    return errorResponse(res, error.message || 'Production failed');
  } finally {
    connection.release();
  }
};

export const createSalesOrder = async (req: Request, res: Response) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const { vendor_id, branch_id, customer_name, items, payment_method, order_number, batch_number, expiry_date, discount_percentage, dispatch_date, salesman_id } = req.body;
    const admin_id = (req as any).user.admin_id;

    const totalAmount = items.reduce((acc: number, item: any) => acc + (Number(item.quantity) * Number(item.price)), 0);
    const discountPercentage = discount_percentage !== undefined ? Number(discount_percentage) : (vendor_id ? 25.00 : 0.00); // Use provided discount or fallback to 25% for partners
    const discountAmount = (totalAmount * discountPercentage) / 100;
    const finalAmount = totalAmount - discountAmount;

    let resolvedCustomerName = customer_name;
    if (vendor_id && !resolvedCustomerName) {
      const [vendor]: any = await connection.execute('SELECT name_en FROM vendors WHERE vendor_id = ?', [vendor_id]);
      if (vendor.length > 0) resolvedCustomerName = vendor[0].name_en;
    }

    const sanitizedDispatchDate = dispatch_date ? String(dispatch_date).split('T')[0] : new Date().toISOString().split('T')[0];
    const sanitizedExpiryDate = expiry_date ? String(expiry_date).split('T')[0] : null;

    const [orderRes]: any = await connection.execute(
      `INSERT INTO sales_orders (order_number, vendor_id, branch_id, customer_name, total_amount, discount_percentage, discount_amount, final_amount, payment_method, payment_status, admin_id, salesman_id, batch_number, expiry_date, dispatch_status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [order_number || `SO-${Date.now()}`, vendor_id || null, branch_id && String(branch_id).trim().toLowerCase() === 'main' ? null : (branch_id || null), resolvedCustomerName || 'Counter Customer', totalAmount, discountPercentage, discountAmount, finalAmount, payment_method || 'credit', 'pending', admin_id, salesman_id || null, batch_number || null, sanitizedExpiryDate, 'pending', sanitizedDispatchDate]
    );
    const sale_id = orderRes.insertId;

    for (const item of items) {
      const [menuItem]: any = await connection.execute('SELECT current_stock, name_en FROM menu_items WHERE menu_item_id = ? FOR UPDATE', [item.menu_item_id]);
      if (Number(menuItem[0].current_stock) < Number(item.quantity)) {
        throw new Error(`Insufficient stock for ${menuItem[0].name_en}. Have ${menuItem[0].current_stock}, need ${item.quantity}`);
      }

      await connection.execute(
        `INSERT INTO sales_order_items (sale_id, menu_item_id, quantity, price, expiry_date, batch_number) VALUES (?, ?, ?, ?, ?, ?)`,
        [sale_id, item.menu_item_id, item.quantity, item.price, sanitizedExpiryDate, batch_number || null]
      );

      await connection.execute('UPDATE menu_items SET current_stock = current_stock - ? WHERE menu_item_id = ?', [item.quantity, item.menu_item_id]);
    }

    await connection.commit();
    return successResponse(res, { sale_id }, 'Sale & Branch Dispatch completed.');
  } catch (error: any) {
    await connection.rollback();
    return errorResponse(res, error.message || 'Sales transaction failed');
  } finally {
    connection.release();
  }
};

export const getDispatches = async (req: Request, res: Response) => {
  try {
    const admin = (req as any).user;
    let branchFilter = '';
    const queryParams: any[] = [];
    
    if (admin && admin.branch_id) {
      branchFilter = 'AND s.branch_id = ?';
      queryParams.push(admin.branch_id);
    }

    const [dispatches]: any = await pool.execute(`
      SELECT 
        s.sales_order_id as sale_id, 
        s.order_number, 
        NULL as vendor_id, 
        s.branch_id, 
        s.customer_name, 
        s.total_amount, 
        0 as discount_amount, 
        s.total_amount as final_amount, 
        s.status as dispatch_status, 
        NULL as batch_number, 
        NULL as expiry_date, 
        DATE_FORMAT(s.created_at, '%Y-%m-%d') as dispatch_date,
        s.created_at,
        s.customer_name as client_name,
        b.name_en as branch_name,
        NULL as salesman_name,
        NULL as salesman_phone,
        s.order_type
      FROM sales_orders s
      LEFT JOIN branches b ON s.branch_id = b.branch_id
      WHERE s.order_type IN ('delivery', 'b2b') AND s.deleted_at IS NULL ${branchFilter}
      ORDER BY s.created_at DESC, s.sales_order_id DESC
    `, queryParams);
    return successResponse(res, dispatches);
  } catch (error) {
    return errorResponse(res, 'Failed to fetch dispatches', 500, error);
  }
};

export const processReturn = async (req: Request, res: Response) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const { sale_id, vendor_id, branch_id, items, reason, salesman_id, return_date } = req.body;
    const admin_id = (req as any).user.admin_id;

    // 🛡️ FINANCIAL ACCURACY: Fetch original order's discount to ensure return credit is correct
    let discountFactor = 1.0;
    if (sale_id) {
      const [originalOrder]: any = await connection.execute('SELECT discount_percentage FROM sales_orders WHERE sale_id = ?', [sale_id]);
      if (originalOrder.length > 0) {
        discountFactor = (100 - Number(originalOrder[0].discount_percentage || 0)) / 100;
      }
    } else if (vendor_id) {
      // Fallback: Check vendor name for Canteen to apply 35%, otherwise 25%
      const [vendorInfo]: any = await connection.execute('SELECT name_en FROM vendors WHERE vendor_id = ?', [vendor_id]);
      if (vendorInfo.length > 0 && vendorInfo[0].name_en.toLowerCase().includes('canteen')) {
        discountFactor = 0.65;
      } else {
        discountFactor = 0.75;
      }
    }

    let total_credit = 0;
    items.forEach((i: any) => {
      const itemPrice = Number(i.price || i.unit_price || 0);
      total_credit += (Number(i.quantity) * itemPrice * discountFactor);
    });

    const sanitizedReturnDate = return_date ? String(return_date).split('T')[0] : new Date().toISOString().split('T')[0];

    const [returnRes]: any = await connection.execute(
      'INSERT INTO sales_returns (sale_id, vendor_id, branch_id, reason, total_credit_amount, admin_id, salesman_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [sale_id || null, vendor_id, branch_id && String(branch_id).trim().toLowerCase() === 'main' ? null : (branch_id || null), reason || 'Expired', total_credit, admin_id, salesman_id || null, sanitizedReturnDate]
    );
    const return_id = returnRes.insertId;

    for (const item of items) {
      if (Number(item.quantity) <= 0) continue;

      const current_sale_id = item.sale_id || sale_id;

      // 🛡️ VALIDATION: CHECK REMAINING QUANTITY
      const [stockInfo]: any = await connection.execute(`
        SELECT 
          (si.quantity - IFNULL((
            SELECT SUM(ri.quantity) 
            FROM sales_return_items ri 
            JOIN sales_returns sr ON ri.return_id = sr.return_id 
            WHERE sr.sale_id = si.sale_id AND ri.menu_item_id = si.menu_item_id
          ), 0)) as remaining_qty
        FROM sales_order_items si
        WHERE si.sale_id = ? AND si.menu_item_id = ?
      `, [current_sale_id, item.menu_item_id || item.product_id]);

      if (stockInfo.length === 0 || Number(stockInfo[0].remaining_qty) < Number(item.quantity)) {
        throw new Error(`Insufficient quantity for return of item ID ${item.menu_item_id || item.product_id}. Remaining: ${stockInfo.length > 0 ? stockInfo[0].remaining_qty : 0}`);
      }

      await connection.execute(
        'INSERT INTO sales_return_items (return_id, menu_item_id, quantity, unit_price, expiry_date) VALUES (?, ?, ?, ?, ?)',
        [return_id, item.menu_item_id || item.product_id, item.quantity, item.price || item.unit_price, item.expiry_date ? String(item.expiry_date).split('T')[0] : null]
      );

      await connection.execute(
        'INSERT INTO wastage (menu_item_id, return_id, quantity, reason_en, admin_id, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        [item.menu_item_id || item.product_id, return_id, item.quantity, `Returned from Vendor: ${reason || 'Expired'}`, admin_id, sanitizedReturnDate]
      );
    }

    await connection.commit();
    return successResponse(res, { return_id }, 'Return processed and items wasted.');
  } catch (error: any) {
    await connection.rollback();
    return errorResponse(res, error.message || 'Failed to process return');
  } finally {
    connection.release();
  }
};

export const updateSalesOrder = async (req: Request, res: Response) => {
  const { sale_id } = req.params;
  const { vendor_id, branch_id, customer_name, items, batch_number, expiry_date, discount_percentage, dispatch_status, dispatch_date, salesman_id } = req.body;
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // 1. Check if order exists and is not locked
    const [existing]: any = await connection.execute('SELECT dispatch_status FROM sales_orders WHERE sale_id = ? FOR UPDATE', [sale_id]);
    if (existing.length === 0) throw new Error('Order not found');

    // 2. Restore Old Stock
    const [oldItems]: any = await connection.execute('SELECT menu_item_id, quantity FROM sales_order_items WHERE sale_id = ?', [sale_id]);
    for (const item of oldItems) {
      await connection.execute('UPDATE menu_items SET current_stock = current_stock + ? WHERE menu_item_id = ?', [item.quantity, item.menu_item_id]);
    }

    // 3. Wipe Old Items
    await connection.execute('DELETE FROM sales_order_items WHERE sale_id = ?', [sale_id]);

    // 4. Record New Data & Recalculate Totals
    const totalAmount = items.reduce((acc: number, item: any) => acc + (Number(item.quantity) * Number(item.price)), 0);
    const discP = Number(discount_percentage || 0);
    const discountAmount = (totalAmount * discP) / 100;
    const finalAmount = totalAmount - discountAmount;

    const sanitizedExp = expiry_date ? String(expiry_date).split('T')[0] : null;
    const sanitizedDisp = dispatch_date ? String(dispatch_date).split('T')[0] : null;

    await connection.execute(
      `UPDATE sales_orders SET 
        vendor_id = ?, 
        branch_id = ?, 
        customer_name = ?, 
        total_amount = ?, 
        discount_percentage = ?, 
        discount_amount = ?, 
        final_amount = ?, 
        batch_number = ?, 
        expiry_date = ?,
        salesman_id = ?,
        dispatch_status = ?${sanitizedDisp ? ', created_at = ?' : ''}
      WHERE sale_id = ?`,
      [
        vendor_id || null,
        branch_id && String(branch_id).trim().toLowerCase() === 'main' ? null : (branch_id || null),
        customer_name || 'Counter Customer',
        totalAmount,
        discP,
        discountAmount,
        finalAmount,
        batch_number || null,
        sanitizedExp,
        salesman_id || null,
        dispatch_status || existing[0].dispatch_status || 'pending',
        ...(sanitizedDisp ? [sanitizedDisp] : []),
        sale_id
      ]
    );

    // 5. Deduct New Stock & Insert Items
    for (const item of items) {
      const [stockCheck]: any = await connection.execute('SELECT current_stock, name_en FROM menu_items WHERE menu_item_id = ? FOR UPDATE', [item.menu_item_id]);
      
      if (Number(stockCheck[0].current_stock) < Number(item.quantity)) {
        throw new Error(`Insufficient stock for ${stockCheck[0].name_en} during update. Have ${stockCheck[0].current_stock}, need ${item.quantity}`);
      }

      await connection.execute(
        `INSERT INTO sales_order_items (sale_id, menu_item_id, quantity, price, expiry_date, batch_number) VALUES (?, ?, ?, ?, ?, ?)`,
        [sale_id, item.menu_item_id, item.quantity, item.price, sanitizedExp, batch_number || null]
      );

      await connection.execute('UPDATE menu_items SET current_stock = current_stock - ? WHERE menu_item_id = ?', [item.quantity, item.menu_item_id]);
    }

    await connection.commit();
    return successResponse(res, null, 'Order fully updated and stock reconciled.');
  } catch (error: any) {
    await connection.rollback();
    return errorResponse(res, error.message || 'Failed to update order', 500, error);
  } finally {
    connection.release();
  }
};

export const updateReturn = async (req: Request, res: Response) => {
  const { return_id } = req.params;
  const { items, reason, salesman_id, return_date } = req.body;
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // 1. Wipe old items and wastage entries
    await connection.execute('DELETE FROM sales_return_items WHERE return_id = ?', [return_id]);
    await connection.execute('DELETE FROM wastage WHERE return_id = ?', [return_id]);

    // 2. Recalculate and Update Main Return Record
    // 🛡️ FINANCIAL ACCURACY: Fetch original order's discount
    let discountFactor = 1.0;
    const [retData]: any = await connection.execute('SELECT sale_id, vendor_id, created_at FROM sales_returns WHERE return_id = ?', [return_id]);
    if (retData.length > 0) {
      if (retData[0].sale_id) {
        const [originalOrder]: any = await connection.execute('SELECT discount_percentage FROM sales_orders WHERE sale_id = ?', [retData[0].sale_id]);
        if (originalOrder.length > 0) {
          discountFactor = (100 - Number(originalOrder[0].discount_percentage || 0)) / 100;
        }
      } else if (retData[0].vendor_id) {
        const [vendorInfo]: any = await connection.execute('SELECT name_en FROM vendors WHERE vendor_id = ?', [retData[0].vendor_id]);
        if (vendorInfo.length > 0 && vendorInfo[0].name_en.toLowerCase().includes('canteen')) {
          discountFactor = 0.65;
        } else {
          discountFactor = 0.75;
        }
      }
    }

    let total_credit = 0;
    items.forEach((i: any) => {
      const itemPrice = Number(i.price || i.unit_price || 0);
      total_credit += (Number(i.quantity) * itemPrice * discountFactor);
    });

    const sanitizedReturnDate = return_date ? String(return_date).split('T')[0] : null;

    await connection.execute(
      `UPDATE sales_returns SET reason = ?, salesman_id = ?, total_credit_amount = ?${sanitizedReturnDate ? ', created_at = ?' : ''} WHERE return_id = ?`,
      [reason || 'Expired', salesman_id || null, total_credit, ...(sanitizedReturnDate ? [sanitizedReturnDate] : []), return_id]
    );

    // 3. Insert New Corrected Items & Wastage
    const admin_id = (req as any).user.admin_id;
    const finalDate = sanitizedReturnDate || (retData.length > 0 ? retData[0].created_at : new Date());

    for (const item of items) {
      if (Number(item.quantity) <= 0) continue;

      await connection.execute(
        'INSERT INTO sales_return_items (return_id, menu_item_id, quantity, unit_price, expiry_date) VALUES (?, ?, ?, ?, ?)',
        [return_id, item.menu_item_id || item.product_id, item.quantity, item.price || item.unit_price, item.expiry_date ? String(item.expiry_date).split('T')[0] : null]
      );

      await connection.execute(
        'INSERT INTO wastage (menu_item_id, return_id, quantity, reason_en, admin_id, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        [item.menu_item_id || item.product_id, return_id, item.quantity, `Returned (Updated): ${reason || 'Expired'}`, admin_id, finalDate]
      );
    }

    await connection.commit();
    return successResponse(res, null, 'Return record updated successfully.');
  } catch (error: any) {
    await connection.rollback();
    return errorResponse(res, error.message || 'Failed to update return', 500, error);
  } finally {
    connection.release();
  }
};

export const getReturns = async (req: Request, res: Response) => {
  try {
    const [returns]: any = await pool.execute(`
      SELECT 
        r.return_id, r.sale_id, r.total_credit_amount, r.reason, r.created_at,
        v.name_en as client_name,
        v.name_ar as client_name_ar,
        pb.name_en as branch_name,
        pb.name_ar as branch_name_ar,
        (SELECT SUM(ri.quantity * mi.cost_price) 
         FROM sales_return_items ri 
         JOIN menu_items mi ON ri.menu_item_id = mi.menu_item_id 
         WHERE ri.return_id = r.return_id) as wastage_loss
      FROM sales_returns r
      LEFT JOIN vendors v ON r.vendor_id = v.vendor_id
      LEFT JOIN partner_branches pb ON r.branch_id = pb.branch_id
      WHERE r.deleted_at IS NULL
      ORDER BY r.created_at DESC
    `);
    return successResponse(res, returns);
  } catch (error) {
    console.error('getReturns Error:', error);
    return errorResponse(res, 'Failed to fetch returns history', 500, error);
  }
};

export const getOrderItems = async (req: Request, res: Response) => {
  const { sale_id } = req.params;
  try {
    const [items]: any = await pool.execute(`
      SELECT 
        si.menu_item_id, 
        (si.quantity - IFNULL((
          SELECT SUM(ri.quantity) 
          FROM sales_return_items ri 
          JOIN sales_returns sr ON ri.return_id = sr.return_id 
          WHERE sr.sale_id = si.sale_id AND ri.menu_item_id = si.menu_item_id
        ), 0)) as quantity, 
        si.price,
        m.name_en, m.name_ar
      FROM sales_order_items si
      JOIN menu_items m ON si.menu_item_id = m.menu_item_id
      WHERE si.sale_id = ?
      HAVING quantity > 0
    `, [sale_id]);
    return successResponse(res, items);
  } catch (error) {
    return errorResponse(res, 'Failed to fetch order items', 500, error);
  }
};

export const getReturnItems = async (req: Request, res: Response) => {
  const { return_id } = req.params;
  try {
    const [items]: any = await pool.execute(`
      SELECT 
        ri.menu_item_id, ri.quantity, 
        (ri.unit_price * (100 - IFNULL(so.discount_percentage, 25)) / 100) as unit_price,
        ri.unit_price as original_price,
        m.name_en, m.name_ar, m.barcode as item_code
      FROM sales_return_items ri
      LEFT JOIN menu_items m ON ri.menu_item_id = m.menu_item_id
      LEFT JOIN sales_returns sr ON ri.return_id = sr.return_id
      LEFT JOIN sales_orders so ON sr.sale_id = so.sale_id
      WHERE ri.return_id = ?
    `, [return_id]);
    return successResponse(res, items);
  } catch (error) {
    return errorResponse(res, 'Failed to fetch return items', 500, error);
  }
};

export const deleteSalesOrder = async (req: Request, res: Response) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const { id } = req.params;

    // 1. Get the items in this sale
    const [items]: any = await connection.execute(
      'SELECT menu_item_id, quantity FROM sales_order_items WHERE sale_id = ?',
      [id]
    );

    // 2. Loop through items and restore stock (Reverse BOM logic)
    for (const item of items) {
      const [ingredients]: any = await connection.execute(`
        SELECT mii.inventory_item_id, mii.quantity, mii.package_id, ip.multiplier
        FROM menu_item_ingredients mii
        LEFT JOIN inventory_item_packages ip ON mii.package_id = ip.package_id
        WHERE mii.menu_item_id = ?
      `, [item.menu_item_id]);

      for (const ingredient of ingredients) {
        const multiplier = Number(ingredient.multiplier || 1);
        const totalRestoration = Number(ingredient.quantity) * Number(item.quantity) * multiplier;

        // Restore to global count
        await connection.execute(
          'UPDATE inventory_items SET current_stock = current_stock + ? WHERE inventory_item_id = ?',
          [totalRestoration, ingredient.inventory_item_id]
        );

        // Restore to oldest active batch (FIFO logic)
        const [targetBatch]: any = await connection.execute(
          'SELECT batch_id FROM inventory_batches WHERE inventory_item_id = ? AND status = "active" ORDER BY created_at ASC LIMIT 1',
          [ingredient.inventory_item_id]
        );

        if (targetBatch.length > 0) {
          await connection.execute(
            'UPDATE inventory_batches SET remaining_quantity = remaining_quantity + ?, status = "active" WHERE batch_id = ?',
            [totalRestoration, targetBatch[0].batch_id]
          );
        }
      }
    }

    // 3. Mark as deleted
    await connection.execute('UPDATE sales_orders SET deleted_at = CURRENT_TIMESTAMP WHERE sale_id = ?', [id]);

    await connection.commit();
    return successResponse(res, null, 'Order deleted and stock reverted successfully');
  } catch (error: any) {
    if (connection) await connection.rollback();
    return errorResponse(res, 'Failed to delete order and revert stock: ' + error.message, 500, error);
  } finally {
    if (connection) connection.release();
  }
};
