import express from 'express';
import { getEmployees, createEmployee, updateEmployee } from '../controllers/employeesController';

const router = express.Router();

router.get('/', getEmployees);
router.post('/', createEmployee);
router.put('/:id', updateEmployee);

export default router;
