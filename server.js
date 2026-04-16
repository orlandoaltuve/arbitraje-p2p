require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

app.use(cors());

mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("🟢 Servidor API conectado a MongoDB"))
    .catch(error => console.error("🔴 Error conectando API a MongoDB:", error.message));

const priceSchema = new mongoose.Schema({
    tradeType: String,
    payType: String,
    top10Prices: [Number],
    averagePrice: Number,
    timestamp: { type: Date, default: Date.now }
});

const PriceRecord = mongoose.models.PriceRecord || mongoose.model('PriceRecord', priceSchema);

app.get('/api/precios', async (req, res) => {
    try {
        // Aumentamos el límite a 10,000 para traer meses de historial
        const historial = await PriceRecord.find().sort({ timestamp: -1 }).limit(10000);
        res.json(historial);
    } catch (error) {
        console.error("Error al obtener los datos:", error);
        res.status(500).json({ error: "Error interno del servidor" });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor API corriendo en http://localhost:${PORT}`);
    console.log(`👉 Entra a http://localhost:${PORT}/api/precios para ver tus datos`);
});