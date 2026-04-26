"use client";

import React from "react";
import { ChatView } from "@/src/components/feed/message/ChatView";

export default function MessagesPage(props: any) {
  return (
    <React.Suspense fallback={null}>
      <ChatView {...props} />
    </React.Suspense>
  );
}
