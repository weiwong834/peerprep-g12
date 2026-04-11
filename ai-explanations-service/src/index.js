import express from "express";
import aiRoutes from "./routes/aiRoutes.js";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.use("/ai", aiRoutes);

app.listen(4000, () => {
  console.log("AI Service running on port 4000");
});