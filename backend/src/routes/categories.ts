import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { AuthedRequest } from "../middleware/auth";

const router = Router();

const categorySchema = z.object({
  name: z.string().min(1).max(50),
  type: z.enum(["income", "expense"]),
});

router.get("/", async (req: AuthedRequest, res) => {
  const categories = await prisma.category.findMany({
    where: { userId: req.userId },
    orderBy: { name: "asc" },
  });
  res.json({ categories });
});

router.post("/", async (req: AuthedRequest, res) => {
  const parsed = categorySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  try {
    const category = await prisma.category.create({
      data: { ...parsed.data, userId: req.userId as string },
    });
    res.status(201).json({ category });
  } catch {
    res.status(409).json({ error: "A category with that name already exists" });
  }
});

router.put("/:id", async (req: AuthedRequest, res) => {
  const parsed = categorySchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const existing = await prisma.category.findFirst({
    where: { id: req.params.id, userId: req.userId },
  });
  if (!existing) return res.status(404).json({ error: "Category not found" });

  const category = await prisma.category.update({
    where: { id: existing.id },
    data: parsed.data,
  });
  res.json({ category });
});

router.delete("/:id", async (req: AuthedRequest, res) => {
  const existing = await prisma.category.findFirst({
    where: { id: req.params.id, userId: req.userId },
  });
  if (!existing) return res.status(404).json({ error: "Category not found" });

  await prisma.category.delete({ where: { id: existing.id } });
  res.status(204).send();
});

export default router;
