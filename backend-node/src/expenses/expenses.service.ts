import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import {
  ReceiptParserService,
  ParsedReceipt,
} from '../llm/receipt-parser.service';
import { ExpenseStatus } from '@prisma/client';

export interface CreateExpenseDto {
  merchantName: string;
  amount: number;
  currency?: string;
  category?: string;
  description?: string;
  transactionDate: string;
  receiptUrl?: string;
}

export interface ProcessReceiptDto {
  receiptUrl: string;
}

@Injectable()
export class ExpensesService {
  constructor(
    private prisma: PrismaService,
    private receiptParser: ReceiptParserService,
  ) {}

  /**
   * Process a receipt using AI and create a draft expense
   */
  async processReceipt(
    organizationId: string,
    userId: string,
    dto: ProcessReceiptDto,
  ) {
    // Parse receipt with AI
    const parsed: ParsedReceipt = await this.receiptParser.parseReceipt(
      dto.receiptUrl,
    );

    // Check for policy violations
    const violations = await this.receiptParser.checkPolicyViolations(parsed);

    // Check for duplicates
    const recentExpenses = await this.prisma.expense.findMany({
      where: {
        organizationId,
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
        },
      },
      select: {
        aiData: true,
      },
      take: 500,
    });

    const existingParsed = recentExpenses
      .filter((e: any) => e.aiData)
      .map((e: any) => e.aiData as ParsedReceipt);

    const isDuplicate = await this.receiptParser.checkDuplicate(
      parsed,
      existingParsed,
    );

    // Create draft expense
    const expense = await this.prisma.expense.create({
      data: {
        organizationId,
        userId,
        merchantName: parsed.merchantName,
        amount: parsed.amount,
        currency: parsed.currency || 'USD',
        category: parsed.category,
        transactionDate: new Date(parsed.transactionDate),
        receiptUrl: dto.receiptUrl,
        status: 'DRAFT',
        aiExtracted: true,
        aiConfidence: parsed.confidence,
        aiData: parsed as any,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    return {
      expense,
      parsed,
      warnings: {
        policyViolations: violations,
        isDuplicate,
      },
    };
  }

  /**
   * Create an expense manually (without AI)
   */
  async create(organizationId: string, userId: string, dto: CreateExpenseDto) {
    return this.prisma.expense.create({
      data: {
        organizationId,
        userId,
        ...dto,
        transactionDate: new Date(dto.transactionDate),
        status: 'DRAFT',
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });
  }

  /**
   * Get all expenses for an organization
   */
  async findAll(
    organizationId: string,
    userId: string,
    status?: ExpenseStatus,
  ) {
    // Verify user is a member
    await this.verifyMembership(organizationId, userId);

    return this.prisma.expense.findMany({
      where: {
        organizationId,
        ...(status && { status }),
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: {
        transactionDate: 'desc',
      },
      take: 100,
    });
  }

  /**
   * Get a single expense
   */
  async findOne(id: string, organizationId: string, userId: string) {
    await this.verifyMembership(organizationId, userId);

    const expense = await this.prisma.expense.findFirst({
      where: {
        id,
        organizationId,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
    });

    if (!expense) {
      throw new NotFoundException('Expense not found');
    }

    return expense;
  }

  /**
   * Update an expense
   */
  async update(
    id: string,
    organizationId: string,
    userId: string,
    dto: Partial<CreateExpenseDto>,
  ) {
    const expense = await this.findOne(id, organizationId, userId);

    // Only the owner can edit unless it's approved/rejected
    if (expense.userId !== userId && expense.status !== 'DRAFT') {
      throw new ForbiddenException('You can only edit your own draft expenses');
    }

    return this.prisma.expense.update({
      where: { id },
      data: {
        ...dto,
        ...(dto.transactionDate && {
          transactionDate: new Date(dto.transactionDate),
        }),
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });
  }

  /**
   * Submit expense for approval
   */
  async submit(id: string, organizationId: string, userId: string) {
    const expense = await this.findOne(id, organizationId, userId);

    if (expense.userId !== userId) {
      throw new ForbiddenException('You can only submit your own expenses');
    }

    if (expense.status !== 'DRAFT') {
      throw new ForbiddenException('Only draft expenses can be submitted');
    }

    return this.prisma.expense.update({
      where: { id },
      data: { status: 'SUBMITTED' },
    });
  }

  /**
   * Approve an expense (admins only)
   */
  async approve(id: string, organizationId: string, userId: string) {
    await this.verifyAdmin(organizationId, userId);

    const expense = await this.findOne(id, organizationId, userId);

    if (expense.status !== 'SUBMITTED') {
      throw new ForbiddenException('Only submitted expenses can be approved');
    }

    return this.prisma.expense.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedBy: userId,
        approvedAt: new Date(),
      },
    });
  }

  /**
   * Reject an expense (admins only)
   */
  async reject(id: string, organizationId: string, userId: string) {
    await this.verifyAdmin(organizationId, userId);

    const expense = await this.findOne(id, organizationId, userId);

    if (expense.status !== 'SUBMITTED') {
      throw new ForbiddenException('Only submitted expenses can be rejected');
    }

    return this.prisma.expense.update({
      where: { id },
      data: {
        status: 'REJECTED',
        approvedBy: userId,
        approvedAt: new Date(),
      },
    });
  }

  /**
   * Delete an expense
   */
  async remove(id: string, organizationId: string, userId: string) {
    const expense = await this.findOne(id, organizationId, userId);

    // Only owner or admin can delete
    const isAdmin = await this.isAdmin(organizationId, userId);
    if (expense.userId !== userId && !isAdmin) {
      throw new ForbiddenException(
        'You can only delete your own expenses or be an admin',
      );
    }

    await this.prisma.expense.delete({ where: { id } });
    return { message: 'Expense deleted successfully' };
  }

  // Helper methods
  private async verifyMembership(organizationId: string, userId: string) {
    const member = await this.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId,
        },
      },
    });

    if (!member) {
      throw new ForbiddenException('You are not a member of this organization');
    }

    return member;
  }

  private async verifyAdmin(organizationId: string, userId: string) {
    const member = await this.verifyMembership(organizationId, userId);

    if (member.role !== 'ADMIN') {
      throw new ForbiddenException('Only admins can perform this action');
    }

    return member;
  }

  private async isAdmin(
    organizationId: string,
    userId: string,
  ): Promise<boolean> {
    const member = await this.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId,
        },
      },
    });

    return member?.role === 'ADMIN';
  }
}
