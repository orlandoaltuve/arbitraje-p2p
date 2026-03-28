require('dotenv').config(); // Para poder leer tu MONGO_URI
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

// Permite que nuestra futura página web (frontend) le pida datos a este servidor sin bloqueos
app.use(cors());

// 1. Conectamos a la misma Base de Datos
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("🟢 Servidor API conectado a MongoDB"))
    .catch(error => console.error("🔴 Error conectando API a MongoDB:", error.message));

// 2. Necesitamos el mismo "Molde" para poder leer los datos
const priceSchema = new mongoose.Schema({
    tradeType: String,
    payType: String,
    top10Prices: [Number],
    averagePrice: Number,
    timestamp: { type: Date, default: Date.now }
});

// Nota: Si el modelo ya existe en Mongoose, lo usamos, si no, lo creamos.
const PriceRecord = mongoose.models.PriceRecord || mongoose.model('PriceRecord', priceSchema);

// ==========================================
// RUTAS DE NUESTRA API (ENDPOINTS)
// ==========================================

// Ruta principal para obtener el historial
app.get('/api/precios', async (req, res) => {
    try {
        // Buscamos todos los registros, los ordenamos del más nuevo al más viejo (-1) y traemos los últimos 200
        const historial = await PriceRecord.find().sort({ timestamp: -1 }).limit(200);
        
        // Respondemos enviando los datos en formato JSON
        res.json(historial);
    } catch (error) {
        console.error("Error al obtener los datos:", error);
        res.status(500).json({ error: "Error interno del servidor" });
    }
});

// ==========================================
// ENCENDIDO DEL SERVIDOR
// ==========================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor API corriendo en http://localhost:${PORT}`);
    console.log(`👉 Entra a http://localhost:${PORT}/api/precios para ver tus datos`);
});