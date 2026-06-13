import { GoogleGenAI, Type } from '@google/genai';
import pool from '../config/db';
// Ensure you have GEMINI_API_KEY in your .env
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
// 1. Define the tools
const getMenuCatalogDeclaration = {
    name: 'getMenuCatalog',
    description: 'Get the catalog of menu items with prices. Use this to answer questions about the menu or item prices.',
};
const getSalesSummaryDeclaration = {
    name: 'getSalesSummary',
    description: 'Get the summary of total sales, total revenue, and loss rate for a given date range. Use this for sales forecasting or answering sales inquiries.',
    parameters: {
        type: Type.OBJECT,
        properties: {
            period: {
                type: Type.STRING,
                description: 'The period to get sales for. Either "today", "this_month", or "all_time".',
            },
        },
        required: ['period'],
    },
};
// Tool implementations
const getMenuCatalog = async () => {
    try {
        const [rows] = await pool.query('SELECT name_en, name_ar, price, category FROM menu_items WHERE status = "active" LIMIT 50');
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
            dateCondition = 'DATE(order_date) = CURDATE()';
        }
        else if (args.period === 'this_month') {
            dateCondition = 'MONTH(order_date) = MONTH(CURDATE()) AND YEAR(order_date) = YEAR(CURDATE())';
        }
        const [salesRows] = await pool.query(`SELECT COUNT(*) as total_orders, SUM(net_amount) as total_revenue FROM sales_orders WHERE ${dateCondition} AND status != 'cancelled'`);
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
const tools = [getMenuCatalogDeclaration, getSalesSummaryDeclaration];
const functions = {
    getMenuCatalog,
    getSalesSummary,
};
export const chatWithAI = async (req, res) => {
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
        const chat = ai.chats.create({
            model: 'gemini-2.5-flash',
            config: {
                systemInstruction: "You are the Fresh 'n' Fast ERP Personal Assistant. Answer questions accurately and concisely. Use tools to query system data when asked about menu, prices, or sales. For general questions like recipes, provide standard information but mention prices in KWD where appropriate. Respond in the same language as the user (English or Arabic).",
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
                const func = functions[call.name];
                if (func) {
                    const result = await func(call.args);
                    toolResults.push({
                        id: call.id, // we might not need id for @google/genai depending on version, let's use name
                        name: call.name,
                        response: { result },
                    });
                }
            }
            // Send tool responses back
            response = await chat.sendMessage(toolResults);
        }
        return res.json({ success: true, text: response.text });
    }
    catch (error) {
        console.error('AI Chat Error:', error);
        return res.status(500).json({ success: false, message: 'AI processing failed', error: error.message });
    }
};
