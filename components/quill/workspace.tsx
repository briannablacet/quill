"use client"

import { useState } from "react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { GeneratePanel } from "./generate-panel"
import { UploadPanel } from "./upload-panel"
import { ContentHistory } from "./content-history"
import type { ContentItem } from "./types"

export function Workspace({ initialContent }: { initialContent: ContentItem[] }) {
  const [content, setContent] = useState(initialContent)
  const [tab, setTab] = useState("new")

  return (
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList variant="line">
        <TabsTrigger value="new">Write</TabsTrigger>
        <TabsTrigger value="review">Edit/Review</TabsTrigger>
        <TabsTrigger value="history">View History{content.length > 0 ? ` (${content.length})` : ""}</TabsTrigger>
      </TabsList>
      <TabsContent value="new">
        <GeneratePanel
          onGenerated={(item) =>
            setContent((prev) => [item, ...prev.filter((c) => c.contentId !== item.contentId)])
          }
        />
      </TabsContent>
      <TabsContent value="review">
        <UploadPanel
          onReviewed={(item) =>
            setContent((prev) => [item, ...prev.filter((c) => c.contentId !== item.contentId)])
          }
        />
      </TabsContent>
      <TabsContent value="history">
        <ContentHistory items={content} />
      </TabsContent>
    </Tabs>
  )
}
