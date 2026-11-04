// @vitest-environment jsdom

import { createElement } from "react";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  createGlobalNoticeStore,
  type GlobalNoticeStorage,
} from "@/global-notice/globalNoticeStore.js";
import { ZCodeIntlProvider } from "@/i18n/IntlProvider.js";
import { SidebarBottomActivity } from "@/sidebar-activity/SidebarBottomActivity.js";

function memoryStorage(): GlobalNoticeStorage {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

function publishShareNotice(store: ReturnType<typeof createGlobalNoticeStore>): void {
  const now = Date.now();
  store.publish({
    noticeId: "notice-1",
    dedupeKey: "highspeed-share:latest",
    type: "highspeed-share",
    schemaVersion: 1,
    scope: "user",
    priority: "normal",
    interruptPolicy: "passive",
    createdAt: now,
    expiresAt: now + 100_000,
    payload: {
      cardId: "hsc-1",
      shareId: "share-1",
      shareUrl: "https://example.test/share-1",
      shareExpiresAt: now + 1_000_000,
      tokenUsage: 10,
      durationSeconds: 1,
    },
    actions: [],
    dismissPolicy: { kind: "cooldown", cooldownMs: 24 * 60 * 60_000 },
    persistencePolicy: "latest-only",
    source: "highspeed",
    revision: 1,
  });
}

function renderActivity(noticeStore: ReturnType<typeof createGlobalNoticeStore>) {
  return render(
    createElement(
      ZCodeIntlProvider,
      { initialLocale: "zh-CN" },
      createElement(SidebarBottomActivity, { noticeStore }),
    ),
  );
}

afterEach(cleanup);

describe("SidebarBottomActivity", () => {
  it("renders the active global notice", () => {
    const noticeStore = createGlobalNoticeStore({ storage: memoryStorage() });
    publishShareNotice(noticeStore);
    const { container } = renderActivity(noticeStore);
    expect(container.querySelector('[data-global-notice-type="highspeed-share"]')).not.toBeNull();
  });

  it("renders nothing when there is no notice", () => {
    const noticeStore = createGlobalNoticeStore({ storage: memoryStorage() });
    const { container } = renderActivity(noticeStore);
    expect(container.querySelector('[data-global-notice-type="highspeed-share"]')).toBeNull();
  });
});
