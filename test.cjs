const mysql = require('mysql2/promise');

async function test() {
  try {
    const c = await mysql.createConnection({host:'localhost', user:'root', password:'', database:'kms_ansoftt_09f7'});
    const [rows] = await c.query(`
      SELECT s.*, 
      (SELECT COUNT(*) FROM sales_order_items WHERE sale_id = s.sale_id) as items_count,
      IFNULL((SELECT SUM(total_credit_amount) FROM sales_returns WHERE sale_id = s.sale_id), 0) as returns_amount,
      (
        SELECT JSON_ARRAYAGG(
          JSON_OBJECT(
            'menu_item_id', soi.menu_item_id, 
            'name_en', mi.name_en, 
            'quantity', soi.quantity,
            'returns_qty', (
               SELECT COALESCE(SUM(sri.quantity), 0) 
               FROM sales_return_items sri 
               JOIN sales_returns sr ON sri.return_id = sr.return_id 
               WHERE sri.menu_item_id = soi.menu_item_id AND sr.sale_id = s.sale_id
            )
          )
        )
        FROM sales_order_items soi
        JOIN menu_items mi ON soi.menu_item_id = mi.menu_item_id
        WHERE soi.sale_id = s.sale_id
      ) as items_json,
      DATE_FORMAT(s.created_at, '%Y-%m-%d') as dispatch_date,
      b.name_en as branch_name,
      b.phone as branch_phone,
      s.client_phone as client_phone,
      a.first_name as salesman_name,
      s.payment_method
      FROM sales_orders s 
      LEFT JOIN branches b ON s.branch_id = b.branch_id
      LEFT JOIN admins a ON s.admin_id = a.admin_id
      WHERE s.deleted_at IS NULL
      ORDER BY s.created_at DESC, s.sale_id DESC
    `);
    console.log(rows);
    await c.end();
  } catch(e) {
    console.error('ERROR:', e.message);
  }
}
test();
