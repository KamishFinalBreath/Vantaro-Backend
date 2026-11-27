import { prisma } from '../config/prisma.js';
import { ApiError } from '../utils/ApiError.js';

export async function listProducts(params: {
  search?: string;
  skip?: number;
  take?: number;
}) {
  const take = Math.min(params.take ?? 50, 100);
  const skip = params.skip ?? 0;
  const where = {
    isActive: true,
    ...(params.search
      ? {
          OR: [
            { title: { contains: params.search, mode: 'insensitive' as const } },
            { tags: { has: params.search } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.product.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: { variants: { where: { isAvailable: true } } },
    }),
    prisma.product.count({ where }),
  ]);

  return { items, total, skip, take };
}

export async function getProduct(id: string) {
  const product = await prisma.product.findFirst({
    where: { id, isActive: true },
    include: { variants: { where: { isAvailable: true } } },
  });
  if (!product) throw ApiError.notFound('Product not found');
  return product;
}