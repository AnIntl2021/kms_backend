"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const liabilitiesController_1 = require("../controllers/liabilitiesController");
const router = express_1.default.Router();
router.get('/', liabilitiesController_1.getLiabilities);
router.post('/', liabilitiesController_1.createLiability);
router.put('/:id', liabilitiesController_1.updateLiability);
exports.default = router;
