import { IsArray, IsEnum, IsOptional, IsString } from 'class-validator';
import { CloseTaskStatus } from '@prisma/client';

/**
 * Partial update for a CloseTask. The cockpit calls this from three places:
 *   1. "Mark done" button on a row in the calendar panel.
 *   2. "Waive" overflow-menu action when a task isn't applicable this period.
 *   3. Owner / evidence edit dialogs.
 *
 * All fields are optional so the same endpoint serves every interaction.
 */
export class UpdateTaskDto {
  @IsOptional()
  @IsEnum(CloseTaskStatus)
  status?: CloseTaskStatus;

  @IsOptional()
  @IsString()
  ownerId?: string;

  @IsOptional()
  @IsString()
  dueAt?: string; // ISO date string

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  evidenceUrls?: string[];
}
