"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const assetsController_1 = require("../controllers/assetsController");
const router = express_1.default.Router();
router.get('/', assetsController_1.getAssets);
router.post('/', assetsController_1.createAsset);
router.put('/:id', assetsController_1.updateAsset);
exports.default = router;
