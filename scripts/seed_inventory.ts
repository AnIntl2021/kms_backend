import pool from '../src/config/db.js';

const seedInventory = async () => {
  try {
    console.log('🌱 Seeding Inventory Data...');

    // 1. Insert Categories if they don't exist
    const [catResult]: any = await pool.execute(
      `INSERT IGNORE INTO categories (category_id, name_en, name_ar, sort_order) VALUES 
      (1, 'Raw Materials', 'مواد خام', 1),
      (2, 'Dairy', 'منتجات الألبان', 2),
      (3, 'Syrups', 'شراب السكر', 3),
      (4, 'Packaging', 'التعبئة والتغليف', 4)`
    );

    // 2. Insert Inventory Items
    const [itemResult]: any = await pool.execute(
      `INSERT IGNORE INTO inventory_items (name_en, name_ar, sku, category_id, current_stock, min_stock_level, unit_en, unit_ar, cost_price, sort_order) VALUES 
      ('Premium Coffee Beans', 'حبوب بن ممتازة', 'CB-001', 1, 45.500, 10.000, 'kg', 'كجم', 12.500, 1),
      ('Organic Whole Milk', 'حليب كامل عضوي', 'MK-042', 2, 5.200, 15.000, 'Liters', 'لتر', 1.250, 2),
      ('Sugar Syrups (Vanilla)', 'شراب السكر (فانيليا)', 'SY-109', 3, 12.000, 5.000, 'Bottles', 'زجاجات', 8.750, 3),
      ('Cocoa Powder', 'بودرة كاكاو', 'CP-088', 1, 50.000, 20.000, 'kg', 'كجم', 15.000, 4),
      ('Paper Cups (12oz)', 'أكواب ورقية (12 أونصة)', 'PC-012', 4, 1500.000, 500.000, 'pcs', 'قطعة', 0.045, 5),
      ('Plastic Lids', 'أغطية بلاستيكية', 'PL-001', 4, 1200.000, 500.000, 'pcs', 'قطعة', 0.012, 6)`
    );

    console.log('✅ Seed successful!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  }
};

seedInventory();
