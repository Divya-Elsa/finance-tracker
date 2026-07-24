import "dotenv/config";
import express from "express";
import cors from "cors";
import authRouter from "./routes/auth";
import categoriesRouter from "./routes/categories";
import transactionsRouter from "./routes/transactions";
import budgetsRouter from "./routes/budgets";
import reportsRouter from "./routes/reports";
import { requireAuth } from "./middleware/auth";

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is required");
}

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN?.split(",") ?? "*" }));
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/api/auth", authRouter);
app.use("/api/categories", requireAuth, categoriesRouter);
app.use("/api/transactions", requireAuth, transactionsRouter);
app.use("/api/budgets", requireAuth, budgetsRouter);
app.use("/api/reports", requireAuth, reportsRouter);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

const port = Number(process.env.PORT) || 4000;
app.listen(port, () => {
  console.log(`API listening on port ${port}`);
});
