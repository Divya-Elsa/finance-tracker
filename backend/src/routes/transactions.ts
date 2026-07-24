import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { AuthedRequest } from "../middleware/auth";
import { monthRange } from "../lib/date";
import { serializeTransaction } from "../lib/serialize";

const router = Router();

const transactionSchema = z.object({
  categoryId: z.string().uuid(),
  amount: z.number().positive(),
  type: z.enum(["income", "expense"]),
  date: z.string().datetime().or(z.string().min(10)),
  description: z.string().max(280).optional().nullable(),
});

router.get("/", async (req: AuthedRequest, res) => {
  const { month, categoryId, type } = req.query as {
    month?: string;
    categoryId?: string;
    type?: string;
  };

  const where: any = { userId: req.userId };
  if (month) {
    const { start, end } = monthRange(month);
    where.date = { gte: start, lt: end };
  }
  if (categoryId) where.categoryId = categoryId;
  if (type === "income" || type === "expense") where.type = type;

  const transactions = await prisma.transaction.findMany({
    where,
    include: { category: true },
    orderBy: { date: "desc" },
  });
  res.json({ transactions: transactions.map(serializeTransaction) });
});

router.post("/", async (req: AuthedRequest, res) => {
  const parsed = transactionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const category = await prisma.category.findFirst({
    where: { id: parsed.data.categoryId, userId: req.userId },
  });
  if (!category) return res.status(400).json({ error: "Unknown category" });

  const transaction = await prisma.transaction.create({
    data: {
      userId: req.userId as string,
      categoryId: parsed.data.categoryId,
      amount: parsed.data.amount,
      type: parsed.data.type,
      date: new Date(parsed.data.date),
      description: parsed.data.description ?? null,
    },
    include: { category: true },
  });
  res.status(201).json({ transaction: serializeTransaction(transaction) });
});

router.put("/:id", async (req: AuthedRequest, res) => {
  const parsed = transactionSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const existing = await prisma.transaction.findFirst({
    where: { id: req.params.id, userId: req.userId },
  });
  if (!existing) return res.status(404).json({ error: "Transaction not found" });

  if (parsed.data.categoryId) {
    const category = await prisma.category.findFirst({
      where: { id: parsed.data.categoryId, userId: req.userId },
    });
    if (!category) return res.status(400).json({ error: "Unknown category" });
  }

  const transaction = await prisma.transaction.update({
    where: { id: existing.id },
    data: {
      ...parsed.data,
      date: parsed.data.date ? new Date(parsed.data.date) : undefined,
    },
    include: { category: true },
  });
  res.json({ transaction: serializeTransaction(transaction) });
});

router.delete("/:id", async (req: AuthedRequest, res) => {
  const existing = await prisma.transaction.findFirst({
    where: { id: req.params.id, userId: req.userId },
  });
  if (!existing) return res.status(404).json({ error: "Transaction not found" });

  await prisma.transaction.delete({ where: { id: existing.id } });
  res.status(204).send();
});

export default router;
