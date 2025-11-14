// server.js (ESM)
import express from "express";
import cors from "cors";
import admin from "firebase-admin";

// Lees service account: eerst uit ENV var, anders uit file (lokale dev)
let serviceAccount;
if (process.env.SERVICE_ACCOUNT_KEY) {
    try {
        serviceAccount = JSON.parse(process.env.SERVICE_ACCOUNT_KEY);
    } catch (err) {
        console.error("FOUT: SERVICE_ACCOUNT_KEY is geen geldige JSON");
        process.exit(1);
    }
} else {
    // Lokale fallback: gebruik alleen als je bewust het JSON-bestand lokaal hebt geplaatst
    // (NIET in Git!)
    try {
        const fs = await import("fs/promises");
        const content = await fs.readFile("./serviceAccountKey.json", "utf8");
        serviceAccount = JSON.parse(content);
    } catch (err) {
        console.error("Geen SERVICE_ACCOUNT_KEY env var en geen local serviceAccountKey.json gevonden.");
        console.error("Set SERVICE_ACCOUNT_KEY or add your serviceAccountKey.json for local dev.");
        process.exit(1);
    }
}

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

const app = express();
app.use(cors());
app.use(express.json());

// Basic health check
app.get("/", (req, res) => res.send("OK"));

// Endpoint: check code in Firestore collection "codes" and create custom token
app.post("/getCustomToken", async (req, res) => {
    try {
        const { code } = req.body;
        if (!code) return res.status(400).json({ error: "Geen code opgegeven" });

        const docRef = db.collection("codes").doc(code.trim());
        const docSnap = await docRef.get();

        if (!docSnap.exists) {
            return res.status(401).json({ error: "Ongeldige code" });
        }

        const data = docSnap.data();
        const uid = data.uid || `user_${code.trim()}`;

        // Optional custom claims
        const customClaims = {
            code: code.trim(),
            bootnaam: data.bootnaam || null,
            wedstrijdnummer: data.wedstrijdnummer || null,
        };

        const customToken = await admin.auth().createCustomToken(uid, customClaims);
        return res.json({ token: customToken });
    } catch (err) {
        console.error("Error /getCustomToken:", err);
        return res.status(500).json({ error: "Interne serverfout" });
    }
});

// luister op Render's PORT of fallback 3000
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server listening on port ${PORT}`);
});
