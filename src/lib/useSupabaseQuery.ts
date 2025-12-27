import { useEffect, useRef, useState } from "react";
import type { DependencyList } from "react";
import { supabase } from "./supabase";

type SupabaseQueryOptions = {
  tables?: string[];
  enabled?: boolean;
};

export default function useSupabaseQuery<T>(
  fetcher: () => Promise<T>,
  deps: DependencyList,
  initial: T,
  options: SupabaseQueryOptions = {}
) {
  const { tables = [], enabled = true } = options;
  const [value, setValue] = useState<T>(initial);
  const fetchRef = useRef(fetcher);
  fetchRef.current = fetcher;

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    fetchRef
      .current()
      .then((data) => {
        if (active) setValue(data);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!enabled || tables.length === 0) return;
    const channel = supabase.channel(`query-${Math.random().toString(36).slice(2)}`);
    tables.forEach((table) => {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        () => {
          fetchRef.current().then(setValue).catch(() => undefined);
        }
      );
    });
    channel.subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, tables.join(",")]);

  return value;
}
