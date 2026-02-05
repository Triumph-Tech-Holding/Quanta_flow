import { useState } from "react";
import { Inbox as InboxIcon, Settings } from "lucide-react";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ZApiConfig } from "@/components/inbox/ZApiConfig";
import { ConversationList } from "@/components/inbox/ConversationList";
import { ChatWindow } from "@/components/inbox/ChatWindow";
import { useSocket } from "@/hooks/useSocket";
import type { Conversation } from "@shared/schema";

export default function InboxPage() {
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  useSocket();

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <SidebarInset className="flex flex-col flex-1 overflow-hidden">
          <header className="flex items-center justify-between p-4 border-b flex-shrink-0">
            <div className="flex items-center gap-2">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              <InboxIcon className="h-5 w-5" />
              <h1 className="text-lg font-semibold">Inbox</h1>
            </div>
            <ThemeToggle />
          </header>

          <main className="flex-1 overflow-hidden">
            <Tabs defaultValue="chat" className="h-full flex flex-col">
              <div className="border-b px-4">
                <TabsList className="h-auto bg-transparent p-0">
                  <TabsTrigger
                    value="chat"
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
                    data-testid="tab-chat"
                  >
                    Conversas
                  </TabsTrigger>
                  <TabsTrigger
                    value="settings"
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
                    data-testid="tab-settings"
                  >
                    <Settings className="h-4 w-4 mr-1" />
                    Configurações
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="chat" className="flex-1 m-0 overflow-hidden">
                <div className="flex h-full">
                  <div className="w-80 border-r flex-shrink-0 overflow-hidden">
                    <ConversationList
                      selectedId={selectedConversation?.id}
                      onSelect={setSelectedConversation}
                    />
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <ChatWindow conversation={selectedConversation} />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="settings" className="flex-1 m-0 p-6 overflow-auto">
                <div className="max-w-xl mx-auto">
                  <ZApiConfig />
                </div>
              </TabsContent>
            </Tabs>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
