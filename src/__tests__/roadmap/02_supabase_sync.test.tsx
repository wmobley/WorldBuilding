import { describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

const supabaseMocks = vi.hoisted(() => {
  const channelOn = vi.fn().mockReturnThis();
  const channelSubscribe = vi.fn();
  const channel = { on: channelOn, subscribe: channelSubscribe };
  const removeChannel = vi.fn();
  const channelFactory = vi.fn(() => channel);
  return { channelOn, channelSubscribe, channel, removeChannel, channelFactory };
});

vi.mock("../../lib/supabase", () => ({
  supabase: {
    channel: supabaseMocks.channelFactory,
    removeChannel: supabaseMocks.removeChannel
  }
}));

import useSupabaseQuery from "../../lib/useSupabaseQuery";

describe("roadmap/02 supabase sync - query subscriptions", () => {
  it("fetches once and subscribes to table changes when enabled", async () => {
    const fetcher = vi.fn().mockResolvedValue(["ok"]);
    const { result, unmount } = renderHook(() =>
      useSupabaseQuery(fetcher, [], [], { tables: ["docs", "tags"], enabled: true })
    );

    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    expect(supabaseMocks.channelFactory).toHaveBeenCalledTimes(1);
    expect(supabaseMocks.channelOn).toHaveBeenCalledTimes(2);
    expect(supabaseMocks.channelSubscribe).toHaveBeenCalledTimes(1);
    expect(result.current).toEqual(["ok"]);

    unmount();
    expect(supabaseMocks.removeChannel).toHaveBeenCalledTimes(1);
  });

  it("skips fetch and subscriptions when disabled", async () => {
    supabaseMocks.channelFactory.mockClear();
    supabaseMocks.channelOn.mockClear();
    supabaseMocks.channelSubscribe.mockClear();
    supabaseMocks.removeChannel.mockClear();

    const fetcher = vi.fn().mockResolvedValue(["skip"]);
    renderHook(() => useSupabaseQuery(fetcher, [], [], { tables: ["docs"], enabled: false }));

    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(0));
    expect(supabaseMocks.channelFactory).not.toHaveBeenCalled();
    expect(supabaseMocks.channelOn).not.toHaveBeenCalled();
    expect(supabaseMocks.channelSubscribe).not.toHaveBeenCalled();
    expect(supabaseMocks.removeChannel).not.toHaveBeenCalled();
  });
});
