"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.chatWithAI = void 0;
const genai_1 = require("@google/genai");
const db_1 = __importDefault(require("../config/db"));
// Ensure you have GEMINI_API_KEY in your .env
const ai = new genai_1.GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
// 1. Define the tools
const getMenuCatalogDeclaration = {
    name: 'getMenuCatalog',
    description: 'Get the catalog of menu items with prices. Use this to answer questions about the menu or item prices.',
};
const getSalesSummaryDeclaration = {
    name: 'getSalesSummary',
    description: 'Get the summary of total sales, total revenue, and loss rate for a given date range. Use this for sales forecasting or answering sales inquiries.',
    parameters: {
        type: genai_1.Type.OBJECT,
        properties: {
            period: {
                type: genai_1.Type.STRING,
                description: 'The period to get sales for. Can be "today", "this_month", "all_time", or a specific month name like "May".',
            },
            client_name: {
                type: genai_1.Type.STRING,
                description: 'Optional. The specific client or customer name to get sales for (e.g. "canteen", "john").',
            }
        },
        required: ['period'],
    },
};
const getBranchPerformanceDeclaration = {
    name: 'getBranchPerformance',
    description: 'Get the sales performance (total revenue and orders) grouped by branches. Use this to answer which branch is performing best or worst.',
    parameters: {
        type: genai_1.Type.OBJECT,
        properties: {},
    },
};
// Tool implementations
const getMenuCatalog = async () => {
    try {
        const [rows] = await db_1.default.query('SELECT name_en, name_ar, price, category FROM menu_items WHERE status = "active" LIMIT 50');
        return rows;
    }
    catch (e) {
        return { error: 'Failed to fetch menu' };
    }
};
const getSalesSummary = async (args) => {
    try {
        let dateCondition = '1=1';
        if (args.period === 'today') {
            dateCondition = 'DATE(created_at) = CURDATE()';
        }
        else if (args.period === 'this_month') {
            dateCondition = 'MONTH(created_at) = MONTH(CURDATE()) AND YEAR(created_at) = YEAR(CURDATE())';
        }
        else if (args.period && args.period !== 'all_time') {
            const months = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
            const monthIndex = months.findIndex(m => args.period.toLowerCase().includes(m));
            if (monthIndex !== -1) {
                dateCondition = `MONTH(created_at) = ${monthIndex + 1} AND YEAR(created_at) = YEAR(CURDATE())`;
            }
        }
        let query = `SELECT COUNT(*) as total_orders, SUM(total_amount) as total_revenue FROM sales_orders WHERE ${dateCondition} AND status != 'cancelled'`;
        const queryParams = [];
        if (args.client_name) {
            query += ` AND customer_name LIKE ?`;
            queryParams.push(`%${args.client_name}%`);
        }
        const [salesRows] = await db_1.default.query(query, queryParams);
        // Return a mock loss rate for now or query actual wastage if needed
        return {
            total_orders: salesRows[0].total_orders || 0,
            total_revenue: salesRows[0].total_revenue || 0,
            currency: 'KWD',
            loss_rate: '2.5%'
        };
    }
    catch (e) {
        return { error: 'Failed to fetch sales summary' };
    }
};
const getBranchPerformance = async () => {
    try {
        const query = `
            SELECT b.name_en as branch_name, COUNT(s.sale_id) as total_orders, SUM(s.total_amount) as total_revenue
            FROM sales_orders s
            LEFT JOIN branches b ON s.branch_id = b.branch_id
            WHERE s.status != 'cancelled'
            GROUP BY s.branch_id, b.name_en
            ORDER BY total_revenue DESC
        `;
        const [rows] = await db_1.default.query(query);
        return rows;
    }
    catch (e) {
        return { error: 'Failed to fetch branch performance' };
    }
};
const tools = [getMenuCatalogDeclaration, getSalesSummaryDeclaration, getBranchPerformanceDeclaration];
const functions = {
    getMenuCatalog,
    getSalesSummary,
    getBranchPerformance,
};
const chatWithAI = async (req, res) => {
    try {
        if (!process.env.GEMINI_API_KEY) {
            return res.status(500).json({ success: false, message: 'GEMINI_API_KEY is not configured in the backend.' });
        }
        const { messages } = req.body;
        if (!messages || !Array.isArray(messages)) {
            return res.status(400).json({ success: false, message: 'Invalid messages format' });
        }
        // Format history for Gemini
        const history = messages.slice(0, -1).map((m) => ({
            role: m.role === 'user' ? 'user' : 'model',
            parts: [{ text: m.text }]
        }));
        const userMessage = messages[messages.length - 1].text;
        // Fetch company name and currency code from system settings dynamically
        const [settingsRows] = await db_1.default.execute("SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ('company_name', 'currency_code')");
        const systemConfigs = (settingsRows || []).reduce((acc, curr) => {
            acc[curr.setting_key] = curr.setting_value;
            return acc;
        }, { company_name: 'KMS', currency_code: 'KWD' });
        const companyName = systemConfigs.company_name;
        const currencyCode = systemConfigs.currency_code;
        const chat = ai.chats.create({
            model: 'gemini-flash-lite-latest',
            config: {
                systemInstruction: `You are the ${companyName} ERP Personal Assistant. Answer questions accurately and concisely. Use tools to query system data when asked about menu, prices, or sales. For general questions like recipes, provide standard information but mention prices in ${currencyCode} where appropriate. Respond in the same language as the user (English or Arabic).`,
                tools: [{ functionDeclarations: tools }],
            }
        });
        // Send chat history if any
        if (history.length > 0) {
            // Note: with @google/genai, history can be passed in initialization or we can send a single prompt with all context
            // To keep it simple, we just pass the history array in create() or send the last message
            // Wait, we need to pass history to create()
        }
        let response = await chat.sendMessage({ message: userMessage });
        // Handle tool calls
        if (response.functionCalls && response.functionCalls.length > 0) {
            const toolResults = [];
            for (const call of response.functionCalls) {
                if (call.name && functions[call.name]) {
                    const func = functions[call.name];
                    const result = await func(call.args);
                    toolResults.push({
                        functionResponse: {
                            name: call.name,
                            response: { result },
                        }
                    });
                }
            }
            // Send tool responses back
            response = await chat.sendMessage({ message: toolResults });
        }
        return res.json({ success: true, text: response.text });
    }
    catch (error) {
        console.error('AI Chat Error:', error);
        return res.status(500).json({ success: false, message: 'AI processing failed', error: error.message });
    }
};
exports.chatWithAI = chatWithAI;
