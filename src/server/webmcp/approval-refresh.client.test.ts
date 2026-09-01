import { describe, expect, it, vi } from "vitest";
import { RefreshingApprovalClient } from "./approval-refresh.client";
import type { ApprovalClient } from "./integration-contracts";

describe("RefreshingApprovalClient", () => {
  it("immediately refreshes the browser capability surface after successful review mutations", async () => {
    const approvals: ApprovalClient = { list: vi.fn(), read: vi.fn(), approve: vi.fn(async () => ({ decision: "APPROVED" })),
      reject: vi.fn(async () => ({ decision: "REJECTED" })), modify: vi.fn(async () => ({ proposalVersion: 2 })) };
    const refresh = vi.fn(async () => ({ registered: ["revoke_approved_sessions"] }));
    const client = new RefreshingApprovalClient(approvals, { refresh });
    const base = { actionId: "ACT-1", proposalVersion: 1, expectedLifecycleVersion: 6 };
    await client.approve(base); await client.reject(base); await client.modify({ ...base, parameters: { sessionIds: ["S-1"] } });
    expect(refresh).toHaveBeenCalledTimes(3);
    expect(vi.mocked(approvals.approve).mock.invocationCallOrder[0]).toBeLessThan(refresh.mock.invocationCallOrder[0]);
  });

  it("does not refresh when the review mutation fails", async () => {
    const approvals: ApprovalClient = { list: vi.fn(), read: vi.fn(), approve: vi.fn(async () => { throw new Error("blocked"); }),
      reject: vi.fn(), modify: vi.fn() };
    const refresh = vi.fn();
    const client = new RefreshingApprovalClient(approvals, { refresh });
    await expect(client.approve({ actionId: "ACT", proposalVersion: 1, expectedLifecycleVersion: 2 })).rejects.toThrow("blocked");
    expect(refresh).not.toHaveBeenCalled();
  });

  it("makes an approved capability visible through the explicit refresh boundary", async () => {
    let approved = false;
    const visible = new Set(["inspect_incident"]);
    const approvals: ApprovalClient = { list: vi.fn(), read: vi.fn(),
      approve: vi.fn(async () => { approved = true; return { decision: "APPROVED" }; }), reject: vi.fn(), modify: vi.fn() };
    const refresh = vi.fn(async () => { if (approved) visible.add("revoke_approved_sessions"); });
    const client = new RefreshingApprovalClient(approvals, { refresh });
    await client.approve({ actionId: "ACT-2", proposalVersion: 1, expectedLifecycleVersion: 6 });
    expect([...visible]).toContain("revoke_approved_sessions");
    expect(refresh).toHaveBeenCalledOnce();
  });
});
