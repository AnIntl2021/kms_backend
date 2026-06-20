const mysql = require('mysql2/promise');

async function run() {
  const con = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'kms_tenant_61d06f4f5d39'
  });

  try {
    // Insert categories
    await con.execute(`
      INSERT IGNORE INTO menu_categories (category_id, name_en, name_ar) 
      VALUES 
      (1, 'Meals', 'Meals'), 
      (2, 'Sides', 'Sides'), 
      (3, 'Drinks', 'Drinks'), 
      (4, 'Healthy', 'Healthy')
    `);

    // Insert items
    await con.execute(`
      INSERT IGNORE INTO menu_items (menu_item_id, name_en, name_ar, price, cost_price, category_id, status) 
      VALUES 
      (1, 'Burger Combo', 'برجر كومبو', 12.99, 5.00, 1, 'available'), 
      (2, 'Chicken Wings', 'أجنحة دجاج', 8.50, 3.00, 2, 'available'), 
      (3, 'French Fries', 'بطاطا مقلية', 4.99, 1.00, 2, 'available'), 
      (4, 'Cola', 'كولا', 2.50, 0.50, 3, 'available'), 
      (5, 'Pizza Margherita', 'بيتزا مارغريتا', 15.00, 4.00, 1, 'available'), 
      (6, 'Caesar Salad', 'سلطة سيزر', 9.99, 2.50, 4, 'available')
    `);
    
    console.log('Inserted mock data!');
  } catch (err) {
    console.error(err);
  } finally {
    await con.end();
  }
}

run();
