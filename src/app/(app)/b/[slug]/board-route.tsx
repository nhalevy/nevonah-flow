"use client";

import { useParams } from "next/navigation";
import { BoardView } from "@/components/board-view";

export function BoardRoute() {
  const { slug } = useParams<{ slug: string }>();
  return <BoardView key={slug} slug={slug} />;
}
