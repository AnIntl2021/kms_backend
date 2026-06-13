import db from '../config/db';
export const getEmployees = async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM employees WHERE deleted_at IS NULL ORDER BY created_at DESC');
        res.json({ success: true, data: rows });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch employees', error });
    }
};
export const createEmployee = async (req, res) => {
    const { name, role, salary, allowances, employee_no } = req.body;
    try {
        const allowancesJson = allowances ? JSON.stringify(allowances) : null;
        const [result] = await db.query('INSERT INTO employees (employee_no, name, role, salary, allowances) VALUES (?, ?, ?, ?, ?)', [employee_no || null, name, role || 'Staff', salary || 0, allowancesJson]);
        res.status(201).json({ success: true, data: { employee_id: result.insertId, employee_no, name, role, salary, allowances, status: 'active' } });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to create employee', error });
    }
};
export const updateEmployee = async (req, res) => {
    const { id } = req.params;
    const { name, role, salary, allowances, status, employee_no } = req.body;
    try {
        const allowancesJson = allowances ? JSON.stringify(allowances) : null;
        await db.query('UPDATE employees SET employee_no=?, name=?, role=?, salary=?, allowances=?, status=? WHERE employee_id=?', [employee_no || null, name, role, salary, allowancesJson, status || 'active', id]);
        res.json({ success: true, message: 'Employee updated successfully' });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to update employee', error });
    }
};
export const deleteEmployee = async (req, res) => {
    const { id } = req.params;
    try {
        await db.query('UPDATE employees SET deleted_at = CURRENT_TIMESTAMP WHERE employee_id = ?', [id]);
        res.json({ success: true, message: 'Employee deleted successfully' });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to delete employee', error });
    }
};
