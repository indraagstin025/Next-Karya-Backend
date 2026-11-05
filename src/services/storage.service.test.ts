import { describe, expect, it } from "vitest";
import {
  buildSupabasePublicBaseUrl,
  normalizeSupabaseProjectUrl,
} from "./storage.service";

describe("Supabase storage URL helpers", () => {
  it("strips REST and Storage endpoint suffixes from a copied project URL", () => {
    expect(
      normalizeSupabaseProjectUrl("https://example.supabase.co/rest/v1/")
    ).toBe("https://example.supabase.co");
    expect(
      normalizeSupabaseProjectUrl("https://example.supabase.co/storage/v1")
    ).toBe("https://example.supabase.co");
    expect(normalizeSupabaseProjectUrl("https://example.supabase.co/")).toBe(
      "https://example.supabase.co"
    );
  });

  it("builds the canonical public object base URL", () => {
    expect(
      buildSupabasePublicBaseUrl("https://example.supabase.co/rest/v1/", "nextkarya-media")
    ).toBe(
      "https://example.supabase.co/storage/v1/object/public/nextkarya-media"
    );
  });

  it("keeps a custom project origin untouched", () => {
    expect(normalizeSupabaseProjectUrl("https://media.nextkarya.web.id")).toBe(
      "https://media.nextkarya.web.id"
    );
  });
});
