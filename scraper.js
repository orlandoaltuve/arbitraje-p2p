require('dotenv').config();
const mongoose = require('mongoose');
const axios = require('axios');
const cron = require('node-cron');

// Función para conectar a MongoDB
async function connectDB() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("🟢 ¡Conectado a la base de datos MongoDB con éxito!");
    } catch (error) {
        console.error("🔴 Error conectando a MongoDB:", error.message);
        process.exit(1); // Detiene la app si no puede conectarse
    }
}

// ==========================================
// MOLDE DE LA BASE DE DATOS (SCHEMA)
// ==========================================
const priceSchema = new mongoose.Schema({
    tradeType: String,     // 'BUY' o 'SELL'
    payType: String,       // 'Zinli' o 'WallyTech'
    top10Prices: [Number], // Lista con los 10 precios exactos
    averagePrice: Number,  // El promedio que calculamos
    timestamp: { type: Date, default: Date.now } // Guarda la fecha y hora exacta automáticamente
});

// Compilamos el modelo
const PriceRecord = mongoose.model('PriceRecord', priceSchema);

// URL interna de Binance P2P
const BINANCE_API_URL = 'https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search';

/**
 * Función principal para obtener datos de Binance P2P
 * @param {string} tradeType - 'BUY' o 'SELL' (Perspectiva del Taker/Usuario regular)
 * @param {string} payType - 'Zinli' o 'Wally'
 * @param {number} transAmount - Monto mínimo de la transacción
 */
async function fetchP2PData(tradeType, payType, transAmount) {
    // Payload (cuerpo de la petición) exacto que Binance espera
    const payload = {
        fiat: "USD",
        asset: "USDT",
        tradeType: tradeType,
        payTypes: [payType],
        publisherType: "merchant", // Solo comerciantes verificados (Merchants)
        rows: 10,                  // Top 10 anuncios
        page: 1,
        transAmount: transAmount   // Filtrar por monto mínimo ($100 compra, $50 venta)
    };

    try {
        const response = await axios.post(BINANCE_API_URL, payload, {
            headers: {
                'Content-Type': 'application/json',
                // Agregamos un User-Agent para simular ser un navegador y evitar bloqueos
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        const ads = response.data.data; // Aquí vienen los anuncios

        if (!ads || ads.length === 0) {
            console.log(`No se encontraron anuncios para ${tradeType} con ${payType}.`);
            return;
        }

        // Extraer los precios y convertirlos a números decimales
        const prices = ads.map(ad => parseFloat(ad.adv.price));
        
        // Calcular el promedio del Top 10
        const sum = prices.reduce((acc, price) => acc + price, 0);
        const average = sum / prices.length;

        console.log(`\n--- Resultados para ${payType} | Pestaña Taker: ${tradeType} ---`);
        console.log(`Top ${prices.length} precios:`, prices);
        console.log(`Precio Promedio: ${average.toFixed(3)} USD`);

        // --- CÓDIGO NUEVO PARA GUARDAR EN MONGODB ---
        const nuevoRegistro = new PriceRecord({
            tradeType: tradeType,
            payType: payType,
            top10Prices: prices,
            averagePrice: parseFloat(average.toFixed(3)) // Guardamos a 3 decimales
        });

        // Guardamos el registro en la nube
        await nuevoRegistro.save();
        console.log(`💾 ¡Registro guardado en MongoDB para ${payType} (${tradeType})!`);
        // ---------------------------------------------

    } catch (error) {
        console.error(`Error obteniendo datos para ${payType} (${tradeType}):`, error.message);
    }
}

// Función orquestadora para ejecutar nuestras consultas
async function runScraper() {

    console.log("Iniciando extracción de datos en Binance P2P...");

    // REGLA MAKER COMPRAR: Publicas anuncio de compra. 
    // Compites con otros que publican compra. 
    // Apareces en la pestaña "VENDER" (SELL) del usuario regular. Monto min: $100
    await fetchP2PData('SELL', 'Zinli', 100);
    await fetchP2PData('SELL', 'WallyTech', 100);

    // REGLA MAKER VENDER: Publicas anuncio de venta. 
    // Compites con otros que publican venta.
    // Apareces en la pestaña "COMPRAR" (BUY) del usuario regular. Monto min: $50
    await fetchP2PData('BUY', 'Zinli', 50);
    await fetchP2PData('BUY', 'WallyTech', 50);

    console.log("\nExtracción finalizada.");
}

// Ejecutamos una primera vez apenas arranca el script
(async () => {
    await connectDB(); // <-- Agregamos esto para conectar ANTES de extraer
    runScraper();
})();

// Programamos la ejecución automática cada 30 minutos
cron.schedule('*/30 * * * *', () => {
    const timestamp = new Date().toLocaleString();
    console.log(`\n--- [${timestamp}] Ejecución programada de 30 minutos ---`);
    runScraper();
});

console.log("Cron job iniciado: El scraper está activo y esperando sus ciclos de 30 min. (Presiona Ctrl + C para detener)");