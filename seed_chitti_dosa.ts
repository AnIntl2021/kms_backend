import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';

const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env.development';
dotenv.config({ path: path.resolve(process.cwd(), envFile) });

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'kms_master',
};

async function seed() {
  console.log('🏁 Starting ChittiDosa menu seeder...');
  console.log('DB Config:', { host: dbConfig.host, database: dbConfig.database, user: dbConfig.user });

  let masterPool;
  try {
    masterPool = mysql.createPool(dbConfig);
    
    // 1. Locate ChittiDosa database
    const [tenants]: any = await masterPool.execute(
      "SELECT db_name, name FROM tenants WHERE name LIKE '%Chitti%' OR db_name LIKE '%chitti%'"
    );

    if (tenants.length === 0) {
      console.error('❌ Could not find tenant with name "ChittiDosa" or "Chitti Dosa" in tenants table.');
      process.exit(1);
    }

    const dbName = tenants[0].db_name;
    const displayName = tenants[0].name;
    console.log(`🎯 Found tenant DB: [${dbName}] for tenant [${displayName}]`);

    // 2. Connect to Tenant DB
    const tenantPool = mysql.createPool({
      ...dbConfig,
      database: dbName,
    });

    console.log(`🔗 Connected to tenant database: ${dbName}`);

    // Disable foreign key checks
    await tenantPool.execute('SET FOREIGN_KEY_CHECKS = 0');

    // 3. Clear existing default/test menu and categories to start fresh
    console.log('🧹 Clearing old categories, menu items, and branch associations...');
    await tenantPool.execute('TRUNCATE TABLE branch_menu_items');
    await tenantPool.execute('DELETE FROM menu_items');
    await tenantPool.execute('DELETE FROM categories');
    
    // Enable foreign keys
    await tenantPool.execute('SET FOREIGN_KEY_CHECKS = 1');

    // 4. Seed Categories
    console.log('🌱 Seeding South Indian Categories...');
    const categories = [
      { id: 1, name_en: 'Dosa', name_ar: 'دوسا' },
      { id: 2, name_en: 'Idli & Vada', name_ar: 'إدلي وفادا' },
      { id: 3, name_en: 'Uttapam', name_ar: 'أوتابام' },
      { id: 4, name_en: 'Beverages', name_ar: 'مشروبات' }
    ];

    for (const cat of categories) {
      await tenantPool.execute(
        'INSERT INTO categories (category_id, name_en, name_ar, sort_order) VALUES (?, ?, ?, ?)',
        [cat.id, cat.name_en, cat.name_ar, cat.id]
      );
    }
    console.log('✅ Categories seeded successfully.');

    // 5. Seed Menu Items
    console.log('🌱 Seeding South Indian Menu Items...');
    const menuItems = [
      // DOSA (Category 1)
      {
        name_en: 'Masala Dosa',
        name_ar: 'ماسالا دوسا',
        price: 1.250,
        cost_price: 0.350,
        category_id: 1,
        image_url: 'uploads/menu/masala_dosa.png',
        description_en: 'Crispy crepe filled with mildly spiced potato masala, served with sambar and fresh chutneys.',
        description_ar: 'كرّيب مقرمش محشو بالبطاطا المتبلة بالبهارات الخفيفة، يقدم مع السامبار والشتني الطازج.'
      },
      {
        name_en: 'Plain Dosa',
        name_ar: 'دوسا سادة',
        price: 0.950,
        cost_price: 0.200,
        category_id: 1,
        image_url: null,
        description_en: 'Simple crispy golden crepe, served with sambar and traditional chutneys.',
        description_ar: 'كرّيب مقرمش ذهبي بسيط، يقدم مع السامبار والشتني التقليدي.'
      },
      {
        name_en: 'Mysore Masala Dosa',
        name_ar: 'مايسور ماسالا دوسا',
        price: 1.450,
        cost_price: 0.400,
        category_id: 1,
        image_url: null,
        description_en: 'Crispy crepe layered with spicy red garlic chutney and stuffed with spiced potato masala.',
        description_ar: 'كرّيب مقرمش مغطى بشتني الثوم الأحمر الحار ومحشو بالبطاطا المتبلة.'
      },
      {
        name_en: 'Cheese Dosa',
        name_ar: 'دوسا بالجبنة',
        price: 1.350,
        cost_price: 0.450,
        category_id: 1,
        image_url: null,
        description_en: 'Crispy crepe loaded with melted cheese, perfect choice for cheese lovers.',
        description_ar: 'كرّيب مقرمش غني بالجبنة الذائبة، خيار مثالي لمحبي الجبن.'
      },
      // IDLI & VADA (Category 2)
      {
        name_en: 'Steamed Idli (2 Pcs)',
        name_ar: 'إدلي على البخار (قطعتين)',
        price: 0.750,
        cost_price: 0.150,
        category_id: 2,
        image_url: 'uploads/menu/idli_vada.png',
        description_en: 'Soft fluffy steamed rice cakes served with hot sambar and fresh coconut chutney.',
        description_ar: 'كعك أرز ناعم مطهو على البخار يقدم مع السامبار الساخن وشتني جوز الهند الطازج.'
      },
      {
        name_en: 'Medu Vada (2 Pcs)',
        name_ar: 'ميدو فادا (قطعتين)',
        price: 0.800,
        cost_price: 0.200,
        category_id: 2,
        image_url: 'uploads/menu/idli_vada.png',
        description_en: 'Crispy fried savory lentil donuts, spiced with pepper and curry leaves.',
        description_ar: 'دوناتس العدس المقرمشة والمقلية، متبلة بالفلفل وأوراق الكاري.'
      },
      {
        name_en: 'Idli Vada Combo',
        name_ar: 'كومبو إدلي وفادا',
        price: 0.950,
        cost_price: 0.220,
        category_id: 2,
        image_url: 'uploads/menu/idli_vada.png',
        description_en: 'A perfect combo of 2 soft steamed idlis and 1 crispy medu vada.',
        description_ar: 'كومبو مثالي من قطعتين إدلي ناعمة مطهوة على البخار وقطعة ميدو فادا مقرمشة.'
      },
      // UTTAPAM (Category 3)
      {
        name_en: 'Onion Uttapam',
        name_ar: 'أوتابام بالبصل',
        price: 1.150,
        cost_price: 0.300,
        category_id: 3,
        image_url: 'uploads/menu/onion_uttapam.png',
        description_en: 'Thick savory rice pancake topped with finely chopped onions, chilies and fresh coriander.',
        description_ar: 'بانكيك أرز سميك مالح مغطى بالبصل المفروم ناعماً والفلفل الحار والكزبرة الطازجة.'
      },
      {
        name_en: 'Tomato Uttapam',
        name_ar: 'أوتابام بالطماطم',
        price: 1.150,
        cost_price: 0.300,
        category_id: 3,
        image_url: null,
        description_en: 'Thick savory pancake topped with juicy tomatoes and mild spices.',
        description_ar: 'بانكيك سميك مالح مغطى بالطماطم الطازجة والبهارات الخفيفة.'
      },
      // BEVERAGES (Category 4)
      {
        name_en: 'South Indian Filter Coffee',
        name_ar: 'قهوة فلتر جنوب الهند',
        price: 0.500,
        cost_price: 0.100,
        category_id: 4,
        image_url: 'uploads/menu/filter_coffee.png',
        description_en: 'Authentic frothy South Indian filter coffee brewed with chicory blend.',
        description_ar: 'قهوة فلتر جنوب هندية أصلية غنية بالرغوة ومحضرة بمزيج الهندباء.'
      },
      {
        name_en: 'Masala Chai',
        name_ar: 'شاي ماسالا',
        price: 0.400,
        cost_price: 0.080,
        category_id: 4,
        image_url: null,
        description_en: 'Traditional Indian milk tea brewed with cardamom, ginger, and aromatic spices.',
        description_ar: 'شاي حليب هندي تقليدي محضر مع الهيل والزنجبيل والبهارات العطرية.'
      }
    ];

    // Get branches to link
    const [branches]: any = await tenantPool.execute('SELECT branch_id FROM branches');
    console.log(`Branches found: ${branches.map((b: any) => b.branch_id).join(', ')}`);

    for (let i = 0; i < menuItems.length; i++) {
      const item = menuItems[i];
      const [insertRes]: any = await tenantPool.execute(
        `INSERT INTO menu_items 
        (category_id, name_en, name_ar, price, cost_price, description_en, description_ar, image_url, status, sort_order) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'available', ?)`
      , [
        item.category_id,
        item.name_en,
        item.name_ar,
        item.price,
        item.cost_price,
        item.description_en,
        item.description_ar,
        item.image_url,
        i + 1
      ]);

      const insertedId = insertRes.insertId;

      // Link to branches
      for (const branch of branches) {
        await tenantPool.execute(
          'INSERT INTO branch_menu_items (branch_id, menu_item_id, custom_price, status) VALUES (?, ?, NULL, \'available\')'
        , [branch.branch_id, insertedId]);
      }
    }

    console.log('✅ Menu items seeded successfully and associated with existing branches.');
    console.log('🎉 Seeding completed successfully!');
    process.exit(0);
  } catch (err: any) {
    console.error('❌ Seeding Error:', err.message);
    process.exit(1);
  }
}

seed();
