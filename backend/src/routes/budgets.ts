import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { AuthedRequest } from "../middleware/auth";
import { serializeBudget } from "../lib/serialize";

const router = Router();

const budgetSchema = z.object({
  categoryId: z.string().uuid(),
  monthlyLimit: z.number().positive(),
});

router.get("/", async (req: AuthedRequest, res) => {
  const budgets = await prisma.budget.findMany({
    where: { userId: req.userId },
    include: { category: true },
    orderBy: { category: { name: "asc" } },
  });
  res.json({ budgets: budgets.map(serializeBudget) });
});

router.put("/", async (req: AuthedRequest, res) => {
  const parsed = budgetSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const category = await prisma.category.findFirst({
    where: { id: parsed.data.categoryId, userId: req.userId, type: "expense" },
  });
  if (!category) return res.status(400).json({ error: "Unknown expense category" });

  const budget = await prisma.budget.upsert({
    where: { userId_categoryId: { userId: req.userId as string, categoryId: parsed.data.categoryId } },
    update: { monthlyLimit: parsed.data.monthlyLimit },
    create: {
      userId: req.userId as string,
      categoryId: parsed.data.categoryId,
      monthlyLimit: parsed.data.monthlyLimit,
    },
    include: { category: true },
  });
  res.json({ budget: serializeBudget(budget) });
});

router.delete("/:id", async (req: AuthedRequest, res) => {
  const existing = await prisma.budget.findFirst({
    where: { id: req.params.id, userId: req.userId },
  });
  if (!existing) return res.status(404).json({ error: "Budget not found" });

  await prisma.budget.delete({ where: { id: existing.id } });
  res.status(204).send();
});

export default router;
