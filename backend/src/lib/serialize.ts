import { Budget, Category, Transaction } from "@prisma/client";

export function serializeTransaction(t: Transaction & { category: Category }) {
  return { ...t, amount: Number(t.amount) };
}

export function serializeBudget(b: Budget & { category: Category }) {
  return { ...b, monthlyLimit: Number(b.monthlyLimit) };
}
