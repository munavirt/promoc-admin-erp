import { assignMember, type ProjectMemberBackend } from "@/api/projects.api";
import { extractApiErrorMessage } from "@/infrastructure/apiClient";

export interface MemberToAssign {
  employee: string;
  role_in_project: string;
  /** Display name for error messages. */
  label?: string;
}

export interface AssignResult {
  added: ProjectMemberBackend[];
  failed: { member: MemberToAssign; message: string }[];
}

/**
 * POST /api/projects/{id}/members/ once per member, sequentially (the backend validates against
 * existing members, e.g. a single PROJECT_MANAGER). Every failure is captured — nothing is assumed to succeed.
 */
export async function assignMembersSequentially(projectId: string | number, members: MemberToAssign[]): Promise<AssignResult> {
  const result: AssignResult = { added: [], failed: [] };
  for (const member of members) {
    try {
      const added = await assignMember(projectId, { employee: Number(member.employee), role_in_project: member.role_in_project });
      result.added.push(added);
    } catch (err) {
      result.failed.push({ member, message: extractApiErrorMessage(err, "Could not be added.").message });
    }
  }
  return result;
}

export function describeFailures(failed: AssignResult["failed"]): string {
  return failed.map((f) => `${f.member.label || `Employee #${f.member.employee}`}: ${f.message}`).join(" · ");
}
