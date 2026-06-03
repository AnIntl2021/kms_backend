const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixMayReturns() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME
  });

  try {
    await connection.beginTransaction();

    const [vendors] = await connection.execute('SELECT * FROM vendors WHERE name_en LIKE "%Canteen%" OR name_ar LIKE "%Canteen%"');
    const vendorId = vendors[0].vendor_id;

    // 1. Find the first May order to attach the returns to
    const [orders] = await connection.execute(`
      SELECT sale_id, discount_percentage, branch_id, salesman_id, admin_id
      FROM sales_orders 
      WHERE vendor_id = ? AND DATE(created_at) >= "2026-05-01" AND DATE(created_at) <= "2026-05-31" AND deleted_at IS NULL
      ORDER BY created_at ASC LIMIT 1
    `, [vendorId]);

    if (orders.length === 0) {
      throw new Error("No May orders found to attach returns to.");
    }
    const order = orders[0];
    const saleId = order.sale_id;
    const branchId = order.branch_id;
    const salesmanId = order.salesman_id;
    const adminId = order.admin_id || 1;
    const discountFactor = (100 - Number(order.discount_percentage || 25)) / 100;
    const returnDate = "2026-05-31 23:59:59";

    // 2. The exact items to return for May
    const itemsToReturn = [
      { name: "Turkey Mozzarella", quantity: 9 },
      { name: "Halloumi Deli Sub", quantity: 7 },
      { name: "Egg & Cheese", quantity: 2 },
      { name: "Chicken Stroganoff", quantity: 19 },
      { name: "Grill Chicken", quantity: 18 }
    ];

    let totalCredit = 0;
    const itemsWithIds = [];

    // 3. Find menu_item_ids and calculate prices
    for (const item of itemsToReturn) {
      const [menuItems] = await connection.execute(`
        SELECT menu_item_id, name_en, price 
        FROM menu_items 
        WHERE name_en LIKE ?
      `, [`%${item.name}%`]);

      if (menuItems.length === 0) throw new Error(`Item not found: ${item.name}`);
      
      const menuItem = menuItems[0];
      itemsWithIds.push({
        menu_item_id: menuItem.menu_item_id,
        name: menuItem.name_en,
        quantity: item.quantity,
        unit_price: menuItem.price
      });

      totalCredit += (item.quantity * Number(menuItem.price) * discountFactor);
    }

    console.log(`Total Credit to apply: ${totalCredit.toFixed(3)} KWD`);

    // 4. Insert into sales_returns
    const [returnRes] = await connection.execute(
      'INSERT INTO sales_returns (sale_id, vendor_id, branch_id, reason, total_credit_amount, admin_id, salesman_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [saleId, vendorId, branchId, "Missing Unsold Items from May", totalCredit, adminId, salesmanId, returnDate]
    );
    const returnId = returnRes.insertId;
    console.log(`Created Return ID: ${returnId}`);

    // 5. Insert into sales_return_items and wastage
    for (const item of itemsWithIds) {
      await connection.execute(
        'INSERT INTO sales_return_items (return_id, menu_item_id, quantity, unit_price) VALUES (?, ?, ?, ?)',
        [returnId, item.menu_item_id, item.quantity, item.unit_price]
      );

      await connection.execute(
        'INSERT INTO wastage (menu_item_id, return_id, quantity, reason_en, admin_id, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        [item.menu_item_id, returnId, item.quantity, "Returned from Vendor: Missing Unsold Items from May", adminId, returnDate]
      );
      
      console.log(`Added return for ${item.quantity}x ${item.name}`);
    }

    await connection.commit();
    console.log("Successfully added the 55 missing returns for May!");

  } catch (err) {
    await connection.rollback();
    console.error("Error adding returns:", err);
  } finally {
    await connection.end();
  }
}

fixMayReturns();
